import React, { useEffect, useState } from "react";
import { BellRing } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";
import { systemEventsQuery } from "@/lib/queries/admin";
import { adminKeys } from "@/lib/queries/keys";
import { describeEvent } from "@/lib/lifecycleEvents";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const SEEN_KEY = "admin.systemEvents.seen";
const NONE = [];

/**
 * Admin header bell for changes nobody clicked: an auction started on its
 * first join or schedule, ended on its timer, was cancelled for too few
 * participants, or nothing is left open or live. New ones arrive live
 * (activity_logs over realtime) and also show a toast; the badge counts
 * those not opened yet.
 */
export default function AdminSystemEvents() {
  const { t } = useI18n();
  const L = t.admin.lifecycle;
  const qc = useQueryClient();
  const { data: events = NONE, isPending } = useQuery(systemEventsQuery());
  const [seen, setSeen] = useState(() => Number(localStorage.getItem(SEEN_KEY)) || 0);

  useEffect(
    () =>
      base44.entities.ActivityLog.subscribe(
        ({ data, type }) => {
          if (type !== "create" || data?.source !== "system") return;
          qc.setQueryData(systemEventsQuery().queryKey, (prev = []) =>
            [data, ...prev.filter((e) => e.id !== data.id)].slice(0, 30),
          );
          const ev = describeEvent(data, t);
          toast(ev.label, { description: ev.detail });
          // Lists showing this auction are now stale.
          qc.invalidateQueries({ queryKey: adminKeys.auctionsAll() });
        },
        { filter: "source=eq.system", onReconnect: () => qc.invalidateQueries({ queryKey: systemEventsQuery().queryKey }) },
      ),
    [qc, t],
  );

  const unread = events.filter((e) => new Date(e.created_date).getTime() > seen).length;
  // New entries stay highlighted while the list is open; closing marks them seen.
  const markSeen = (open) => {
    if (open || !events.length) return;
    const latest = new Date(events[0].created_date).getTime();
    localStorage.setItem(SEEN_KEY, String(latest));
    setSeen(latest);
  };

  if (isPending) return null;

  return (
    <Popover onOpenChange={markSeen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label={L.bellTitle} title={L.bellTitle}>
          <BellRing className="w-4 h-4" />
          {unread > 0 && (
            <span className="absolute top-1.5 end-1.5 min-w-4 h-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold grid place-items-center tabular-nums">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <p className="px-4 py-3 border-b border-border text-sm font-semibold">{L.bellTitle}</p>
        {events.length === 0 ? (
          <p className="px-4 py-6 text-xs text-muted-foreground">{L.bellEmpty}</p>
        ) : (
          <ol className="max-h-96 overflow-y-auto divide-y divide-border">
            {events.map((e) => {
              const ev = describeEvent(e, t);
              const isNew = new Date(e.created_date).getTime() > seen;
              return (
                <li key={e.id} className={cn("px-4 py-2.5 text-xs", isNew && "bg-accent/5")}>
                  <div className="flex items-center justify-between gap-2">
                    <span className={cn("font-semibold", ev.recovered && "text-warning")}>{ev.label}</span>
                    <span className="text-muted-foreground tabular-nums">{new Date(e.created_date).toLocaleString("en-GB")}</span>
                  </div>
                  {ev.detail && <p className="mt-0.5 text-muted-foreground">{ev.detail}</p>}
                </li>
              );
            })}
          </ol>
        )}
      </PopoverContent>
    </Popover>
  );
}
