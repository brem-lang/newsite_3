import React, { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Gavel, LogOut, Wallet as WalletIcon, CircleUserRound } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useI18n } from "@/lib/i18n";
import { useWallet } from "@/lib/useWallet";
import NotificationBell from "@/components/NotificationBell";
import { Button } from "@/components/ui/button";

export default function SiteHeader() {
  const { t, dir } = useI18n();
  const [user, setUser] = useState(null);
  const { balance } = useWallet(user?.id, false);

  useEffect(() => { base44.auth.me().then(setUser).catch(() => setUser(null)); }, []);

  const links = [
    { href: "#auctions", label: t.site.nav.auctions },
    { href: "#how", label: t.site.nav.howItWorks },
    { href: "#about", label: t.site.nav.about },
    { href: "#contact", label: t.site.nav.contact }
  ];
  const logout = async () => { await base44.auth.logout(); window.location.href = "/"; };

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur-xl shadow-[0_8px_30px_-24px_hsl(var(--accent)/0.45)]" dir={dir}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-2 lg:gap-4">
        <Link to="/" className="flex items-center gap-2.5 shrink-0">
          <div className="w-9 h-9 rounded-xl bg-primary text-primary-foreground grid place-items-center shadow-lg shadow-primary/25"><Gavel className="w-5 h-5" /></div>
          <span className="theme-brand font-display font-extrabold text-lg tracking-tight text-foreground">{t.brand}</span>
        </Link>
        <nav className="hidden md:flex items-center gap-1">
          {links.map((l) => (
            <a key={l.href} href={l.href} className="px-2.5 lg:px-3.5 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-accent hover:bg-secondary transition-colors">{l.label}</a>
          ))}
        </nav>
        <div className="flex min-w-0 items-center gap-1.5 sm:gap-2 shrink-0">
          {user && <NotificationBell />}
          {user ? (
            <>
              <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary border border-border">
                <WalletIcon className="w-4 h-4 text-primary" />
                <span className="text-sm font-bold text-foreground">{t.common.currency}{balance.toFixed(2)}</span>
              </div>
              <Link to="/wallet" className="hidden sm:block"><Button variant="ghost" size="icon" className="text-muted-foreground" title={t.nav.wallet}><WalletIcon className="w-4 h-4" /></Button></Link>
              <Link to="/account"><Button variant="ghost" size="icon" className="text-muted-foreground" title={t.nav.account}><CircleUserRound className="w-4 h-4" /></Button></Link>
              <Button variant="ghost" size="icon" className="text-muted-foreground" onClick={logout} title={t.common.logout}><LogOut className="w-4 h-4" /></Button>
            </>
          ) : (
            <>
              <Link to="/login" className="hidden sm:block"><Button variant="ghost" className="text-muted-foreground">{t.auth.login}</Button></Link>
              <Link to="/register"><Button size="sm" className="font-bold h-9 px-4">{t.auth.register}</Button></Link>
            </>
          )}
        </div>
      </div>
      <nav className="md:hidden flex items-center gap-1 overflow-x-auto border-t border-border px-2 py-1.5">
        {links.map((l) => (<a key={l.href} href={l.href} className="px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:bg-secondary whitespace-nowrap">{l.label}</a>))}
      </nav>
    </header>
  );
}