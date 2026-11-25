import React, { useEffect, useState, useCallback, useMemo } from "react";
import { Search, Contact, PauseCircle, PlayCircle, Gift } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAdminMe, adminUserListQuery, fetchAdminUserIds, ADMIN_USER_LIST_KEY, adminLookups, warmAdmin } from "@/lib/queries/admin";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import ParticipantDetailDialog from "@/components/admin/ParticipantDetailDialog";
import AdminPagination from "@/components/admin/AdminPagination";


const statusStyle = {
  pending: "bg-warning/15 text-warning",
  verified: "bg-success/15 text-success",
  rejected: "bg-destructive/15 text-destructive"
};

const NONE = [];
const NO_MAP = {};

/** Route loader: users (shared with the Users panel) and the staff profile. */
export const prefetch = (qc) => warmAdmin(qc, adminUserListQuery(), adminLookups.me());

export default function AdminParticipants() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const me = useAdminMe();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const search = useDebouncedValue(query.trim());
  useEffect(() => { setPage(1); }, [search, statusFilter, roleFilter, pageSize]);

  // Search, filters, paging and super-admin hiding all run on the server (listUsers).
  const listParams = { page, pageSize, search, status: statusFilter, role: roleFilter };
  const usersQuery = useQuery(adminUserListQuery(listParams));
  const visible = usersQuery.data?.users ?? NONE;
  const total = usersQuery.data?.total ?? 0;
  const loading = usersQuery.isPending;
  // Optimistic edits go straight into the cached page.
  const setUsers = (update) =>
    qc.setQueryData(adminUserListQuery(listParams).queryKey, (prev) => (prev ? { ...prev, users: update(prev.users) } : prev));
  const noteCounts = useMemo(() => {
    const counts = {};
    (usersQuery.data?.notes || []).forEach((n) => { counts[n.user_id] = (counts[n.user_id] || 0) + 1; });
    return counts;
  }, [usersQuery.data]);
  const [selected, setSelected] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const isSuper = !!me?.is_super;

  const load = useCallback(() => qc.invalidateQueries({ queryKey: ADMIN_USER_LIST_KEY }), [qc]);

  const togglePause = async (u) => {
    setBusyId(u.id);
    try {
      const res = await base44.functions.invoke("pauseUser", { user_id: u.id, pause: !u.paused });
      if (res.data?.error) throw new Error(res.data.error);
      toast.success(u.paused ? t.admin.users.unpaused : t.admin.users.paused);
      setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, paused: !u.paused } : x)));
    } catch (e) {
      toast.error(e.message || "Error");
    } finally {
      setBusyId(null);
    }
  };

  // ---- bulk selection + free bid grant ----
  const [picked, setPicked] = useState(() => new Set());
  const [auctions, setAuctions] = useState([]);
  const [bulkAuction, setBulkAuction] = useState("");
  const [bulkCount, setBulkCount] = useState("1");
  const [granting, setGranting] = useState(false);

  useEffect(() => {
    base44.entities.Auction.listFields("id,title,status,mode,round", "-created_date", 200)
      .then((rows) => setAuctions(rows || []))
      .catch(() => {});
  }, []);

  const toggleOne = (id) => setPicked((prev) => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });
  const allVisiblePicked = visible.length > 0 && visible.every((u) => picked.has(u.id));
  const toggleAllVisible = () => setPicked((prev) => {
    const next = new Set(prev);
    if (allVisiblePicked) visible.forEach((u) => next.delete(u.id));
    else visible.forEach((u) => next.add(u.id));
    return next;
  });
  // Every match across all pages, fetched as ids only.
  const selectAllFiltered = async () => {
    try {
      const ids = await fetchAdminUserIds({ search, status: statusFilter, role: roleFilter });
      setPicked(new Set(ids));
    } catch (e) {
      toast.error(e.message || "Error");
    }
  };

  const grantFreeBids = async () => {
    if (!bulkAuction) { toast.error(t.admin.participants.bulk.needAuction); return; }
    const count = Math.max(1, Math.floor(Number(bulkCount) || 1));
    setGranting(true);
    try {
      const res = await base44.functions.invoke("grantBidCredits", {
        auction_id: bulkAuction,
        user_ids: [...picked],
        count
      });
      if (res.data?.error) throw new Error(res.data.error);
      toast.success(`${t.admin.participants.bulk.granted} (${picked.size} × ${count})`);
      setPicked(new Set());
    } catch (e) {
      toast.error(e.message || "Error");
    } finally {
      setGranting(false);
    }
  };



  if (loading) return null;

  const st = t.admin.participants;
  const vSt = t.admin.verification.status;

  return (
    <div className="space-y-6 admin-fill">
      <div className="admin-page-header">
        <h1 className="font-heading text-2xl font-bold tracking-tight flex items-center gap-2"><Contact className="w-6 h-6" />{st.title}</h1>
        <p className="text-muted-foreground mt-1 text-sm">{st.subtitle}</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full sm:max-w-md">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={st.search} className="ps-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder={st.filterStatus} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{st.all}</SelectItem>
            <SelectItem value="pending">{vSt.pending}</SelectItem>
            <SelectItem value="verified">{vSt.verified}</SelectItem>
            <SelectItem value="rejected">{vSt.rejected}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder={st.filterRole} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{st.all}</SelectItem>
            <SelectItem value="user">{st.roleUser}</SelectItem>
            <SelectItem value="admin">{st.roleAdmin}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {picked.size > 0 && (
        <div className="rounded-2xl border border-primary/30 bg-primary/5 p-3 flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold px-1">{picked.size} {st.bulk.selected}</span>
          <Button size="sm" variant="ghost" onClick={selectAllFiltered}>{st.bulk.selectAll} ({total})</Button>
          <Button size="sm" variant="ghost" onClick={() => setPicked(new Set())}>{st.bulk.clear}</Button>
          <div className="flex-1" />
          <Select value={bulkAuction} onValueChange={setBulkAuction}>
            <SelectTrigger className="w-[240px]"><SelectValue placeholder={st.bulk.pickAuction} /></SelectTrigger>
            <SelectContent>
              {auctions.map((a) => (
                <SelectItem key={a.id} value={a.id}>{a.title} — {a.status}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            type="number" min="1" max="100" value={bulkCount}
            onChange={(e) => setBulkCount(e.target.value)}
            className="w-20" aria-label={st.bulk.bids}
          />
          <Button size="sm" disabled={granting} onClick={grantFreeBids} className="gap-1.5">
            <Gift className="w-4 h-4" />{granting ? st.bulk.granting : st.bulk.grant}
          </Button>
        </div>
      )}

      {total === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center text-muted-foreground">{st.empty}</div>
      ) : (
        <div className={cn("admin-table-card rounded-2xl border border-border bg-card overflow-hidden", usersQuery.isPlaceholderData && "opacity-60")}>
          <div className="admin-table-scroll">
            <table className="w-full text-sm">
              <thead className="bg-secondary/50 text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 w-10">
                    <Checkbox checked={allVisiblePicked} onCheckedChange={toggleAllVisible} aria-label={st.bulk.selectAll} />
                  </th>
                  <th className="text-start font-medium px-4 py-3">{st.colName}</th>
                  <th className="text-start font-medium px-4 py-3">{st.colEmail}</th>
                  <th className="text-start font-medium px-4 py-3">{st.colPhone}</th>
                  <th className="text-start font-medium px-4 py-3">{st.colCountry}</th>
                  <th className="text-start font-medium px-4 py-3">{st.colIp}</th>
                  <th className="text-start font-medium px-4 py-3">{st.colRegistered}</th>
                  <th className="text-start font-medium px-4 py-3">{st.colStatus}</th>
                  <th className="text-start font-medium px-4 py-3">{st.colNotes}</th>
                  <th className="text-end font-medium px-4 py-3">{st.colActions}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {visible.map((u) => {
                  const v = u.verification_status || "pending";
                  return (
                    <tr key={u.id} className={cn("hover:bg-secondary/30", picked.has(u.id) && "bg-primary/5")}>
                      <td className="px-4 py-3">
                        <Checkbox checked={picked.has(u.id)} onCheckedChange={() => toggleOne(u.id)} aria-label={u.email || u.id} />
                      </td>
                      <td className="px-4 py-3 font-medium">{u.full_name || u.email?.split("@")[0] || "—"}</td>

                      <td className="px-4 py-3 text-muted-foreground truncate max-w-[180px]">{u.email || "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{u.phone || "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{u.country || "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground font-mono text-xs whitespace-nowrap">{u.ip || "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{u.created_date ? new Date(u.created_date).toLocaleDateString("en-GB") : "—"}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={cn("inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full", statusStyle[v])}>{vSt[v]}</span>
                          {u.paused && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-destructive/15 text-destructive">
                              <PauseCircle className="w-3 h-3" />{t.admin.users.pausedBadge}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{noteCounts[u.id] ? `${noteCounts[u.id]}` : "—"}</td>
                      <td className="px-4 py-3 text-end">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="sm"
                            variant={u.paused ? "outline" : "destructive"}
                            disabled={busyId === u.id || (u.is_super && !isSuper)}
                            onClick={() => togglePause(u)}
                            className="gap-1.5"
                          >
                            {u.paused ? <PlayCircle className="w-4 h-4" /> : <PauseCircle className="w-4 h-4" />}
                            {u.paused ? t.admin.users.unpause : t.admin.users.pause}
                          </Button>
                          <Button size="sm" onClick={() => setSelected(u)}>{st.actions}</Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <AdminPagination
            page={page} pageSize={pageSize} total={total}
            onPage={setPage} onPageSize={setPageSize}
          />
        </div>
      )}

      <ParticipantDetailDialog
        participant={selected}
        open={!!selected}
        onOpenChange={(o) => !o && setSelected(null)}
        onUpdate={load}
      />
    </div>
  );
}