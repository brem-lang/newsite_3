import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LogIn, Mail, Lock, Loader2 } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";
import { postLoginDest } from "@/lib/authReturnTo";
import { useI18n } from "@/lib/i18n";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  // Post-login destination (e.g. the MCP OAuth consent page sends users here
  // with returnTo so the grant flow can resume). Same-origin paths only.
  const { t } = useI18n();
  const returnTo = postLoginDest();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await base44.auth.loginViaEmailPassword(email, password);
      const me = await base44.auth.me().catch(() => null);
      if (me && me.paused) {
        await base44.auth.logout();
        setError(t.auth.suspendedDesc);
        return;
      }
      // Client-side navigation: a full reload re-downloaded and re-initialised
      // the whole app just to land on the same session.
      navigate(returnTo, { replace: true });
    } catch (err) {
      setError(err.message || t.authp.invalidCreds);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      icon={LogIn}
      title={t.authp.loginTitle}
      subtitle={t.authp.loginSubtitle}
      footer={
        <>
          {t.authp.noAccount}{" "}
          <Link
            to={"/register" + (returnTo !== "/" ? "?returnTo=" + encodeURIComponent(returnTo) : "")}
            className="text-primary font-medium hover:underline"
          >
            {t.authp.createOne}
          </Link>
        </>
      }
    >


      {error && (
        <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">{t.authp.email}</Label>
          <div className="relative">
            <Mail className="absolute ltr:left-3 rtl:right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input
              id="email"
              type="email"
              autoComplete="email"
              autoFocus
              placeholder={t.authp.emailPlaceholder}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="ltr:pl-10 rtl:pr-10 h-12"
              required
            />
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">{t.authp.password}</Label>
            <Link to="/forgot-password" className="text-xs text-primary hover:underline">
              {t.authp.forgot}
            </Link>
          </div>
          <div className="relative">
            <Lock className="absolute ltr:left-3 rtl:right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="ltr:pl-10 rtl:pr-10 h-12"
              required
            />
          </div>
        </div>
        <Button type="submit" className="w-full h-12 gold-button text-base font-bold" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              {t.authp.loggingIn}
            </>
          ) : (
            t.authp.loginBtn
          )}
        </Button>
      </form>
    </AuthLayout>
  );
}