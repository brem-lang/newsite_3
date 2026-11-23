import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useSiteSettings, pickGlobalSettings } from "@/lib/queries/config";
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

  // Shares the one cached, realtime-backed site_settings query with AuthContext.
  const { data: settingsRows } = useSiteSettings();
  const serverCode = pickGlobalSettings(settingsRows)?.active_currency;
  useEffect(() => {
    if (serverCode) setCode(serverCode);
  }, [serverCode]);

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