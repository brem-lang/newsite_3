import React, { createContext, useContext } from "react";
import { cn } from "@/lib/utils";

// The site trades in Philippine pesos only. There is no currency setting:
// every price, balance and payment is shown and charged in PHP.
export const CURRENCY_CODE = "PHP";
export const CURRENCY_SYMBOL = "₱";

const format = (n) => `${CURRENCY_SYMBOL}${Number(n || 0).toFixed(2)}`;
const VALUE = { code: CURRENCY_CODE, symbol: CURRENCY_SYMBOL, format };

const CurrencyContext = createContext(VALUE);

export function CurrencyProvider({ children }) {
  return <CurrencyContext.Provider value={VALUE}>{children}</CurrencyContext.Provider>;
}

export function Money({ amount, className, codeClassName }) {
  return (
    <span className={className}>
      <span className={cn("text-[0.62em] font-semibold opacity-70 me-1", codeClassName)}>{CURRENCY_CODE}</span>
      {Number(amount || 0).toFixed(2)}
    </span>
  );
}

export function useCurrency() {
  return useContext(CurrencyContext);
}
