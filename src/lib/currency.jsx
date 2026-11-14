import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { cn } from "@/lib/utils";

const SYMBOLS = { USD: "$", JOD: "JOD", SAR: "SAR", EUR: "€", GBP: "£" };

const CurrencyContext = createContext({ code: "USD", symbol: "$", format: (n) => `$${(n || 0).toFixed(2)}` });

export function CurrencyProvider({ children }) {
  const [code, setCode] = useState("USD");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("ascend_currency");
    if (stored) setCode(stored);
    setHydrated(true);
  }, []);

  useEffect(() => {
    let active = true;
    // list() (not filter) so this shares the same cached request AuthContext
    // already makes for site settings instead of firing a second round-trip.
    const read = () =>
      base44.entities.SiteSettings.list()
        .then((rows) => {
          const c = rows?.find((r) => r?.key === "global" || !r?.key)?.active_currency;
          if (c && active) setCode(c);
        })
        .catch(() => {});
    read();
    const unsub = base44.entities.SiteSettings.subscribe(() => read());
    return () => { active = false; try { if (typeof unsub === "function") unsub(); } catch (_) {} };
  }, []);

  useEffect(() => { if (hydrated) localStorage.setItem("ascend_currency", code); }, [code, hydrated]);

  const symbol = SYMBOLS[code] || (code || "$");
  const format = useCallback((n) => `${symbol}${Number(n || 0).toFixed(2)}`, [symbol]);

  return <CurrencyContext.Provider value={{ code, symbol, format, setCode }}>{children}</CurrencyContext.Provider>;
}

export function Money({ amount, className, codeClassName }) {
  const { code } = useCurrency();
  return (
    <span className={className}>
      <span className={cn("text-[0.62em] font-semibold opacity-70 me-1", codeClassName)}>{code}</span>
      {Number(amount || 0).toFixed(2)}
    </span>
  );
}

export function useCurrency() {
  return useContext(CurrencyContext);
}