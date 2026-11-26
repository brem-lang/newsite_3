import React, { useState, useEffect, useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserPlus, Mail, Lock, Loader2, User, Globe, Phone } from "lucide-react";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import AuthLayout from "@/components/AuthLayout";
import { toast } from "@/components/ui/use-toast";
import { postLoginDest } from "@/lib/authReturnTo";
import { useI18n } from "@/lib/i18n";
import { countryList, countryName, detectCountryFromIp, dialCode, dialCodeList } from "@/lib/countries";
import SelectField from "@/components/ui/select-field";
import { cn } from "@/lib/utils";

export default function Register() {
  const { t, lang } = useI18n();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [countryCode, setCountryCode] = useState("");
  const [phoneCode, setPhoneCode] = useState("");
  const [phone, setPhone] = useState("");
  const [detecting, setDetecting] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showOtp, setShowOtp] = useState(false);
  const [otpCode, setOtpCode] = useState("");

  const countries = useMemo(() => countryList(lang), [lang]);
  const dials = useMemo(() => dialCodeList(lang), [lang]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const code = await detectCountryFromIp();
      if (cancelled) return;
      if (code) {
        setCountryCode((prev) => prev || code);
        setPhoneCode((prev) => prev || dialCode(code));
      }
      setDetecting(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (password !== confirmPassword) {
      setError(t.authp.pwMismatch);
      return;
    }
    if (!firstName.trim() || !lastName.trim()) {
      setError(t.authp.needNames);
      return;
    }
    if (!countryCode) {
      setError(t.authp.needCountry);
      return;
    }
    const phoneDigits = phone.replace(/\D/g, "");
    if (!phoneCode || phoneDigits.length < 6) {
      setError(t.authp.needPhone);
      return;
    }
    setLoading(true);
    try {
      const result = await base44.auth.register({
        email,
        password,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        country: countryName(countryCode, "en"),
        countryCode,
        phone: `${phoneCode} ${phoneDigits}`,
        phoneCountryCode: phoneCode,
        phoneNumber: phoneDigits,
      });
      // Signups are confirmed instantly, so a session comes back right away:
      // go straight into the app instead of asking for a verification code.
      if (result?.session) {
        window.location.href = postLoginDest();
        return;
      }
      setShowOtp(true);

    } catch (err) {
      setError(err.message || t.authp.registerFailed);
    } finally {
      setLoading(false);
    }
  };


  const handleVerify = async () => {
    setError("");
    setLoading(true);
    try {
      const result = await base44.auth.verifyOtp({ email, otpCode });
      if (result?.access_token) {
        base44.auth.setToken(result.access_token);
      }
      window.location.href = postLoginDest();
    } catch (err) {
      setError(err.message || t.authp.invalidCode);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setError("");
    try {
      await base44.auth.resendOtp(email);
      toast({
        title: t.authp.codeSent,
        description: t.authp.codeSentDesc,
      });
    } catch (err) {
      setError(err.message || t.authp.resendFailed);
    }
  };

  if (showOtp) {
    return (
      <AuthLayout
        icon={Mail}
        title={t.authp.verifyTitle}
        subtitle={t.authp.verifySubtitle.replace("{email}", email)}
      >
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
            {error}
          </div>
        )}
        <div className="flex justify-center mb-6">
          <InputOTP
            maxLength={6}
            value={otpCode}
            onChange={setOtpCode}
            autoFocus
            autoComplete="one-time-code"
          >
            <InputOTPGroup>
              <InputOTPSlot index={0} />
              <InputOTPSlot index={1} />
              <InputOTPSlot index={2} />
              <InputOTPSlot index={3} />
              <InputOTPSlot index={4} />
              <InputOTPSlot index={5} />
            </InputOTPGroup>
          </InputOTP>
        </div>
        <Button
          className="w-full h-12 gold-button text-base font-bold"
          onClick={handleVerify}
          disabled={loading || otpCode.length < 6}
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              {t.authp.verifying}
            </>
          ) : (
            t.authp.verifyBtn
          )}
        </Button>
        <p className="text-center text-sm text-muted-foreground mt-4">
          {t.authp.noCode}{" "}
          <Button variant="link" size="sm" onClick={handleResend} className="h-auto p-0 align-baseline">
            {t.authp.resend}
          </Button>
        </p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      compact
      icon={UserPlus}
      title={t.authp.registerTitle}
      subtitle={t.authp.registerSubtitle}
      footer={
        <>
          {t.authp.haveAccount}{" "}
          <Link
            to="/login"
            search={postLoginDest() !== "/" ? { returnTo: postLoginDest() } : {}}
            className="text-primary font-medium hover:underline"
          >
            {t.auth.login}
          </Link>
        </>
      }
    >
      {error && (
        <div role="alert" className="mb-3 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </div>
      )}

      {/* Fixed-height layout: pairs share a row (names, country + phone on
          desktop, both passwords) so the whole form fits one screen. */}
      <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-x-3 gap-y-3">
        <FormField id="firstName" label={t.authp.firstName} icon={User}>
          <Input
            id="firstName"
            autoComplete="given-name"
            autoFocus
            placeholder={t.authp.firstNamePlaceholder}
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            className={cn(inputCls, "pl-9")}
            required
          />
        </FormField>
        <FormField id="lastName" label={t.authp.lastName}>
          <Input
            id="lastName"
            autoComplete="family-name"
            placeholder={t.authp.lastNamePlaceholder}
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            className={inputCls}
            required
          />
        </FormField>

        <FormField
          id="country"
          label={t.authp.country}
          icon={detecting ? Loader2 : Globe}
          iconSpin={detecting}
          className="col-span-2 sm:col-span-1"
        >
          <SelectField
            id="country"
            value={countryCode}
            onChange={(e) => {
              setCountryCode(e.target.value);
              const d = dialCode(e.target.value);
              if (d) setPhoneCode(d);
            }}
            autoComplete="country"
            required
            title={countryCode ? t.authp.detectedNote : undefined}
            className={cn(selectCls, "w-full pl-9 pr-3")}
          >
            <option value="" disabled>
              {detecting ? t.authp.detecting : t.authp.selectCountry}
            </option>
            {countries.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </SelectField>
        </FormField>

        <div className="col-span-2 sm:col-span-1 space-y-1">
          <Label htmlFor="phone" className="text-xs">{t.authp.phone}</Label>
          <div className="flex gap-2">
            <SelectField
              id="phoneCode"
              dir="ltr"
              aria-label={t.authp.phoneCodeLabel}
              value={phoneCode}
              onChange={(e) => setPhoneCode(e.target.value)}
              required
              className={cn(selectCls, "w-[5.5rem] shrink-0 px-2")}
            >
              <option value="" disabled>+</option>
              {dials.map((c) => (
                <option key={c.code} value={c.dial}>{`${c.dial} ${c.code}`}</option>
              ))}
            </SelectField>
            <div className="relative min-w-0 flex-1">
              <Phone className={iconCls} aria-hidden="true" />
              <Input
                id="phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel-national"
                placeholder="790000000"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className={cn(inputCls, "pl-9")}
                required
              />
            </div>
          </div>
        </div>

        <FormField id="email" label={t.authp.email} icon={Mail} className="col-span-2">
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder={t.authp.emailPlaceholder}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={cn(inputCls, "pl-9")}
            required
          />
        </FormField>

        <FormField id="password" label={t.authp.password} icon={Lock}>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={cn(inputCls, "pl-9")}
            required
          />
        </FormField>
        <FormField id="confirm" label={t.authp.confirmPassword} icon={Lock}>
          <Input
            id="confirm"
            type="password"
            autoComplete="new-password"
            placeholder="••••••••"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className={cn(inputCls, "pl-9")}
            required
          />
        </FormField>

        <p className="col-span-2 -mt-1 text-[11px] leading-snug text-muted-foreground">{t.authp.phoneNote}</p>

        <Button type="submit" className="col-span-2 h-11 gold-button text-base font-bold" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              {t.authp.creating}
            </>
          ) : (
            t.authp.createBtn
          )}
        </Button>
      </form>
    </AuthLayout>
  );
}

const inputCls = "h-11";
const selectCls =
  "h-11 rounded-md border border-input bg-background text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const iconCls = "pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground";

/** Label + input with an optional leading icon, sized for the compact form. */
function FormField({ id, label, icon: Icon, iconSpin = false, className, children }) {
  return (
    <div className={cn("min-w-0 space-y-1", className)}>
      <Label htmlFor={id} className="text-xs">{label}</Label>
      <div className="relative">
        {Icon ? <Icon className={cn(iconCls, iconSpin && "animate-spin")} aria-hidden="true" /> : null}
        {children}
      </div>
    </div>
  );
}
