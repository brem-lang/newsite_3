import React from "react";
import { Search, SlidersHorizontal } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export default function AuctionFilters({ tabs, activeTab, onTab, sorts, activeSort, onSort, search, onSearch }) {
  const { t } = useI18n();
  const h = t.hub;

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
          {tabs.map((tab) => {
            const active = tab.id === activeTab;
            return (
              <Button
                key={tab.id}
                type="button"
                variant={active ? "gold" : "ghost"}
                size="sm"
                onClick={() => onTab(tab.id)}
                className={cn(
                  "relative shrink-0 rounded-xl px-3.5 text-sm font-bold",
                  !active && "border border-transparent text-muted-foreground hover:border-accent/30"
                )}
              >
                <span className="relative flex items-center gap-1.5">
                  {tab.label}
                  <span className={cn("rounded-md px-1.5 py-0.5 text-[10px] font-bold leading-none", active ? "bg-primary-foreground/15 text-primary-foreground" : "bg-secondary text-muted-foreground")}>
                    {tab.count}
                  </span>
                </span>
              </Button>
            );
          })}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Select value={activeSort} onValueChange={onSort}>
            <SelectTrigger className="w-40 sm:w-48 h-9 text-xs gap-2">
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {sorts.map((s) => (
                <SelectItem key={s.id} value={s.id} className="text-xs">{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder={h.filters.search}
          className="pl-10 h-10 bg-card border-border"
        />
      </div>
    </div>
  );
}