import React, { useEffect, useState, useCallback, useMemo } from "react";
import { Wallet, Plus, Minus, Receipt, TrendingUp, SlidersHorizontal } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";
import { base44 } from "@/api/base44Client";
import AdminPagination from "@/components/admin/AdminPagination";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogForm
} from "@/components/ui/dialog";

const dayKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export default function AdminPayments() {
  const { t } = useI18n();
  const [txns, setTxns] = useState([]);
  const [users, setUsers] = useState([]);
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [typeFilter, setTypeFilter] = useState("all");
  const [tableLoading, setTableLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dialog, setDialog] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState([]);
  const [deciding, setDeciding] = useState("");
  const [form, setForm] = useState({ userId: "", amount: "", reason: "", dir: "credit" });

  /**
   * Summary/chart data uses a light projection (three columns) while the table
   * itself is paginated in Postgres, so this screen stays fast as the ledger grows.
   */
  const load = useCallback(() => {
    Promise.all([
      base44.entities.WalletTransaction.listFields("id, type, amount, status, reference, user_id, created_date", "-created_date", 5000),
      base44.entities.User.listFields("id, full_name, email", "", 2000)
    ]).then(([tList, uList]) => {
      setTxns(tList);
      setUsers(uList);
      setPending(tList.filter((x) => x.status === "pending" && x.type === "topup"));
    }).finally(() => setLoading(false));
  }, []);

  const loadPage = useCallback(() => {
    setTableLoading(true);
    base44.entities.WalletTransaction.page({
      page, pageSize, sort: "-created_date",
      where: typeFilter === "all" ? {} : { type: typeFilter }
    }).then((res) => {
      setRows(res.rows);
      setTotal(res.total);
    }).finally(() => setTableLoading(false));
  }, [page, pageSize, typeFilter]);

  useEffect(() => { loadPage(); }, [loadPage]);

  const decide = async (txn, decision) => {
    setDeciding(txn.id);
    try {
      await base44.functions.invoke("approveTopup", { transaction_id: txn.id, decision });
      toast.success(decision === "approve" ? t.admin.payments.approvedTx : t.admin.payments.rejectedTx);
      load(); loadPage();
    } catch (e) {
      toast.error(e.message || "Error");
    } finally {
      setDeciding("");
    }
  };

  useEffect(() => { load(); }, [load]);

  // Money totals only count settled records: pending and failed top-ups are not income.
  const settled = useMemo(
    () => txns.filter((x) => x.status !== "pending" && x.status !== "failed" && x.status !== "rejected"),
    [txns],
  );

  const stats = useMemo(() => {
    const deposits = settled.filter((x) => x.type === "topup").reduce((s, x) => s + Math.abs(x.amount || 0), 0);
    const fees = settled.filter((x) => x.type === "subscription").reduce((s, x) => s + Math.abs(x.amount || 0), 0);
    const adjustments = settled.filter((x) => x.type === "adjustment").reduce((s, x) => s + (x.amount || 0), 0);
    return { deposits, fees, adjustments };
  }, [settled]);

  const chartData = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const days = []; const byKey = {};
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today); d.setDate(today.getDate() - i);
      const k = dayKey(d);
      const item = { label: `${d.getDate()}/${d.getMonth() + 1}`, deposits: 0, fees: 0 };
      days.push(item); byKey[k] = item;
    }
    settled.forEach((x) => {
      if (!x.created_date) return;
      const k = dayKey(new Date(x.created_date));
      if (!byKey[k]) return;
      if (x.type === "topup") byKey[k].deposits += Math.abs(x.amount || 0);
      if (x.type === "subscription") byKey[k].fees += Math.abs(x.amount || 0);
    });
    return days;
  }, [settled]);

  const userMap = useMemo(() => {
    const m = {};
    users.forEach((u) => { m[u.id] = u; });
    return m;
  }, [users]);

  const apply = async () => {
    const amt = parseFloat(form.amount);
    if (!form.userId) return toast.error(t.admin.payments.user);
    if (!amt || amt <= 0) return toast.error(t.admin.payments.amount);
    setBusy(true);
    try {
      const signed = form.dir === "credit" ? Math.abs(amt) : -Math.abs(amt);
      await base44.entities.WalletTransaction.create({
        user_id: form.userId,
        type: "adjustment",
        amount: signed,
        description: `${form.dir === "credit" ? t.admin.payments.credit : t.admin.payments.debit} — ${form.reason || "-"}`,
        notes: form.reason
      });
      toast.success(t.admin.payments.added);
      setDialog(false);
      setForm({ userId: "", amount: "", reason: "", dir: "credit" });
      load(); loadPage();
    } catch (e) {
      toast.error(e.message || "Error");
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div className="h-64 grid place-items-center"><div className="w-8 h-8 border-4 border-muted border-t-foreground rounded-full animate-spin" /></div>;

  const cards = [
    { icon: Wallet, label: t.admin.payments.totalDeposits, value: `${t.common.currency}${stats.deposits.toFixed(0)}`, tint: "bg-success/10 text-success" },
    { icon: Receipt, label: t.admin.payments.entryFees, value: `${t.common.currency}${stats.fees.toFixed(0)}`, tint: "bg-destructive/10 text-destructive" },
    { icon: SlidersHorizontal, label: t.admin.payments.adjustments, value: `${t.common.currency}${stats.adjustments.toFixed(0)}`, tint: "bg-info/10 text-info" }
  ];

  const typeLabel = (type) => ({
    topup: t.admin.payments.typeTopup, subscription: t.admin.payments.typeSubscription, adjustment: t.admin.payments.typeAdjustment
  })[type] || type;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight flex items-center gap-2"><Wallet className="w-6 h-6" />{t.admin.payments.title}</h1>
          <p className="text-muted-foreground mt-1 text-sm">{t.admin.payments.subtitle}</p>
        </div>
        <Button onClick={() => setDialog(true)} className="gap-2"><Plus className="w-4 h-4" />{t.admin.payments.manualTitle}</Button>
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-2xl border border-border bg-card p-4 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl grid place-items-center ${c.tint}`}><c.icon className="w-5 h-5" /></div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">{c.label}</p>
              <p className="font-display text-xl font-bold truncate">{c.value}</p>
            </div>
          </div>
        ))}
      </div>

      {pending.length > 0 && (
        <div className="rounded-2xl border border-warning/40 bg-warning/5 p-5 space-y-3">
          <h3 className="font-heading text-lg font-semibold flex items-center gap-2 text-warning">{t.admin.payments.approvals} <span className="text-xs font-normal px-2 py-0.5 rounded-full bg-warning/20 text-warning">{pending.length}</span></h3>
          <div className="divide-y divide-warning/15">
            {pending.map((x) => {
              const u = userMap[x.user_id];
              return (
                <div key={x.id} className="flex items-center justify-between py-3 gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{u ? (u.full_name || u.email) : `…${x.user_id?.slice(-4)}`}</p>
                    <p className="text-xs text-muted-foreground">{t.common.currency}{Math.abs(x.amount || 0).toFixed(2)} · {x.reference || "—"}</p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button size="sm" disabled={deciding === x.id} onClick={() => decide(x, "approve")} className="gap-1"><Plus className="w-3.5 h-3.5" />{t.admin.payments.approve}</Button>
                    <Button size="sm" variant="outline" disabled={deciding === x.id} onClick={() => decide(x, "reject")} className="gap-1"><Minus className="w-3.5 h-3.5" />{t.admin.payments.reject}</Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
        <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2"><TrendingUp className="w-4 h-4" />{t.admin.payments.totalDeposits} · {t.admin.payments.entryFees}</h3>
        <div className="h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ left: -12, right: 8, top: 4, bottom: 0 }}>
              <defs>
                <linearGradient id="gDep" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="hsl(var(--success))" stopOpacity={0.25} /><stop offset="100%" stopColor="hsl(var(--success))" stopOpacity={0} /></linearGradient>
                <linearGradient id="gFee" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="hsl(var(--destructive))" stopOpacity={0.25} /><stop offset="100%" stopColor="hsl(var(--destructive))" stopOpacity={0} /></linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="label" interval={5} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={{ stroke: "hsl(var(--border))" }} />
              <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} width={40} />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 12 }} formatter={(v) => `${t.common.currency}${Number(v).toFixed(0)}`} />
              <Area type="monotone" dataKey="deposits" stroke="hsl(var(--success))" strokeWidth={2} fill="url(#gDep)" dot={false} />
              <Area type="monotone" dataKey="fees" stroke="hsl(var(--destructive))" strokeWidth={2} fill="url(#gFee)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="p-5 border-b border-border flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-heading text-lg font-semibold">{t.admin.payments.transactions}</h3>
          <select
            value={typeFilter}
            onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          >
            <option value="all">{t.admin.payments.colType}</option>
            <option value="topup">{t.admin.payments.typeTopup}</option>
            <option value="subscription">{t.admin.payments.typeSubscription}</option>
            <option value="adjustment">{t.admin.payments.typeAdjustment}</option>
            <option value="bid_fee">bid_fee</option>
            <option value="bid_credits">bid_credits</option>
            <option value="winning_bid">winning_bid</option>
            <option value="refund">refund</option>
          </select>
        </div>
        {total === 0 && !tableLoading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">{t.admin.payments.noTx}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary/50 text-muted-foreground">
                <tr>
                  <th className="text-start font-medium px-4 py-3">{t.admin.payments.colUser}</th>
                  <th className="text-start font-medium px-4 py-3">{t.admin.payments.colType}</th>
                  <th className="text-end font-medium px-4 py-3">{t.admin.payments.colAmount}</th>
                  <th className="text-start font-medium px-4 py-3">{t.admin.payments.colNote}</th>
                  <th className="text-start font-medium px-4 py-3">{t.admin.payments.colDate}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((x) => {
                  const u = userMap[x.user_id];
                  return (
                    <tr key={x.id} className="hover:bg-secondary/30">
                      <td className="px-4 py-3 font-medium">{u ? (u.full_name || u.email) : `…${x.user_id?.slice(-4)}`}</td>
                      <td className="px-4 py-3"><Badge>{typeLabel(x.type)}</Badge></td>
                      <td className={`px-4 py-3 text-end font-semibold ${(x.amount || 0) >= 0 ? "text-success" : "text-destructive"}`}>{(x.amount || 0) >= 0 ? "+" : ""}{t.common.currency}{Math.abs(x.amount || 0).toFixed(2)}</td>
                      <td className="px-4 py-3 text-muted-foreground">{x.description || x.notes || "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{new Date(x.created_date).toLocaleDateString("en-GB")}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <AdminPagination
              page={page} pageSize={pageSize} total={total}
              onPage={setPage} onPageSize={(n) => { setPageSize(n); setPage(1); }}
            />
          </div>
        )}
      </div>

      <Dialog open={dialog} onOpenChange={setDialog}>
        <DialogContent>
          <DialogForm onSubmit={(e) => { e.preventDefault(); apply(); }}>
            <DialogHeader><DialogTitle>{t.admin.payments.manualTitle}</DialogTitle></DialogHeader>
            <div className="grid gap-4">
              <div>
                <Label htmlFor="payment-f1">{t.admin.payments.user}</Label>
                <select id="payment-f1" value={form.userId} onChange={(e) => setForm({ ...form, userId: e.target.value })}
                  className="w-full mt-1 h-10 rounded-md border border-input bg-background px-3 text-sm">
                  <option value="">—</option>
                  {users.map((u) => <option key={u.id} value={u.id}>{u.full_name || u.email}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button type="button" variant={form.dir === "credit" ? "default" : "outline"} onClick={() => setForm({ ...form, dir: "credit" })} className="gap-2"><Plus className="w-4 h-4" />{t.admin.payments.credit}</Button>
                <Button type="button" variant={form.dir === "debit" ? "destructive" : "outline"} onClick={() => setForm({ ...form, dir: "debit" })} className="gap-2"><Minus className="w-4 h-4" />{t.admin.payments.debit}</Button>
              </div>
              <div>
                <Label htmlFor="payment-f2">{t.admin.payments.amount}</Label>
                <Input id="payment-f2" type="number" min="0" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="mt-1" />
              </div>
              <div>
                <Label htmlFor="payment-f3">{t.admin.payments.reason}</Label>
                <Input id="payment-f3" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} className="mt-1" placeholder={t.admin.payments.reason} />
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild><Button variant="outline">{t.admin.cancel}</Button></DialogClose>
              <Button type="submit" disabled={busy}>{busy ? t.admin.payments.applying : t.admin.payments.apply}</Button>
            </DialogFooter>
          </DialogForm>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Badge({ children }) {
  return <span className="inline-block text-xs font-medium px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">{children}</span>;
}