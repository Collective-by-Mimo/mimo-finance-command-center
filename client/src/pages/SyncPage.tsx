import { trpc } from "@/lib/trpc";
import { motion, AnimatePresence } from "framer-motion";
import { RefreshCw, Mail, Table2, CheckCircle, XCircle, Clock, AlertTriangle, Zap, Settings, ShieldCheck, Wifi } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

function formatDate(d: Date | string | null | undefined) {
  if (!d) return "Never";
  return new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function SyncCard({
  title, description, icon: Icon, iconColor, lastSync, onSync, loading, disabled, disabledReason,
}: {
  title: string; description: string; icon: React.ElementType; iconColor: string;
  lastSync: any; onSync: () => void; loading: boolean; disabled?: boolean; disabledReason?: string;
}) {
  const status = lastSync?.status;
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card border border-border rounded-xl p-5"
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", iconColor)}>
            <Icon className="w-5 h-5" />
          </div>
          <div>
            <p className="font-semibold text-foreground text-sm">{title}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
          </div>
        </div>
        <div className="flex-shrink-0">
          {status === "success" && <CheckCircle className="w-4 h-4 text-emerald-400" />}
          {status === "error" && <XCircle className="w-4 h-4 text-destructive" />}
          {status === "running" && (
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
              <RefreshCw className="w-4 h-4 text-primary" />
            </motion.div>
          )}
          {!status && <Clock className="w-4 h-4 text-muted-foreground/40" />}
        </div>
      </div>

      {/* Last sync info */}
      <div className="p-3 bg-secondary/40 rounded-lg mb-4 space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Last sync</span>
          <span className="text-xs font-medium text-foreground">{formatDate(lastSync?.startedAt)}</span>
        </div>
        {lastSync?.itemsProcessed !== undefined && (
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Items processed</span>
            <span className="text-xs font-medium text-foreground">{lastSync.itemsProcessed}</span>
          </div>
        )}
        {lastSync?.itemsCreated !== undefined && lastSync.itemsCreated > 0 && (
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Items created</span>
            <span className="text-xs font-medium text-emerald-400">{lastSync.itemsCreated}</span>
          </div>
        )}
        {lastSync?.message && status === "error" && (
          <p className="text-xs text-destructive mt-1 break-words">{lastSync.message}</p>
        )}
        {lastSync?.message && status === "success" && (
          <p className="text-xs text-muted-foreground mt-1">{lastSync.message}</p>
        )}
      </div>

      {disabled ? (
        <div className="flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
          <p className="text-xs text-amber-400">{disabledReason}</p>
          <Link href="/settings" className="ml-auto text-xs text-amber-400 underline flex-shrink-0">Configure</Link>
        </div>
      ) : (
        <Button
          className="w-full gap-2"
          onClick={onSync}
          disabled={loading}
          variant={status === "error" ? "destructive" : "default"}
        >
          {loading ? (
            <>
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
                <RefreshCw className="w-4 h-4" />
              </motion.div>
              Syncing...
            </>
          ) : (
            <>
              <RefreshCw className="w-4 h-4" />
              Sync Now
            </>
          )}
        </Button>
      )}
    </motion.div>
  );
}

