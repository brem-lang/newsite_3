import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/format";

export default function NotificationBell() {
  const { t, format } = useI18n();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => { base44.auth.me().then(setUser).catch(() => {}); }, []);

  useEffect(() => {
    if (!user) return;
    const load = () => base44.entities.Notification
      .filter({ channel: "inapp", user_id: user.id, read: false }, "-created_date", 20)
      .then((list) => setItems((list || []).filter((n) => n.type !== "chat"))).catch(() => {});
    load();
    const unsub = base44.entities.Notification.subscribe((ev) => {
      if (ev.type === "create") load();
    });
    return unsub;
  }, [user]);

  const markAll = async () => {
    const snapshot = items;
    setItems([]);
    await Promise.all(snapshot.map((n) => base44.entities.Notification.update(n.id, { read: true }).catch(() => {})));
  };

  if (!user) return null;
  const unread = items.length;

  return (
    <div className="relative">
      <Button variant="ghost" size="icon" onClick={() => setOpen((o) => !o)} title={t.notifications.title} className="border border-border/70 bg-card/70 text-accent">
        <Bell className="w-4 h-4" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -end-0.5 min-w-4 h-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold grid place-items-center">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </Button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="native-panel fixed sm:absolute inset-x-3 top-[68px] sm:inset-x-auto sm:top-auto sm:end-0 sm:mt-2 sm:w-80 max-w-[calc(100vw-1.5rem)] rounded-xl z-50 max-h-[70vh] sm:max-h-96 overflow-y-auto overflow-x-hidden text-start">

            <div className="flex items-center justify-between px-4 py-3 border-b border-border sticky top-0 bg-card">
              <span className="text-sm font-semibold">{t.notifications.title}</span>
              {unread > 0 && (
                <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={markAll}>
                  {t.notifications.markAll}
                </Button>
              )}
            </div>
            {items.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">{t.notifications.empty}</div>
            ) : (
              items.map((n) => {
                const isOutbid = n.title === "OUTBID";
                const displayTitle = isOutbid ? t.notifications.outbid : n.title;
                const displayBody = isOutbid ? format(t.notifications.outbidBody, { title: n.body }) : n.body;
                const clickable = isOutbid && n.auction_id;
                return (
                  <div
                    key={n.id}
                    onClick={() => clickable && (setOpen(false), navigate(`/auction/${n.auction_id}`))}
                    className={`px-4 py-3 border-b border-border/60 hover:bg-secondary/30 ${clickable ? "cursor-pointer" : ""}`}
                  >
                    <p className="text-sm font-medium break-words">{displayTitle}</p>
                    {displayBody && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-3 break-words">{displayBody}</p>}
                    <p className="text-[10px] text-muted-foreground/70 mt-1" dir="ltr">{formatDateTime(n.created_date)}</p>

                  </div>
                );
              })
            )}
          </div>
        </>
      )}
    </div>
  );
}