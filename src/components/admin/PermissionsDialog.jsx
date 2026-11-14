import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useI18n } from "@/lib/i18n";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const CAPS = ["join_auctions", "place_bids", "topup_wallet"];
const STATES = ["inherit", "allow", "deny"];

export default function PermissionsDialog({ user, open, onOpenChange, onSaved }) {
  const { t } = useI18n();
  const [perms, setPerms] = useState({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user) setPerms(user.permissions || {});
  }, [user?.id, open]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!user) return null;

  const set = (cap, v) => setPerms((p) => ({ ...p, [cap]: v }));

  const save = async () => {
    setBusy(true);
    try {
      const payload = {};
      CAPS.forEach((c) => { payload[c] = perms[c] || "inherit"; });
      const res = await base44.functions.invoke("updateUser", { user_id: user.id, permissions: payload });
      if (res.data?.error) { toast.error(res.data.error); return; }
      toast.success(t.admin.permissions.saved);
      onOpenChange(null);
      onSaved?.();
    } catch (e) {
      toast.error(e.message || "Error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{t.admin.permissions.title}</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground -mt-1">{t.admin.permissions.subtitle}</p>
        <p className="text-sm font-medium">{user.full_name || user.email}</p>

        <div className="space-y-3">
          {CAPS.map((cap) => {
            const cur = perms[cap] || "inherit";
            return (
              <div key={cap} className="rounded-xl border border-border p-3">
                <p className="text-sm font-medium mb-2">{t.admin.permissions.caps[cap]}</p>
                <div className="grid grid-cols-3 gap-1.5">
                  {STATES.map((s) => {
                    const active = cur === s;
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => set(cap, s)}
                        className={cn(
                          "text-xs font-semibold rounded-lg px-2 py-1.5 border transition-colors",
                          active
                            ? s === "allow" ? "bg-success text-success-foreground border-success/40"
                              : s === "deny" ? "bg-destructive text-destructive-foreground border-destructive/40"
                              : "bg-secondary text-secondary-foreground border-secondary"
                            : "bg-transparent text-muted-foreground border-input hover:bg-secondary/50"
                        )}
                      >
                        {t.admin.permissions[s]}
                      </button>
                    );
                  })}
                </div>
                <p className="text-[11px] text-muted-foreground mt-1.5">{t.admin.permissions[`${cur}Hint`]}</p>
              </div>
            );
          })}
        </div>

        <DialogFooter>
          <DialogClose asChild><Button variant="outline">{t.admin.cancel}</Button></DialogClose>
          <Button onClick={save} disabled={busy}>{busy ? t.admin.saving : t.admin.save}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}