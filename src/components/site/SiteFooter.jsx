import React from "react";
import { Link } from "@tanstack/react-router";
import { Gavel } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export default function SiteFooter() {
  const { t, dir } = useI18n();
  const year = new Date().getFullYear();


  return (
    <footer className="border-t border-border bg-card text-foreground" dir={dir}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12 grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-primary text-primary-foreground grid place-items-center"><Gavel className="w-5 h-5" /></div>
            <span className="font-display font-extrabold text-lg">{t.brand}</span>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">{t.site.footer.about}</p>
        </div>
        <div className="space-y-2.5">
          <h3 className="font-bold text-sm">{t.site.footer.explore}</h3>
          <ul className="space-y-1.5 text-sm text-muted-foreground">
            <li><a href="#auctions" className="hover:text-primary transition-colors">{t.site.nav.auctions}</a></li>
            <li><a href="#how" className="hover:text-primary transition-colors">{t.site.nav.howItWorks}</a></li>
            <li><a href="#about" className="hover:text-primary transition-colors">{t.site.nav.about}</a></li>
            <li><a href="#contact" className="hover:text-primary transition-colors">{t.site.nav.contact}</a></li>
          </ul>
        </div>
        <div className="space-y-2.5">
          <h3 className="font-bold text-sm">{t.site.footer.accountTitle}</h3>
          <ul className="space-y-1.5 text-sm text-muted-foreground">
            <li><Link to="/login" className="hover:text-primary transition-colors">{t.auth.login}</Link></li>
            <li><Link to="/register" className="hover:text-primary transition-colors">{t.auth.register}</Link></li>
            <li><Link to="/wallet" className="hover:text-primary transition-colors">{t.nav.wallet}</Link></li>
            <li><Link to="/account" className="hover:text-primary transition-colors">{t.nav.account}</Link></li>
          </ul>
        </div>
        <div className="space-y-2.5">
          <h3 className="font-bold text-sm">{t.site.footer.legal}</h3>
          <ul className="space-y-1.5 text-sm text-muted-foreground">
            <li><Link to="/privacy" className="hover:text-primary transition-colors">{t.site.footer.privacy}</Link></li>
            <li><Link to="/terms" className="hover:text-primary transition-colors">{t.site.footer.terms}</Link></li>
          </ul>

        </div>
      </div>
      <div className="border-t border-border">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted-foreground">
          <p>© {year} {t.brand}. {t.site.footer.rights}</p>
          <p>{t.site.footer.madeWith}</p>
        </div>
      </div>


    </footer>
  );
}