export default function SyncPage() {
  const syncStatus = trpc.sync.status.useQuery(undefined, { refetchInterval: 10000 });
  const syncLogs = trpc.sync.logs.useQuery({ limit: 10 });
  const settings = trpc.settings.get.useQuery();
  const triggerGmail = trpc.sync.triggerGmail.useMutation();
  const triggerSheets = trpc.sync.triggerSheets.useMutation();
  const checkOverdue = trpc.sync.checkOverdue.useMutation();
  const verifyConnection = trpc.sync.verify.useMutation();
  const utils = trpc.useUtils();

  const hasAppsScript = !!settings.data?.appsScriptUrl;

  const handleVerify = async () => {
    try {
      toast.loading("Verifying Apps Script connection...", { id: "verify" });
      const result = await verifyConnection.mutateAsync();
      toast.dismiss("verify");
      if (result.success) {
        toast.success(`Connected as ${result.userEmail ?? "unknown"}`);
      } else {
        toast.error(result.error ?? "Connection failed");
      }
    } catch (err: any) {
      toast.dismiss("verify");
      toast.error(err?.message ?? "Verification failed");
    }
  };

  const handleGmailSync = async () => {
    try {
      const result = await triggerGmail.mutateAsync();
      if (result.success) {
        toast.success(`Gmail sync complete — ${result.itemsCreated ?? 0} invoice(s) created`);
      } else {
        toast.error(result.error ?? "Gmail sync failed");
      }
      utils.sync.status.invalidate();
      utils.sync.logs.invalidate();
      utils.invoice.list.invalidate();
      utils.invoice.kpis.invalidate();
    } catch {
      toast.error("Gmail sync failed");
    }
  };

  const handleSheetsSync = async () => {
    try {
      const result = await triggerSheets.mutateAsync();
      if (result.success) {
        toast.success(`Sheets sync complete — ${result.itemsCreated ?? 0} transaction(s) created`);
      } else {
        toast.error(result.error ?? "Sheets sync failed");
      }
      utils.sync.status.invalidate();
      utils.sync.logs.invalidate();
      utils.transaction.list.invalidate();
    } catch {
      toast.error("Sheets sync failed");
    }
  };

  const handleCheckOverdue = async () => {
    try {
      const result = await checkOverdue.mutateAsync();
      if (result.overdueMarked > 0) {
        toast.warning(`${result.overdueMarked} invoice(s) marked as overdue`);
      } else {
        toast.success("No new overdue invoices");
      }
      utils.invoice.list.invalidate();
      utils.invoice.kpis.invalidate();
    } catch {
      toast.error("Failed to check overdue invoices");
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-foreground">Sync Center</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Connect Gmail, Sheets, and check overdue invoices</p>
        </div>
        <Link href="/settings">
          <Button variant="outline" size="sm" className="gap-1.5 text-xs">
            <Settings className="w-3.5 h-3.5" />
            Configure
          </Button>
        </Link>
      </div>

      {/* Verify connection button when configured */}
      {hasAppsScript && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl mb-5"
        >
          <div className="flex items-center gap-3">
            <Wifi className="w-4 h-4 text-emerald-400" />
            <div>
              <p className="text-sm font-medium text-emerald-400">Apps Script Connected</p>
              <p className="text-xs text-emerald-400/70 mt-0.5 font-mono truncate max-w-[200px]">
                {settings.data?.appsScriptUrl?.replace("https://script.google.com/macros/s/", "...s/")}
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 flex-shrink-0"
            onClick={handleVerify}
            disabled={verifyConnection.isPending}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            {verifyConnection.isPending ? "Verifying..." : "Verify"}
          </Button>
        </motion.div>
      )}

      {/* Setup notice */}
      {!hasAppsScript && !settings.isLoading && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-start gap-3 p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl mb-5"
        >
          <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-400">Apps Script URL not configured</p>
            <p className="text-xs text-amber-400/80 mt-1">
              To enable Gmail and Sheets sync, you need to deploy a Google Apps Script and add its URL in Settings.
            </p>
            <Link href="/settings" className="text-xs text-amber-400 underline mt-1 inline-block">Go to Settings →</Link>
          </div>
        </motion.div>
      )}

      {/* Sync Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <SyncCard
          title="Gmail Invoice Scanner"
          description="Scan emails for invoices and auto-extract data using AI"
          icon={Mail}
          iconColor="bg-red-500/15 text-red-400"
          lastSync={syncStatus.data?.gmailSync}
          onSync={handleGmailSync}
          loading={triggerGmail.isPending}
          disabled={!hasAppsScript}
          disabledReason="Configure Apps Script URL in Settings to enable Gmail sync"
        />
        <SyncCard
          title="Google Sheets Ledger"
          description="Import transactions from your connected spreadsheet"
          icon={Table2}
          iconColor="bg-emerald-500/15 text-emerald-400"
          lastSync={syncStatus.data?.sheetsSync}
          onSync={handleSheetsSync}
          loading={triggerSheets.isPending}
          disabled={!hasAppsScript}
          disabledReason="Configure Apps Script URL in Settings to enable Sheets sync"
        />
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-card border border-border rounded-xl p-4"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-lg bg-amber-500/15 flex items-center justify-center">
              <Clock className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Check Overdue</p>
              <p className="text-xs text-muted-foreground">Mark past-due invoices</p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="w-full gap-2 text-xs"
            onClick={handleCheckOverdue}
            disabled={checkOverdue.isPending}
          >
            <Zap className="w-3.5 h-3.5" />
            {checkOverdue.isPending ? "Checking..." : "Run Check"}
          </Button>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-card border border-border rounded-xl p-4"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-lg bg-primary/15 flex items-center justify-center">
              <RefreshCw className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Full Refresh</p>
              <p className="text-xs text-muted-foreground">Reload all data</p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="w-full gap-2 text-xs"
            onClick={() => {
              utils.invoice.list.invalidate();
              utils.transaction.list.invalidate();
              utils.invoice.kpis.invalidate();
              utils.sync.status.invalidate();
              toast.success("Data refreshed");
            }}
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh All
          </Button>
        </motion.div>
      </div>

      {/* Sync Log */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-card border border-border rounded-xl p-5"
      >
        <h2 className="text-sm font-semibold text-foreground mb-4">Sync History</h2>
        <div className="space-y-2">
          {syncLogs.isLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-12 bg-secondary/50 rounded-lg animate-pulse" />
            ))
          ) : syncLogs.data?.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No sync history yet</p>
          ) : (
            syncLogs.data?.map((log) => (
              <div key={log.id} className="flex items-center gap-3 p-3 bg-secondary/30 rounded-lg">
                <div className="flex-shrink-0">
                  {log.status === "success" && <CheckCircle className="w-4 h-4 text-emerald-400" />}
                  {log.status === "error" && <XCircle className="w-4 h-4 text-destructive" />}
                  {log.status === "running" && <RefreshCw className="w-4 h-4 text-primary animate-spin" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-foreground capitalize">{log.syncType}</span>
                    <span className={cn(
                      "text-[10px] px-1.5 py-0.5 rounded",
                      log.status === "success" ? "bg-emerald-500/15 text-emerald-400" :
                      log.status === "error" ? "bg-destructive/15 text-destructive" :
                      "bg-primary/15 text-primary"
                    )}>
                      {log.status}
                    </span>
                  </div>
                  {log.message && <p className="text-xs text-muted-foreground truncate mt-0.5">{log.message}</p>}
                </div>
                <p className="text-xs text-muted-foreground flex-shrink-0">{formatDate(log.startedAt)}</p>
              </div>
            ))
          )}
        </div>
      </motion.div>
    </div>
  );
}
