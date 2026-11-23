import React, { useState } from "react";
import { Mail, MessageCircle, Bell, ListFilter } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useAdminData, useAdminUserMap, adminSection, warmAdmin, adminLookups } from "@/lib/queries/admin";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const NONE = [];

const loadSection = async () => (await base44.entities.Notification.list("-created_date", 500)) || [];

/** Route loader: everything this panel paints, before it opens. */
export const prefetch = (qc) => warmAdmin(qc, adminSection(["notifications"], loadSection), adminLookups.users());

export default function AdminNotifications() {
  const { t } = useI18n();
  const { data: items = NONE, isPending: loading } = useAdminData(["notifications"], loadSection);
  const [channel, setChannel] = useState("all");
  const users = useAdminUserMap();


  const filtered = channel === "all" ? items : items.filter((n) => n.channel === channel);

  const channelMeta = (c) => ({
    inapp: { icon: Bell, label: t.admin.notificationsLog.chInapp, tint: "text-info bg-info/10" },
    email: { icon: Mail, label: t.admin.notificationsLog.chEmail, tint: "text-success bg-success/10" },
    whatsapp: { icon: MessageCircle, label: t.admin.notificationsLog.chWhatsapp, tint: "text-success bg-success/10" }
  })[c] || { icon: Bell, label: c, tint: "bg-secondary" };

  const statusMeta = (s) => ({
    sent: { label: t.admin.notificationsLog.stSent, cls: "text-success" },
    failed: { label: t.admin.notificationsLog.stFailed, cls: "text-destructive" },
    pending: { label: t.admin.notificationsLog.stPending, cls: "text-warning" }
  })[s] || { label: s, cls: "text-muted-foreground" };

  if (loading) return null;

  const tabs = [
    { id: "all", label: t.admin.notificationsLog.all },
    { id: "inapp", label: t.admin.notificationsLog.chInapp },
    { id: "email", label: t.admin.notificationsLog.chEmail },
    { id: "whatsapp", label: t.admin.notificationsLog.chWhatsapp }
  ];

  return (
    <div className="space-y-6 admin-fill">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight flex items-center gap-2"><ListFilter className="w-6 h-6" />{t.admin.notificationsLog.title}</h1>
          <p className="text-muted-foreground mt-1 text-sm">{t.admin.notificationsLog.subtitle}</p>
        </div>
        <div className="flex gap-1 bg-secondary/60 rounded-xl p-1">
          {tabs.map((tab) => (
            <button key={tab.id} onClick={() => setChannel(tab.id)}
              className={cn("px-3 py-1.5 rounded-lg text-xs font-medium", channel === tab.id ? "bg-background text-foreground shadow-sm" : "text-muted-foreground")}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center text-muted-foreground">{t.admin.notificationsLog.empty}</div>
      ) : (
        <div className="admin-table-card rounded-2xl border border-border bg-card overflow-hidden">
          <div className="admin-table-scroll">
            <table className="w-full text-sm">
              <thead className="bg-secondary/50 text-muted-foreground">
                <tr>
                  <th className="text-start font-medium px-4 py-3">{t.admin.notificationsLog.colTo}</th>
                  <th className="text-start font-medium px-4 py-3">{t.admin.notificationsLog.colChannel}</th>
                  <th className="text-start font-medium px-4 py-3">{t.admin.notificationsLog.colTitle}</th>
                  <th className="text-start font-medium px-4 py-3">{t.admin.notificationsLog.colStatus}</th>
                  <th className="text-start font-medium px-4 py-3">{t.admin.notificationsLog.colDate}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((n) => {
                  const u = users[n.user_id];
                  const cm = channelMeta(n.channel);
                  const sm = statusMeta(n.status);
                  const CIcon = cm.icon;
                  return (
                    <tr key={n.id} className="hover:bg-secondary/30">
                      <td className="px-4 py-3">{u ? (u.full_name || u.email) : n.recipient || `…${n.user_id?.slice(-4)}`}</td>
                      <td className="px-4 py-3">
                        <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full", cm.tint)}><CIcon className="w-3.5 h-3.5" />{cm.label}</span>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium truncate max-w-[260px]">{n.title}</p>
                        {n.body && <p className="text-xs text-muted-foreground truncate max-w-[260px]">{n.body}</p>}
                      </td>
                      <td className={cn("px-4 py-3 text-xs font-semibold", sm.cls)}>{sm.label}</td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{new Date(n.created_date).toLocaleString("en-GB")}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}