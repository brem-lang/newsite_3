import React, { useEffect, useState, useCallback, useMemo } from "react";
import { Search, UserPlus, Mail, MessageCircle, Bell, ChevronDown, ChevronUp, Gavel, Wallet, Edit2, Trash2, PauseCircle, PlayCircle, ShieldCheck, KeyRound, Plus, Minus } from "lucide-react";
import { base44 } from "@/api/base44Client";
import AdminPagination, { paginate } from "@/components/admin/AdminPagination";
import { logAdminAction } from "@/lib/adminAudit";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { sendEmail, sendWhatsApp, sendInApp } from "@/lib/messaging";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogForm
} from "@/components/ui/dialog";
import EditUserDialog from "@/components/admin/EditUserDialog";
import PermissionsDialog from "@/components/admin/PermissionsDialog";

export default function AdminUsers() {
  const { t } = useI18n();
  const L = (o) => (o ? (typeof o === "string" ? o : o.en || "") : "");
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState(null);
  const [roles, setRoles] = useState([]);
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState(null);
  const [profile, setProfile] = useState({ bids: [], txns: [] });
  const [invite, setInvite] = useState(false);
  const [inviteForm, setInviteForm] = useState({ email: "", role: "user" });
  const [busy, setBusy] = useState(false);
  const [contact, setContact] = useState(null);
  const [msg, setMsg] = useState({ subject: "", body: "" });
  const [phoneEdit, setPhoneEdit] = useState(null);
  const [phoneValue, setPhoneValue] = useState("");
  const [editUser, setEditUser] = useState(null);
  const [permsUser, setPermsUser] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [balanceUser, setBalanceUser] = useState(null);
  const [balanceForm, setBalanceForm] = useState({ amount: "", note: "", dir: "credit" });

  const isSuper = !!me?.is_super;

  const load = useCallback(() => {
    Promise.all([
      base44.functions.invoke("listUsers"),
      base44.entities.Role.list("-created_date", 1000).catch(() => [])
    ]).then(([res, rList]) => {
      setUsers(res.data?.users || []);
      setRoles(rList || []);
    }).finally(() => setLoading(false));
  }, []);

  const roleOptions = useMemo(() => {
    const list = [
      { name: "user", is_system: true, description: "" },
      { name: "admin", is_system: true, description: "" }
    ];
    (roles || []).forEach((r) => {
      if (!list.find((x) => x.name === r.name)) list.push(r);
    });
    return list;
  }, [roles]);

  useEffect(() => {
    base44.adminAuth.me().then((u) => setMe(u)).catch(() => {});
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return users
      .filter((u) => isSuper || !u.is_super) // super admins are invisible to regular admins
      .filter((u) => !q || (u.full_name || "").toLowerCase().includes(q) || (u.email || "").toLowerCase().includes(q) || (u.phone || "").toLowerCase().includes(q));
  }, [users, query, isSuper]);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  useEffect(() => { setPage(1); }, [query]);
  const visible = useMemo(() => paginate(filtered, page, pageSize), [filtered, page, pageSize]);

  const openProfile = async (u) => {
    if (expanded === u.id) { setExpanded(null); return; }
    setExpanded(u.id);
    const [bids, txns] = await Promise.all([
      base44.entities.Bid.filter({ user_id: u.id }, "-created_date", 50),
      base44.entities.WalletTransaction.filter({ user_id: u.id }, "-created_date", 50)
    ]);
    setProfile({ bids, txns });
  };

  const changeRole = async (u, role) => {
    if (role === (u.staff_role || u.role) || !isSuper) return;
    try {
      const res = await base44.functions.invoke("updateUser", { user_id: u.id, role });
      if (res.data?.error) { toast.error(res.data.error); return; }
      logAdminAction("user.role_change", { targetType: "profiles", targetId: u.id, details: `${u.email} -> ${role}` });
      toast.success(t.admin.users.roleChanged);
      load();
    } catch (e) { toast.error(e.message || "Error"); }
  };

  const togglePause = async (u) => {
    try {
      const res = await base44.functions.invoke("pauseUser", { user_id: u.id, pause: !u.paused });
      if (res.data?.error) { toast.error(res.data.error); return; }
      logAdminAction(u.paused ? "user.unpause" : "user.pause", { targetType: "profiles", targetId: u.id, details: u.email });
      toast.success(u.paused ? t.admin.users.unpaused : t.admin.users.paused);
      load();
    } catch (e) { toast.error(e.message || "Error"); }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      const res = await base44.functions.invoke("deleteUser", { user_id: deleteTarget.id });
      if (res.data?.error) { toast.error(res.data.error); return; }
      logAdminAction("user.delete", { targetType: "profiles", targetId: deleteTarget.id, details: deleteTarget.email });
      toast.success(t.admin.users.deleted);
      setDeleteTarget(null);
      load();
    } catch (e) { toast.error(e.message || "Error"); }
    finally { setBusy(false); }
  };

  const handleInvite = async () => {
    if (!inviteForm.email) return;
    setBusy(true);
    try {
      await base44.users.inviteUser(inviteForm.email, inviteForm.role);
      toast.success(t.admin.users.invited);
      setInvite(false);
      setInviteForm({ email: "", role: "user" });
      load();
    } catch (e) { toast.error(e.message || "Error"); }
    finally { setBusy(false); }
  };

  const savePhone = async (u) => {
    try {
      await base44.entities.User.update(u.id, { phone: phoneValue });
      toast.success(t.admin.users.phoneSaved);
      setPhoneEdit(null);
      load();
    } catch (e) { toast.error(e.message || "Error"); }
  };

  const sendContact = async (channel) => {
    if (!contact) return;
    setBusy(true);
    try {
      if (channel === "email") await sendEmail(contact, msg.subject || t.admin.users.title, msg.body);
      else if (channel === "inapp") await sendInApp(contact, msg.subject || t.admin.users.title, msg.body, "info");
      else await sendWhatsApp(contact, msg.subject || t.admin.users.title, msg.body);
      toast.success(channel === "whatsapp" ? t.admin.broadcast.waNote : t.admin.users.sent);
      setContact(null);
      setMsg({ subject: "", body: "" });
    } catch (e) { toast.error(e.message || "Error"); }
    finally { setBusy(false); }
  };

  const applyAdjustment = async () => {
    const amount = parseFloat(balanceForm.amount);
    if (!balanceUser || !amount || amount <= 0) { toast.error("Enter a valid amount"); return; }
    setBusy(true);
    try {
      const signed = balanceForm.dir === "credit" ? amount : -amount;
      const verb = balanceForm.dir === "credit" ? "Credit" : "Debit";
      await base44.entities.WalletTransaction.create({
        user_id: balanceUser.id,
        type: "adjustment",
        amount: signed,
        description: `${verb} — ${balanceForm.note || "-"}`,
        notes: balanceForm.note || verb,
        status: "confirmed",
      });
      logAdminAction("wallet.adjust", { targetType: "profiles", targetId: balanceUser.id, details: `${balanceForm.dir} ${amount} — ${balanceForm.note || ""}` });
      toast.success("Balance updated");
      const ref = balanceUser;
      setBalanceUser(null);
      setBalanceForm({ amount: "", note: "", dir: "credit" });
      if (expanded === ref.id) openProfile(ref);
    } catch (e) { toast.error(e.message || "Error"); }
    finally { setBusy(false); }
  };

  if (loading) return <div className="h-64 grid place-items-center"><div className="w-8 h-8 border-4 border-muted border-t-foreground rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight">{t.admin.users.title}</h1>
          <p className="text-muted-foreground mt-1 text-sm">{t.admin.users.subtitle}</p>
        </div>
        <Button onClick={() => setInvite(true)} className="gap-2"><UserPlus className="w-4 h-4" />{t.admin.users.invite}</Button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t.admin.users.search} className="ps-9" />
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center text-muted-foreground">{t.admin.users.noUsers}</div>
      ) : (
        <div className="space-y-2">
          {visible.map((u) => {
            const isSuperRow = !!u.is_super;
            const isSelf = u.id === me?.id;
            const canEdit = !isSuperRow && !isSelf;
            const canManage = isSuper && !isSuperRow && !isSelf;
            return (
              <div key={u.id} className="rounded-2xl border border-border bg-card overflow-hidden">
                <div className="flex items-center gap-3 p-4">
                  <div className="w-10 h-10 rounded-full bg-secondary grid place-items-center text-sm font-bold text-muted-foreground shrink-0">
                    {(u.full_name || u.email || "?").charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate flex items-center gap-2 flex-wrap">
                      <span className="truncate">{u.full_name || "—"}</span>
                      {isSelf && <span className="text-xs text-muted-foreground">({t.auction.you})</span>}
                      {isSuperRow && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold rounded-full px-2 py-0.5 bg-primary/15 text-primary">
                          <ShieldCheck className="w-3 h-3" />{t.admin.users.roleSuper}
                        </span>
                      )}
                      {u.paused && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold rounded-full px-2 py-0.5 bg-destructive/15 text-destructive">
                          <PauseCircle className="w-3 h-3" />{t.admin.users.pausedBadge}
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">{u.email}{u.phone ? ` · ${u.phone}` : ""}</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <select
                      value={u.staff_role || u.role}
                      onChange={(e) => changeRole(u, e.target.value)}
                      disabled={!isSuper}
                      title={roleOptions.find((r) => r.name === (u.staff_role || u.role))?.description || ""}
                      className="text-xs font-semibold rounded-full border border-input bg-background px-2.5 py-1 focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-70 max-w-[140px] truncate"
                    >
                      {roleOptions.map((r) => (
                        <option key={r.name} value={r.name}>
                          {r.name === "user" ? t.admin.users.roleUser : r.name === "admin" ? t.admin.users.roleAdmin : r.name}
                        </option>
                      ))}
                    </select>
                    <div className="flex items-center gap-1 ms-1">
                      {canEdit && <Button variant="ghost" size="icon" onClick={() => setPermsUser(u)} title={t.admin.permissions.title}><KeyRound className="w-4 h-4" /></Button>}
                      {canEdit && <Button variant="ghost" size="icon" onClick={() => setEditUser(u)} title={t.admin.users.edit}><Edit2 className="w-4 h-4" /></Button>}
                      {canEdit && <Button variant="ghost" size="icon" onClick={() => { setBalanceUser(u); setBalanceForm({ amount: "", note: "", dir: "credit" }); }} title={"Adjust balance"}><Wallet className="w-4 h-4 text-success" /></Button>}
                      {canManage && <Button variant="ghost" size="icon" onClick={() => togglePause(u)} title={u.paused ? t.admin.users.unpause : t.admin.users.pause}>
                        {u.paused ? <PlayCircle className="w-4 h-4" /> : <PauseCircle className="w-4 h-4" />}
                      </Button>}
                      {canManage && <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(u)} title={t.admin.users.deleteUser}><Trash2 className="w-4 h-4 text-destructive" /></Button>}
                      {!isSuperRow && <Button variant="ghost" size="icon" onClick={() => setContact(u)} title={t.admin.users.sendEmail}><Mail className="w-4 h-4" /></Button>}
                      {!isSuperRow && <Button variant="ghost" size="icon" onClick={() => { setPhoneEdit(u); setPhoneValue(u.phone || ""); }} title={t.admin.users.sendWhatsapp}><MessageCircle className="w-4 h-4" /></Button>}
                      {!isSuperRow && <Button variant="ghost" size="icon" onClick={() => openProfile(u)} title={t.admin.users.viewProfile}>
                        {expanded === u.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </Button>}
                    </div>
                  </div>
                </div>

                {expanded === u.id && (
                  <div className="border-t border-border p-4 grid sm:grid-cols-2 gap-4 bg-muted/20">
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5"><Gavel className="w-3.5 h-3.5" />{t.admin.users.bidsCount} ({profile.bids.length})</p>
                      <div className="space-y-1 max-h-40 overflow-y-auto">
                        {profile.bids.length === 0 ? <p className="text-sm text-muted-foreground">—</p> : profile.bids.map((b) => (
                          <div key={b.id} className="text-sm flex justify-between"><span className="text-muted-foreground">{new Date(b.created_date).toLocaleDateString("en-GB")}</span><span className="font-semibold">{t.common.currency}{b.amount.toFixed(2)}</span></div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5"><Wallet className="w-3.5 h-3.5" />{t.admin.users.title}</p>
                      <div className="space-y-1 max-h-40 overflow-y-auto">
                        {profile.txns.length === 0 ? <p className="text-sm text-muted-foreground">—</p> : profile.txns.map((x) => (
                          <div key={x.id} className="text-sm flex justify-between"><span className="text-muted-foreground truncate">{x.description || x.type}</span><span className={cn("font-semibold", (x.amount || 0) >= 0 ? "text-success" : "text-destructive")}>{(x.amount || 0) >= 0 ? "+" : ""}{t.common.currency}{Math.abs(x.amount || 0).toFixed(2)}</span></div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          <div className="rounded-2xl border border-border bg-card">
            <AdminPagination
              page={page} pageSize={pageSize} total={filtered.length}
              onPage={setPage} onPageSize={(n) => { setPageSize(n); setPage(1); }}
              className="border-t-0"
            />
          </div>
        </div>
      )}

      {/* Edit user dialog */}
      <EditUserDialog user={editUser} actorIsSuper={isSuper} open={!!editUser} onOpenChange={(o) => !o && setEditUser(null)} onSaved={load} />

      {/* Permissions dialog */}
      <PermissionsDialog user={permsUser} open={!!permsUser} onOpenChange={(o) => !o && setPermsUser(null)} onSaved={load} />

      {/* Delete confirm dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Trash2 className="w-4 h-4 text-destructive" />{t.admin.users.deleteUser}</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">{t.admin.users.deleteConfirm}</p>
          {deleteTarget && <p className="text-sm font-medium">{deleteTarget.full_name || deleteTarget.email}</p>}
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">{t.admin.cancel}</Button></DialogClose>
            <Button variant="destructive" onClick={confirmDelete} disabled={busy}>{busy ? t.admin.saving : t.admin.delete}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invite dialog */}
      <Dialog open={invite} onOpenChange={setInvite}>
        <DialogContent>
          <DialogForm onSubmit={(e) => { e.preventDefault(); handleInvite(); }}>
            <DialogHeader><DialogTitle className="flex items-center gap-2"><UserPlus className="w-4 h-4" />{t.admin.users.invite}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label className="text-xs" htmlFor="user-f1">{t.admin.users.inviteEmail}</Label>
                <Input id="user-f1" type="email" value={inviteForm.email} onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs" htmlFor="user-f2">{t.admin.users.inviteRole}</Label>
                <select id="user-f2" value={inviteForm.role} onChange={(e) => setInviteForm({ ...inviteForm, role: e.target.value })}
                  className="w-full mt-1 h-10 rounded-md border border-input bg-background px-3 text-sm">
                  <option value="user">{t.admin.users.roleUser}</option>
                  {isSuper && <option value="admin">{t.admin.users.roleAdmin}</option>}
                </select>
                {!isSuper && <p className="text-xs text-muted-foreground mt-1">{t.admin.users.roleSuperOnly}</p>}
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild><Button variant="outline">{t.admin.cancel}</Button></DialogClose>
              <Button type="submit" disabled={busy}>{busy ? t.admin.users.inviting : t.admin.users.inviteSend}</Button>
            </DialogFooter>
          </DialogForm>
        </DialogContent>
      </Dialog>

      {/* Contact dialog */}
      <Dialog open={!!contact} onOpenChange={(o) => !o && setContact(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Mail className="w-4 h-4" />{t.admin.users.contactTitle}</DialogTitle></DialogHeader>
          {contact && <p className="text-sm text-muted-foreground">{contact.full_name || contact.email}</p>}
          <div className="space-y-3">
            <div>
              <Label className="text-xs" htmlFor="user-f3">{t.admin.users.subject}</Label>
              <Input id="user-f3" value={msg.subject} onChange={(e) => setMsg({ ...msg, subject: e.target.value })} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs" htmlFor="user-f4">{t.admin.users.message}</Label>
              <Textarea id="user-f4" value={msg.body} onChange={(e) => setMsg({ ...msg, body: e.target.value })} rows={5} className="mt-1" />
            </div>
          </div>
          <DialogFooter className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <Button variant="outline" className="gap-1.5" onClick={() => sendContact("whatsapp")} disabled={busy}><MessageCircle className="w-4 h-4" />{t.admin.users.sendWhatsapp}</Button>
            <Button variant="outline" className="gap-1.5" onClick={() => sendContact("inapp")} disabled={busy}><Bell className="w-4 h-4" />{t.admin.users.sendInapp}</Button>
            <Button className="gap-1.5" onClick={() => sendContact("email")} disabled={busy}><Mail className="w-4 h-4" />{busy ? t.admin.users.sending : t.admin.users.send}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Phone edit dialog */}
      <Dialog open={!!phoneEdit} onOpenChange={(o) => !o && setPhoneEdit(null)}>
        <DialogContent>
          <DialogForm onSubmit={(e) => { e.preventDefault(); savePhone(phoneEdit); }}>
            <DialogHeader><DialogTitle>{t.admin.users.editPhone}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label className="text-xs" htmlFor="user-f5">{t.admin.users.phone}</Label>
                <Input id="user-f5" value={phoneValue} onChange={(e) => setPhoneValue(e.target.value)} placeholder="+962790000000" className="mt-1" />
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild><Button variant="outline">{t.admin.cancel}</Button></DialogClose>
              <Button type="submit">{t.admin.users.savePhone}</Button>
            </DialogFooter>
          </DialogForm>
        </DialogContent>
      </Dialog>

      {/* Adjust balance dialog */}
      <Dialog open={!!balanceUser} onOpenChange={(o) => !o && setBalanceUser(null)}>
        <DialogContent className="max-w-md">
          <DialogForm onSubmit={(e) => { e.preventDefault(); applyAdjustment(); }}>
            <DialogHeader><DialogTitle className="flex items-center gap-2"><Wallet className="w-4 h-4 text-success" />{"Adjust wallet balance"}</DialogTitle></DialogHeader>
            {balanceUser && <p className="text-sm text-muted-foreground">{balanceUser.full_name || balanceUser.email}</p>}
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <Button type="button" size="sm" variant={balanceForm.dir === "credit" ? "default" : "outline"} onClick={() => setBalanceForm({ ...balanceForm, dir: "credit" })} className="gap-1.5"><Plus className="w-4 h-4" />{"Increase"}</Button>
                <Button type="button" size="sm" variant={balanceForm.dir === "debit" ? "destructive" : "outline"} onClick={() => setBalanceForm({ ...balanceForm, dir: "debit" })} className="gap-1.5"><Minus className="w-4 h-4" />{"Decrease"}</Button>
              </div>
              <div>
                <Label className="text-xs" htmlFor="user-f6">{"Amount"}</Label>
                <Input id="user-f6" type="number" min="0" step="0.01" value={balanceForm.amount} onChange={(e) => setBalanceForm({ ...balanceForm, amount: e.target.value })} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs" htmlFor="user-f7">{"Reason"}</Label>
                <Input id="user-f7" value={balanceForm.note} onChange={(e) => setBalanceForm({ ...balanceForm, note: e.target.value })} className="mt-1" />
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild><Button variant="outline">{t.admin.cancel}</Button></DialogClose>
              <Button type="submit" disabled={busy}>{busy ? t.admin.saving : "Apply adjustment"}</Button>
            </DialogFooter>
          </DialogForm>
        </DialogContent>
      </Dialog>
    </div>
  );
}