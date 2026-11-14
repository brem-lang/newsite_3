import React, { useState } from "react";
import { Shield, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Dedicated staff sign-in for /admin. It uses the separate admin session, so
 * signing in here never signs anyone into the customer site (and vice versa).
 */
export default function AdminLogin({ onVerified }) {
  const { t, dir } = useI18n();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await base44.adminAuth.login(email.trim(), password);
      const res = await base44.functions.invoke("myAdminCapabilities", {});
      const caps = res?.data && !res.data.error ? res.data : null;
      if (!caps?.is_admin) {
        await base44.adminAuth.logout();
        setError(t.admin.notAdmin);
        return;
      }
      if (onVerified) onVerified(caps);
      else window.location.href = "/admin";
    } catch (err) {
      setError(err?.message || t.authp.invalidCreds);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen grid place-items-center bg-muted/30 px-4" dir={dir}>
      <div className="w-full max-w-sm space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-primary text-primary-foreground grid place-items-center shrink-0">
              <Shield className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="font-heading font-semibold truncate">{t.admin.loginTitle}</p>
              <p className="text-xs text-muted-foreground truncate">{t.admin.loginSubtitle}</p>
            </div>
          </div>
        </div>

        <form onSubmit={submit} className="rounded-2xl border border-border bg-card p-5 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="admin-email">{t.authp.email}</Label>
            <Input
              id="admin-email"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t.authp.emailPlaceholder}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="admin-password">{t.authp.password}</Label>
            <Input
              id="admin-password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}

          <Button type="submit" className="w-full" disabled={busy}>
            {busy && <Loader2 className="w-4 h-4 me-2 animate-spin" />}
            {t.admin.loginCta}
          </Button>
        </form>

      </div>
    </div>
  );
}
