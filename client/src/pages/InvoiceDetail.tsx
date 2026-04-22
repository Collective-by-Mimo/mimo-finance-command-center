import { trpc } from "@/lib/trpc";
import { motion } from "framer-motion";
import { ArrowLeft, Download, Edit2, Trash2, CheckCircle, Clock, AlertTriangle, FileText, ExternalLink, Mail, Loader2 } from "lucide-react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

function formatCurrency(val: number | string | null | undefined, currency = "AED") {
  if (!val) return "—";
  return new Intl.NumberFormat("en-AE", { style: "currency", currency }).format(Number(val));
}

function formatDate(d: Date | string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-AE", { month: "long", day: "numeric", year: "numeric" });
}

function buildEmailBody(inv: any, formatCurrency: Function, formatDate: Function): string {
  const lineItems = (inv.lineItems as any[]) ?? [];
  const lineItemsText = lineItems.length > 0
    ? lineItems.map((li: any) =>
        `  - ${li.description}: ${li.quantity} × ${formatCurrency(li.unitPrice, inv.currency ?? "AED")} = ${formatCurrency(li.total, inv.currency ?? "AED")}`
      ).join("\n")
    : `  - ${inv.description ?? "Services rendered"}: ${formatCurrency(inv.amount, inv.currency ?? "AED")}`;

  return `Dear ${inv.clientName ?? "Client"},

Please find below the details for Invoice ${inv.invoiceNumber ?? `#${inv.id}`}.

────────────────────────────────
INVOICE DETAILS
────────────────────────────────
Invoice No:   ${inv.invoiceNumber ?? `#${inv.id}`}
Issue Date:   ${formatDate(inv.issueDate)}
Due Date:     ${formatDate(inv.dueDate)}

SERVICES:
${lineItemsText}

TOTAL AMOUNT: ${formatCurrency(inv.amount, inv.currency ?? "AED")}
────────────────────────────────

${inv.notes ? `Notes: ${inv.notes}\n\n` : ""}Please process payment by ${formatDate(inv.dueDate)}.

For any queries, please contact us at contact@movsummirzazada.com or +971 58 592 9669.

Thank you for your business.

Best regards,
Mirmovsum Mirzazada
Mimo's Collective
Dubai, UAE | www.movsummirzazada.com`;
}

export default function InvoiceDetail({ id }: { id: number }) {
  const [, navigate] = useLocation();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const invoice = trpc.invoice.get.useQuery({ id });
  const updateInvoice = trpc.invoice.update.useMutation();
  const deleteInvoice = trpc.invoice.delete.useMutation();
  const createDraft = trpc.ai.createDraft.useMutation();
  const utils = trpc.useUtils();
  const [draftSent, setDraftSent] = useState(false);

  const inv = invoice.data;

  const handleStatusChange = async (status: string) => {
    try {
      await updateInvoice.mutateAsync({ id, status: status as any });
      utils.invoice.get.invalidate({ id });
      utils.invoice.list.invalidate();
      utils.invoice.kpis.invalidate();
      toast.success(`Invoice marked as ${status}`);
    } catch {
      toast.error("Failed to update status");
    }
  };

  const handleDelete = async () => {
    try {
      await deleteInvoice.mutateAsync({ id });
      utils.invoice.list.invalidate();
      utils.invoice.kpis.invalidate();
      toast.success("Invoice deleted");
      navigate("/invoices");
    } catch {
      toast.error("Failed to delete invoice");
    }
  };

  const handleDraftEmail = async () => {
    if (!inv) return;
    if (!inv.clientEmail) {
      toast.error("No client email address on this invoice. Please add one first.");
      return;
    }
    try {
      toast.loading("Creating Gmail draft...", { id: "draft" });
      const body = buildEmailBody(inv, formatCurrency, formatDate);
      await createDraft.mutateAsync({
        to: inv.clientEmail,
        subject: `Invoice ${inv.invoiceNumber ?? `#${inv.id}`} — ${formatCurrency(inv.amount, inv.currency ?? "AED")} — Due ${formatDate(inv.dueDate)}`,
        body,
      });
      toast.dismiss("draft");
      setDraftSent(true);
      setTimeout(() => setDraftSent(false), 5000);
      toast.success(
        "Gmail draft created! Open Gmail to review and send.",
        {
          duration: 6000,
          action: {
            label: "Open Gmail",
            onClick: () => window.open("https://mail.google.com/mail/u/0/#drafts", "_blank"),
          },
        }
      );
    } catch (err: any) {
      toast.dismiss("draft");
      const msg = err?.message ?? "Failed to create draft";
      if (msg.includes("Apps Script URL not configured")) {
        toast.error("Apps Script not configured. Go to Settings to add your URL.", { duration: 5000 });
      } else {
        toast.error(msg);
      }
    }
  };

  const handleExportPDF = () => {
    if (!inv) return;
    // Build a printable HTML invoice
    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Invoice ${inv.invoiceNumber ?? inv.id}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #1a1a2e; background: #fff; padding: 40px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; padding-bottom: 24px; border-bottom: 2px solid #f0f0f0; }
  .brand { font-size: 24px; font-weight: 700; color: #1a1a2e; }
  .brand-sub { font-size: 12px; color: #888; margin-top: 4px; }
  .invoice-meta { text-align: right; }
  .invoice-number { font-size: 20px; font-weight: 700; color: #1a1a2e; }
  .status { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 11px; font-weight: 600; text-transform: uppercase; margin-top: 6px; background: #e8f5e9; color: #2e7d32; }
  .parties { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-bottom: 32px; }
  .party-label { font-size: 11px; font-weight: 600; text-transform: uppercase; color: #888; letter-spacing: 0.5px; margin-bottom: 8px; }
  .party-name { font-size: 16px; font-weight: 600; color: #1a1a2e; }
  .party-email { font-size: 13px; color: #666; margin-top: 2px; }
  .dates { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 32px; padding: 16px; background: #f8f9fa; border-radius: 8px; }
  .date-label { font-size: 11px; color: #888; margin-bottom: 4px; }
  .date-value { font-size: 14px; font-weight: 600; color: #1a1a2e; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
  th { text-align: left; padding: 12px 16px; font-size: 11px; font-weight: 600; text-transform: uppercase; color: #888; border-bottom: 1px solid #f0f0f0; }
  td { padding: 12px 16px; font-size: 13px; color: #333; border-bottom: 1px solid #f8f8f8; }
  .total-row { font-weight: 700; font-size: 16px; color: #1a1a2e; }
  .notes { padding: 16px; background: #f8f9fa; border-radius: 8px; font-size: 13px; color: #666; margin-top: 16px; }
  .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #f0f0f0; text-align: center; font-size: 11px; color: #aaa; }
</style>
</head>
<body>
<div class="header">
  <div>
    <div class="brand">${inv.vendor ?? "Mimo's Collective"}</div>
    <div class="brand-sub">Finance Command Center</div>
  </div>
  <div class="invoice-meta">
    <div class="invoice-number">Invoice ${inv.invoiceNumber ?? `#${inv.id}`}</div>
    <div class="status">${inv.status?.toUpperCase()}</div>
  </div>
</div>
<div class="parties">
  <div>
    <div class="party-label">From</div>
    <div class="party-name">${inv.vendor ?? "—"}</div>
  </div>
  <div>
    <div class="party-label">Bill To</div>
    <div class="party-name">${inv.clientName ?? "—"}</div>
    <div class="party-email">${inv.clientEmail ?? ""}</div>
  </div>
</div>
<div class="dates">
  <div>
    <div class="date-label">Issue Date</div>
    <div class="date-value">${formatDate(inv.issueDate)}</div>
  </div>
  <div>
    <div class="date-label">Due Date</div>
    <div class="date-value">${formatDate(inv.dueDate)}</div>
  </div>
</div>
<table>
  <thead>
    <tr>
      <th>Description</th>
      <th>Qty</th>
      <th>Unit Price</th>
      <th style="text-align:right">Total</th>
    </tr>
  </thead>
  <tbody>
    ${(inv.lineItems as any[] ?? []).map((li: any) => `
    <tr>
      <td>${li.description}</td>
      <td>${li.quantity}</td>
      <td>${formatCurrency(li.unitPrice)}</td>
      <td style="text-align:right">${formatCurrency(li.total)}</td>
    </tr>`).join("") || `<tr><td colspan="4">${inv.description ?? "Services rendered"}</td></tr>`}
    <tr class="total-row">
      <td colspan="3" style="text-align:right; padding-top: 16px;">Total</td>
      <td style="text-align:right; padding-top: 16px;">${formatCurrency(inv.amount, inv.currency ?? "USD")}</td>
    </tr>
  </tbody>
</table>
${inv.notes ? `<div class="notes"><strong>Notes:</strong> ${inv.notes}</div>` : ""}
<div class="footer">Generated by Mimo's Finance Command Center</div>
</body>
</html>`;

    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `invoice-${inv.invoiceNumber ?? inv.id}.html`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Invoice exported");
  };

  if (invoice.isLoading) {
    return (
      <div className="p-4 md:p-6 max-w-3xl mx-auto">
        <div className="h-8 w-32 bg-secondary rounded animate-pulse mb-6" />
        <div className="h-96 bg-card border border-border rounded-xl animate-pulse" />
      </div>
    );
  }

  if (!inv) {
    return (
      <div className="p-4 md:p-6 max-w-3xl mx-auto text-center py-16">
        <FileText className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
        <p className="text-muted-foreground">Invoice not found</p>
        <Link href="/invoices"><Button variant="outline" size="sm" className="mt-4">Back to invoices</Button></Link>
      </div>
    );
  }

  const lineItems = (inv.lineItems as any[]) ?? [];

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      {/* Back + Actions */}
      <div className="flex items-center justify-between mb-5">
        <Link href="/invoices">
          <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-foreground -ml-2">
            <ArrowLeft className="w-4 h-4" />
            Invoices
          </Button>
        </Link>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className={`gap-1.5 text-xs transition-colors ${
              draftSent
                ? "border-emerald-500/40 text-emerald-400 bg-emerald-500/10"
                : "hover:border-primary/40 hover:text-primary"
            }`}
            onClick={handleDraftEmail}
            disabled={createDraft.isPending}
            title={inv.clientEmail ? `Draft email to ${inv.clientEmail}` : "No client email — add one to enable drafting"}
          >
            {createDraft.isPending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Mail className="w-3.5 h-3.5" />
            )}
            {draftSent ? "Drafted!" : "Draft Email"}
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={handleExportPDF}>
            <Download className="w-3.5 h-3.5" />
            Export
          </Button>
          {inv.fileUrl && (
            <a href={inv.fileUrl} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                <ExternalLink className="w-3.5 h-3.5" />
                File
              </Button>
            </a>
          )}
          <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-destructive hover:text-destructive" onClick={() => setDeleteOpen(true)}>
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Invoice Card — PDF-style */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-card border border-border rounded-xl overflow-hidden"
      >
        {/* Header stripe */}
        <div className="bg-gradient-to-r from-primary/20 to-primary/5 px-6 py-5 border-b border-border">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-1">Invoice</p>
              <p className="text-2xl font-bold text-foreground">{inv.invoiceNumber ?? `#${inv.id}`}</p>
            </div>
            <div className="text-right">
              <span className={cn("text-xs rounded-full px-3 py-1.5 font-medium", `status-${inv.status}`)}>
                {inv.status?.toUpperCase()}
              </span>
              <div className="mt-2">
                <Select value={inv.status} onValueChange={handleStatusChange}>
                  <SelectTrigger className="h-7 text-xs w-32 bg-secondary/50 border-border/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    {["draft", "sent", "paid", "overdue", "cancelled"].map((s) => (
                      <SelectItem key={s} value={s} className="text-xs capitalize">{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Parties */}
          <div className="grid grid-cols-2 gap-6">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-2">From</p>
              <p className="font-semibold text-foreground">{inv.vendor ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-2">Bill To</p>
              <p className="font-semibold text-foreground">{inv.clientName ?? "—"}</p>
              {inv.clientEmail && <p className="text-xs text-muted-foreground mt-0.5">{inv.clientEmail}</p>}
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-3 gap-4 p-4 bg-secondary/30 rounded-lg">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Issue Date</p>
              <p className="text-sm font-medium text-foreground">{formatDate(inv.issueDate)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Due Date</p>
              <p className={cn("text-sm font-medium", inv.status === "overdue" ? "text-destructive" : "text-foreground")}>
                {formatDate(inv.dueDate)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Type</p>
              <p className={cn("text-sm font-medium capitalize", `amount-${inv.type}`)}>{inv.type}</p>
            </div>
          </div>

          {/* Line Items */}
          {lineItems.length > 0 ? (
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-3">Line Items</p>
              <div className="border border-border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-secondary/30">
                      <th className="text-left px-4 py-2.5 text-xs text-muted-foreground font-medium">Description</th>
                      <th className="text-right px-4 py-2.5 text-xs text-muted-foreground font-medium">Qty</th>
                      <th className="text-right px-4 py-2.5 text-xs text-muted-foreground font-medium">Unit Price</th>
                      <th className="text-right px-4 py-2.5 text-xs text-muted-foreground font-medium">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lineItems.map((li: any, i: number) => (
                      <tr key={i} className="border-b border-border/50 last:border-0">
                        <td className="px-4 py-3 text-foreground">{li.description}</td>
                        <td className="px-4 py-3 text-right text-muted-foreground">{li.quantity}</td>
                        <td className="px-4 py-3 text-right text-muted-foreground">{formatCurrency(li.unitPrice)}</td>
                        <td className="px-4 py-3 text-right font-medium text-foreground">{formatCurrency(li.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : inv.description ? (
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-2">Description</p>
              <p className="text-sm text-foreground">{inv.description}</p>
            </div>
          ) : null}

          {/* Total */}
          <div className="flex items-center justify-between pt-4 border-t border-border">
            <p className="text-sm font-medium text-muted-foreground">Total Amount</p>
            <p className={cn("text-2xl font-bold", inv.type === "income" ? "amount-income" : "amount-expense")}>
              {formatCurrency(inv.amount, inv.currency ?? "USD")}
            </p>
          </div>

          {/* Notes */}
          {inv.notes && (
            <div className="p-4 bg-secondary/30 rounded-lg">
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-2">Notes</p>
              <p className="text-sm text-foreground">{inv.notes}</p>
            </div>
          )}

          {/* Source */}
          {inv.source !== "manual" && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {inv.source === "gmail" && <><CheckCircle className="w-3.5 h-3.5 text-primary" /> Imported from Gmail</>}
              {inv.source === "upload" && <><FileText className="w-3.5 h-3.5 text-primary" /> Extracted from uploaded document</>}
              {inv.source === "ai_generated" && <><CheckCircle className="w-3.5 h-3.5 text-primary" /> Generated by AI</>}
            </div>
          )}
        </div>
      </motion.div>

      {/* Delete Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-foreground">Delete Invoice</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Are you sure you want to delete invoice {inv.invoiceNumber ?? `#${inv.id}`}? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 mt-2">
            <Button variant="outline" className="flex-1" onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button variant="destructive" className="flex-1" onClick={handleDelete} disabled={deleteInvoice.isPending}>
              {deleteInvoice.isPending ? "Deleting..." : "Delete"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
