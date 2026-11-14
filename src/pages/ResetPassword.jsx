import React, { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock, Loader2, AlertTriangle } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";
import { useI18n } from "@/lib/i18n";

export default function ResetPassword() {
  const { t } = useI18n();
  const [searchParams] = useSearchParams();
  // The recovery e-mail signs the visitor in for a short window; some links
  // still carry a token in the query string. Either one is a valid entry.
  const queryToken = searchParams.get("token") || searchParams.get("code");
  const [ready, setReady] = useState(!!queryToken);
  const [checking, setChecking] = useState(!queryToken);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (queryToken) return;
    let alive = true;
    const check = async () => {
      const authed = await base44.auth.isAuthenticated().catch(() => false);
      if (!alive) return;
      setReady(!!authed);
      setChecking(false);
    };
    // Give the client a moment to consume the recovery tokens from the URL.
    const timer = setTimeout(check, 600);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [queryToken]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (newPassword !== confirmPassword) {
      setError(t.authp.pwMismatch);
      return;
    }
    setLoading(true);
    try {
      await base44.auth.resetPassword({ resetToken: queryToken, newPassword });
      window.location.href = "/login";
    } catch (err) {
      setError(err.message || t.authp.resetFailed);
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <AuthLayout icon={Lock} title={t.authp.invalidLinkTitle} subtitle="">
        <div className="flex justify-center py-6">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
        </div>
      </AuthLayout>
    );
  }

  if (!ready) {
    return (
      <AuthLayout
        icon={AlertTriangle}
        title={t.authp.invalidLinkTitle}
        subtitle={t.authp.invalidLinkSubtitle}
        footer={
          <Link to="/forgot-password" className="text-primary font-medium hover:underline">
            {t.authp.requestNewLink}
          </Link>
        }
      >
        <p className="text-sm text-foreground text-center">
          {t.authp.invalidLinkBody}
        </p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      icon={Lock}
      title={t.authp.resetTitle}
      subtitle={t.authp.resetSubtitle}
    >
      {error && (
        <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
          {error}
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="password">{t.authp.newPassword}</Label>
          <div className="relative">
            <Lock className="absolute ltr:left-3 rtl:right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              autoFocus
              placeholder="••••••••"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="ltr:pl-10 rtl:pr-10 h-12"
              required
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirm">{t.authp.confirmPassword}</Label>
          <div className="relative">
            <Lock className="absolute ltr:left-3 rtl:right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input
              id="confirm"
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="ltr:pl-10 rtl:pr-10 h-12"
              required
            />
          </div>
        </div>
        <Button type="submit" className="w-full h-12 gold-button text-base font-bold" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              {t.authp.resetting}
            </>
          ) : (
            t.authp.resetBtn
          )}
        </Button>
      </form>
    </AuthLayout>
  );
}
