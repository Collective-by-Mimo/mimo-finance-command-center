import { trpc } from "@/lib/trpc";
import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, Wallet, Clock, AlertTriangle, RefreshCw, ChevronRight } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/_core/hooks/useAuth";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { useMemo } from "react";

function formatCurrency(val: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(val);
}

function KPICard({
  title, value, subtitle, icon: Icon, color, delay = 0, href,
}: {
  title: string; value: string; subtitle?: string; icon: React.ElementType;
  color: "income" | "expense" | "balance" | "pending"; delay?: number; href?: string;
}) {
  const colorMap = {
    income: { bg: "bg-emerald-500/10", icon: "text-emerald-400", border: "border-emerald-500/20", glow: "shadow-emerald-500/10" },
    expense: { bg: "bg-red-500/10", icon: "text-red-400", border: "border-red-500/20", glow: "shadow-red-500/10" },
    balance: { bg: "bg-primary/10", icon: "text-primary", border: "border-primary/20", glow: "shadow-primary/10" },
    pending: { bg: "bg-amber-500/10", icon: "text-amber-400", border: "border-amber-500/20", glow: "shadow-amber-500/10" },
  };
  const c = colorMap[color];

  const card = (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.3 }}
      whileHover={{ y: -2, transition: { duration: 0.15 } }}
      className={cn(
        "bg-card border rounded-xl p-5 cursor-pointer group transition-shadow",
        c.border,
        `shadow-lg ${c.glow}`
      )}
    >
      <div className="flex items-start justify-between mb-4">
        <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", c.bg)}>
          <Icon className={cn("w-5 h-5", c.icon)} />
        </div>
        {href && <ChevronRight className="w-4 h-4 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors" />}
      </div>
      <p className="text-muted-foreground text-xs font-medium uppercase tracking-wider mb-1">{title}</p>
      <p className="text-2xl font-bold text-foreground tracking-tight">{value}</p>
      {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
    </motion.div>
  );

  return href ? <Link href={href}>{card}</Link> : card;
}

