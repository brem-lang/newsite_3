import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Shield, LogOut, ArrowLeft, X, ChevronDown, Search } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { sectionLabel, SECTIONS } from "@/lib/adminNav";
import { Button } from "@/components/ui/button";

export default function AdminSidebar({ groups, basePath, active, activeGroup, onLogout, onClose, onSearch, className }) {
  const { t, dir } = useI18n();
  const backRotate = dir === "rtl" ? "rotate-180" : "";
  const [open, setOpen] = useState(() => ({ [activeGroup]: true }));

  useEffect(() => { setOpen((s) => ({ ...s, [activeGroup]: true })); }, [activeGroup]);

  return (
    <aside className={cn("w-64 shrink-0 flex flex-col border-e border-sidebar-border bg-sidebar text-sidebar-foreground shadow-[12px_0_45px_-28px_hsl(var(--accent)/0.7)]", className)}>
      <div className="h-16 flex items-center gap-2.5 px-5 border-b border-border shrink-0">
        <div className="gold-button w-9 h-9 rounded-lg grid place-items-center">
          <Shield className="w-5 h-5" />
        </div>
        <div className="leading-tight min-w-0 flex-1">
          <p className="font-display font-semibold truncate">{t.brand}</p>
          <p className="text-xs text-muted-foreground">{t.admin.panelTitle}</p>
        </div>
        {onClose && (
          <Button variant="ghost" size="iconSm" onClick={onClose} aria-label={t.common.cancel}>
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>

      {onSearch && (
        <div className="p-3 pb-0">
          <Button
            variant="outline"
            onClick={onSearch}
            className="w-full justify-start gap-2 text-muted-foreground"
          >
            <Search className="w-4 h-4" />
            <span className="flex-1 text-start">{t.admin.search || "Search"}</span>
            <kbd className="text-[10px] font-mono rounded border border-border px-1 py-0.5">⌘K</kbd>
          </Button>
        </div>
      )}

      <nav className="flex-1 p-3 space-y-1.5 overflow-y-auto">
        {groups.map((g) => {
          const GroupIcon = g.icon;
          const isOpen = !!open[g.id];
          const hasActive = g.items.includes(active);
          return (
            <div key={g.id} className="space-y-1">
              <Button
                variant="ghost"
                onClick={() => setOpen((s) => ({ ...s, [g.id]: !s[g.id] }))}
                aria-expanded={isOpen}
                className={cn(
                  "w-full justify-start gap-2.5 px-3 text-sm font-semibold",
                  hasActive ? "text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                )}
              >
                <GroupIcon className="w-4 h-4 shrink-0" />
                <span className="flex-1 text-start truncate">{g.label(t)}</span>
                <ChevronDown className={cn("w-4 h-4 transition-transform", isOpen && "rotate-180")} />
              </Button>

              {isOpen && (
                <div className="ps-3 space-y-0.5">
                  {g.items.map((id) => {
                    const Icon = SECTIONS[id]?.icon || Shield;
                    return (
                      <Link
                        key={id}
                        to={`${basePath}/${id}`}
                        onClick={onClose}
                        className={cn(
                          "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                          active === id
                             ? "bg-accent/10 text-accent ring-1 ring-accent/35 shadow-[0_0_18px_-8px_hsl(var(--accent)/0.8)]"
                             : "text-muted-foreground hover:text-accent hover:bg-sidebar-accent/70"
                        )}
                      >
                        <Icon className="w-4 h-4 shrink-0" />
                        <span className="truncate">{sectionLabel(t, id)}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div className="p-3 border-t border-border space-y-1 shrink-0">
        <Link to="/" className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/60">
          <ArrowLeft className={cn("w-4 h-4", backRotate)} />
          {t.admin.backToSite}
        </Link>
        <Button variant="ghost" onClick={onLogout} className="w-full justify-start gap-2.5 px-3 text-sm font-medium hover:bg-destructive/10 hover:text-destructive">
          <LogOut className="w-4 h-4" />
          {t.common.logout}
        </Button>
      </div>
    </aside>
  );
}
