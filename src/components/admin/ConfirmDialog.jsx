import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
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

/**
 * Asks before closing a dialog that has unsaved edits.
 *
 *   const { markDirty, guard } = useDiscardGuard(open);
 *   <Dialog open={open} onOpenChange={guard(setOpen)}>
 *     <DialogForm onChange={markDirty} …>
 *     <Button onClick={() => guard(setOpen)(false)}>Cancel</Button>
 *
 * Any input/select/textarea change inside the dialog marks it dirty (React's
 * onChange bubbles). Closing after a successful save should call the raw
 * setter, so it never prompts.
 */
export function useDiscardGuard(open) {
  const { t } = useI18n();
  const askConfirm = useConfirm();
  const dirty = useRef(false);

  // Fresh state every time the dialog opens.
  useEffect(() => {
    if (open) dirty.current = false;
  }, [open]);

  const markDirty = useCallback(() => {
    dirty.current = true;
  }, []);

  const guard = useCallback(
    (setOpen) => async (next) => {
      if (next || !dirty.current) return setOpen(next);
      const c = t.admin.confirm;
      const ok = await askConfirm({
        title: c.discardChangesTitle,
        description: c.discardChangesDesc,
        confirmLabel: c.discardLabel,
        cancelLabel: c.keepEditing,
        destructive: true,
      });
      if (ok) {
        dirty.current = false;
        setOpen(false);
      }
    },
    [askConfirm, t]
  );

  return { markDirty, guard };
}

export function useConfirm() {
  const confirm = useContext(ConfirmContext);
  // Outside the provider (shouldn't happen in the admin area) fall back to the browser dialog.
  return confirm || ((opts = {}) => Promise.resolve(window.confirm(opts.description || opts.title || "")));
}