export default function Dashboard() {
  const { user } = useAuth();
  const kpis = trpc.invoice.kpis.useQuery();
  const invoices = trpc.invoice.list.useQuery({ limit: 5 });
  const syncStatus = trpc.sync.status.useQuery();
  const utils = trpc.useUtils();

  const chartData = useMemo(() => {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"];
    return months.map((m, i) => ({
      month: m,
      income: Math.round(Math.random() * 8000 + 2000),
      expenses: Math.round(Math.random() * 4000 + 1000),
    }));
  }, []);

  const kpiData = kpis.data;
  const lastSync = syncStatus.data?.latest;

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-foreground">
            Good {new Date().getHours() < 12 ? "morning" : new Date().getHours() < 18 ? "afternoon" : "evening"},{" "}
            <span className="gradient-text">{user?.name?.split(" ")[0] ?? "Mimo"}</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-2 text-xs"
          onClick={() => utils.invoice.kpis.invalidate()}
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Refresh</span>
        </Button>
      </div>

      {/* Sync status banner */}
      {lastSync?.status === "error" && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 px-4 py-3 rounded-lg bg-destructive/10 border border-destructive/20 mb-4"
        >
          <AlertTriangle className="w-4 h-4 text-destructive flex-shrink-0" />
          <p className="text-sm text-destructive">Last sync failed: {lastSync.message}</p>
          <Link href="/sync" className="ml-auto text-xs text-destructive underline">Fix</Link>
        </motion.div>
      )}

      {/* KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <KPICard
          title="Total Income"
          value={kpiData ? formatCurrency(kpiData.totalIncome) : "—"}
          subtitle="Paid invoices"
          icon={TrendingUp}
          color="income"
          delay={0}
          href="/invoices?type=income"
        />
        <KPICard
          title="Total Expenses"
          value={kpiData ? formatCurrency(kpiData.totalExpenses) : "—"}
          subtitle="Paid expenses"
          icon={TrendingDown}
          color="expense"
          delay={0.05}
          href="/invoices?type=expense"
        />
        <KPICard
          title="Net Balance"
          value={kpiData ? formatCurrency(kpiData.balance) : "—"}
          subtitle={kpiData && kpiData.balance >= 0 ? "Positive" : "Negative"}
          icon={Wallet}
          color="balance"
          delay={0.1}
        />
        <KPICard
          title="Pending"
          value={kpiData ? `${kpiData.pendingCount + kpiData.overdueCount}` : "—"}
          subtitle={kpiData?.overdueCount ? `${kpiData.overdueCount} overdue` : "Awaiting payment"}
          icon={Clock}
          color="pending"
          delay={0.15}
          href="/invoices?status=sent"
        />
      </div>

      {/* Chart + Recent Invoices */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Chart */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="lg:col-span-3 bg-card border border-border rounded-xl p-5"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-foreground">Cash Flow</h2>
            <span className="text-xs text-muted-foreground">Last 6 months</span>
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="oklch(0.70 0.16 145)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="oklch(0.70 0.16 145)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="expenseGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="oklch(0.60 0.22 25)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="oklch(0.60 0.22 25)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: "oklch(0.55 0.01 250)" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "oklch(0.55 0.01 250)" }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: "oklch(0.14 0.012 250)", border: "1px solid oklch(0.22 0.015 250)", borderRadius: "8px", fontSize: "12px" }}
                labelStyle={{ color: "oklch(0.96 0.005 250)" }}
              />
              <Area type="monotone" dataKey="income" stroke="oklch(0.70 0.16 145)" strokeWidth={2} fill="url(#incomeGrad)" name="Income" />
              <Area type="monotone" dataKey="expenses" stroke="oklch(0.60 0.22 25)" strokeWidth={2} fill="url(#expenseGrad)" name="Expenses" />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Recent Invoices */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="lg:col-span-2 bg-card border border-border rounded-xl p-5"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-foreground">Recent Invoices</h2>
            <Link href="/invoices" className="text-xs text-primary hover:underline">View all</Link>
          </div>
          <div className="space-y-3">
            {invoices.isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-12 bg-secondary/50 rounded-lg animate-pulse" />
              ))
            ) : invoices.data?.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-sm text-muted-foreground">No invoices yet</p>
                <Link href="/composer">
                  <Button variant="outline" size="sm" className="mt-2 text-xs">Create one</Button>
                </Link>
              </div>
            ) : (
              invoices.data?.map((inv) => (
                <Link key={inv.id} href={`/invoices/${inv.id}`}>
                  <motion.div
                    whileHover={{ x: 2 }}
                    className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-secondary/50 transition-colors cursor-pointer"
                  >
                    <div className={cn(
                      "w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0",
                      inv.type === "income" ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"
                    )}>
                      {inv.vendor?.slice(0, 2).toUpperCase() ?? "??"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground truncate">{inv.vendor ?? inv.clientName ?? "Unknown"}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{inv.invoiceNumber ?? `#${inv.id}`}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className={cn("text-xs font-semibold", inv.type === "income" ? "amount-income" : "amount-expense")}>
                        {inv.amount ? formatCurrency(parseFloat(String(inv.amount))) : "—"}
                      </p>
                      <span className={cn("text-[10px] rounded px-1.5 py-0.5", `status-${inv.status}`)}>
                        {inv.status}
                      </span>
                    </div>
                  </motion.div>
                </Link>
              ))
            )}
          </div>
        </motion.div>
      </div>

      {/* Quick Actions */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3"
      >
        {[
          { label: "New Invoice", href: "/composer", color: "bg-primary/10 text-primary border-primary/20" },
          { label: "Sync Gmail", href: "/sync", color: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
          { label: "Transactions", href: "/transactions", color: "bg-purple-500/10 text-purple-400 border-purple-500/20" },
          { label: "Settings", href: "/settings", color: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20" },
        ].map((action) => (
          <Link key={action.label} href={action.href}>
            <motion.div
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              className={cn("border rounded-lg px-4 py-3 text-center text-sm font-medium cursor-pointer transition-colors hover:opacity-80", action.color)}
            >
              {action.label}
            </motion.div>
          </Link>
        ))}
      </motion.div>
    </div>
  );
}
