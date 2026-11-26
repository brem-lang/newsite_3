import React, { useEffect, useState } from "react";
import { Copy, Eye, EyeOff, KeyRound, RefreshCw } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogForm } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const MIN = 8;
const MAX = 72;
// No look-alike characters (0/O, 1/l/I) so it can be read out to someone.
const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";

function generatePassword(length = 12) {
  const bytes = new Uint32Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (n) => CHARS[n % CHARS.length]).join("");
}

const ERRORS = {
  password_too_short: `The password must be at least ${MIN} characters.`,
  password_too_long: `The password can be at most ${MAX} characters.`,
};

/**
 * Admin: set a member's password directly (setUserPassword on the server),
 * for someone who can't receive the reset email. The member is told by an
 * in-app notification; the admin passes the new password on themselves.
 */
export default function SetPasswordDialog({ user, open, onOpenChange }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setPassword("");
      setConfirm("");
      setShow(false);
    }
  }, [open]);

  if (!user) return null;
  const name = user.full_name || user.email || "";
  const tooShort = password.length > 0 && password.length < MIN;
  const mismatch = confirm.length > 0 && confirm !== password;
  const valid = password.length >= MIN && password.length <= MAX && confirm === password;

  const generate = () => {
    const next = generatePassword();
    setPassword(next);
    setConfirm(next);
    setShow(true);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(password);
      toast.success("Password copied");
    } catch {
      toast.error("Couldn't copy, select it and copy it yourself");
    }
  };

  const save = async () => {
    if (!valid || busy) return;
    setBusy(true);
    try {
      const res = await base44.functions.invoke("setUserPassword", { user_id: user.id, password });
      if (res.data?.error) {
        toast.error(ERRORS[res.data.error] || res.data.error);
        return;
      }
      toast.success(`New password set for ${name}`);
      onOpenChange(false);
    } catch (e) {
      toast.error(e.message || "Error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <DialogForm onSubmit={(e) => { e.preventDefault(); save(); }}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="w-4 h-4" /> Set password
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <p className="text-sm text-muted-foreground">
              Choose a new password for <span className="font-semibold text-foreground">{name}</span>. Their old
              password stops working right away. They get an in-app notice; pass the new password on to them
              yourself.
            </p>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="set-pw-new">New password</Label>
                <button
                  type="button"
                  onClick={generate}
                  className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                >
                  <RefreshCw className="w-3 h-3" /> Generate
                </button>
              </div>
              <div className="relative">
                <Input
                  id="set-pw-new"
                  type={show ? "text" : "password"}
                  autoComplete="new-password"
                  value={password}
                  maxLength={MAX}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pe-20 font-mono"
                />
                <div className="absolute inset-y-0 end-1 flex items-center gap-0.5">
                  {password ? (
                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={copy} aria-label="Copy password">
                      <Copy className="w-4 h-4" />
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setShow((v) => !v)}
                    aria-label={show ? "Hide password" : "Show password"}
                  >
                    {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
              <p className={tooShort ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>
                At least {MIN} characters.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="set-pw-confirm">Confirm password</Label>
              <Input
                id="set-pw-confirm"
                type={show ? "text" : "password"}
                autoComplete="new-password"
                value={confirm}
                maxLength={MAX}
                onChange={(e) => setConfirm(e.target.value)}
                className="font-mono"
              />
              {mismatch ? <p className="text-xs text-destructive">The passwords don't match.</p> : null}
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
            <Button type="submit" disabled={!valid || busy}>{busy ? "Saving…" : "Set password"}</Button>
          </DialogFooter>
        </DialogForm>
      </DialogContent>
    </Dialog>
  );
}
