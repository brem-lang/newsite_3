import React, { createContext, useCallback, useContext, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const ConfirmContext = createContext(null);

/**
 * Promise-based replacement for window.confirm, rendered with the site's own
 * AlertDialog. Usage:
 *
 *   const confirm = useConfirm();
 *   if (!(await confirm({ title, description, confirmLabel, destructive: true }))) return;
 */
export function ConfirmProvider({ children }) {
  const { t } = useI18n();
  const [options, setOptions] = useState(null);
  const resolver = useRef(null);

  const settle = useCallback((result) => {
    resolver.current?.(result);
    resolver.current = null;
    setOptions(null);
  }, []);

  const confirm = useCallback((opts = {}) => {
    // A second request while one is open cancels the first.
    resolver.current?.(false);
    return new Promise((resolve) => {
      resolver.current = resolve;
      setOptions(opts);
    });
  }, []);

  const c = t.admin.confirm;

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <AlertDialog open={!!options} onOpenChange={(open) => !open && settle(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{options?.title || c.title}</AlertDialogTitle>
            {(options?.description ?? c.description) && (
              <AlertDialogDescription>{options?.description ?? c.description}</AlertDialogDescription>
            )}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => settle(false)}>
              {options?.cancelLabel || c.cancel}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => settle(true)}
              className={cn(options?.destructive && buttonVariants({ variant: "destructive" }))}
            >
              {options?.confirmLabel || c.confirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const confirm = useContext(ConfirmContext);
  // Outside the provider (shouldn't happen in the admin area) fall back to the browser dialog.
  return confirm || ((opts = {}) => Promise.resolve(window.confirm(opts.description || opts.title || "")));
}
