import { trpc } from "@/lib/trpc";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Plus, Filter, FileText, ChevronRight, Upload } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useState, useCallback } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const STATUS_FILTERS = ["all", "draft", "sent", "paid", "overdue", "cancelled"] as const;
const TYPE_FILTERS = ["all", "income", "expense", "pending"] as const;

function formatCurrency(val: number | string | null | undefined) {
  if (!val) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0 }).format(Number(val));
}

function formatDate(d: Date | string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function InvoicesPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const invoices = trpc.invoice.list.useQuery({
    search: search || undefined,
    status: statusFilter === "all" ? undefined : statusFilter,
    type: typeFilter === "all" ? undefined : typeFilter,
    limit: 50,
  });

  const parseDocument = trpc.invoice.parseDocument.useMutation();
  const createInvoice = trpc.invoice.create.useMutation();
  const utils = trpc.useUtils();

  const handleFileUpload = useCallback(async (file: File) => {
    if (!file) return;
    setUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const content = e.target?.result as string;
        const text = content.includes("base64,") ? atob(content.split("base64,")[1]) : content;

        toast.loading("Parsing document with AI...", { id: "parse" });
        const parsed = await parseDocument.mutateAsync({ content: text, mimeType: file.type });
        toast.dismiss("parse");

        if (parsed && Object.keys(parsed).length > 0) {
          const id = await createInvoice.mutateAsync({
            ...parsed,
            amount: parsed.amount,
            issueDate: parsed.issueDate ? new Date(parsed.issueDate) : undefined,
            dueDate: parsed.dueDate ? new Date(parsed.dueDate) : undefined,
            source: "upload",
            status: "draft",
          });
          utils.invoice.list.invalidate();
          toast.success("Invoice extracted and saved!");
          setUploadOpen(false);
        } else {
          toast.error("Could not extract invoice data from this document.");
        }
        setUploading(false);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      toast.error("Failed to process document.");
      setUploading(false);
    }
  }, [parseDocument, createInvoice, utils]);

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-foreground">Invoices</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {invoices.data?.length ?? 0} invoices
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => setUploadOpen(true)}>
            <Upload className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Upload</span>
          </Button>
          <Link href="/composer">
            <Button size="sm" className="gap-1.5 text-xs">
              <Plus className="w-3.5 h-3.5" />
              New
            </Button>
          </Link>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search vendor, client, invoice number..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 bg-secondary/50 border-border/50 text-sm"
        />
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-1 scrollbar-none">
        <div className="flex gap-1.5 flex-shrink-0">
          {STATUS_FILTERS.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors",
                statusFilter === s
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-muted-foreground hover:text-foreground"
              )}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
        <div className="w-px bg-border flex-shrink-0" />
        <div className="flex gap-1.5 flex-shrink-0">
          {TYPE_FILTERS.map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors",
                typeFilter === t
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-muted-foreground hover:text-foreground"
              )}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Invoice List */}
      <div className="space-y-2">
        {invoices.isLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-20 bg-card border border-border rounded-xl animate-pulse" />
          ))
        ) : invoices.data?.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-16"
          >
            <FileText className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">No invoices found</p>
            <p className="text-muted-foreground/60 text-xs mt-1">Try adjusting your filters or create a new invoice</p>
            <Link href="/composer">
              <Button variant="outline" size="sm" className="mt-4 gap-2">
                <Plus className="w-3.5 h-3.5" />
                Create Invoice
              </Button>
            </Link>
          </motion.div>
        ) : (
          <AnimatePresence>
            {invoices.data?.map((inv, i) => (
              <motion.div
                key={inv.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
              >
                <Link href={`/invoices/${inv.id}`}>
                  <motion.div
                    whileHover={{ x: 2 }}
                    className="flex items-center gap-4 p-4 bg-card border border-border rounded-xl hover:border-primary/30 transition-colors cursor-pointer group"
                  >
                    {/* Icon */}
                    <div className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center text-xs font-bold flex-shrink-0",
                      inv.type === "income" ? "bg-emerald-500/15 text-emerald-400" :
                      inv.type === "expense" ? "bg-red-500/15 text-red-400" :
                      "bg-amber-500/15 text-amber-400"
                    )}>
                      {(inv.vendor ?? inv.clientName ?? "??").slice(0, 2).toUpperCase()}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="text-sm font-semibold text-foreground truncate">
                          {inv.vendor ?? inv.clientName ?? "Unknown"}
                        </p>
                        <span className={cn("text-[10px] rounded px-1.5 py-0.5 flex-shrink-0", `status-${inv.status}`)}>
                          {inv.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <p className="text-xs text-muted-foreground">{inv.invoiceNumber ?? `#${inv.id}`}</p>
                        {inv.dueDate && (
                          <p className="text-xs text-muted-foreground">Due {formatDate(inv.dueDate)}</p>
                        )}
                        {inv.source !== "manual" && (
                          <span className="text-[10px] text-muted-foreground/60 capitalize">{inv.source}</span>
                        )}
                      </div>
                    </div>

                    {/* Amount */}
                    <div className="text-right flex-shrink-0">
                      <p className={cn(
                        "text-sm font-bold",
                        inv.type === "income" ? "amount-income" : inv.type === "expense" ? "amount-expense" : "amount-pending"
                      )}>
                        {inv.type === "expense" ? "-" : "+"}{formatCurrency(inv.amount)}
                      </p>
                      <p className="text-xs text-muted-foreground">{formatDate(inv.issueDate ?? inv.createdAt)}</p>
                    </div>

                    <ChevronRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors flex-shrink-0" />
                  </motion.div>
                </Link>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>

      {/* Upload Dialog */}
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="bg-card border-border max-w-md">
          <DialogHeader>
            <DialogTitle className="text-foreground">Upload Invoice Document</DialogTitle>
          </DialogHeader>
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const file = e.dataTransfer.files[0];
              if (file) handleFileUpload(file);
            }}
            className={cn(
              "border-2 border-dashed rounded-xl p-8 text-center transition-colors",
              dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
            )}
          >
            <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm font-medium text-foreground mb-1">Drop your invoice here</p>
            <p className="text-xs text-muted-foreground mb-4">PDF, image, or text file — AI will extract all fields</p>
            <label className="cursor-pointer">
              <input
                type="file"
                className="hidden"
                accept=".pdf,.txt,.png,.jpg,.jpeg"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileUpload(file);
                }}
              />
              <Button variant="outline" size="sm" disabled={uploading} className="gap-2">
                {uploading ? "Processing..." : "Choose File"}
              </Button>
            </label>
          </div>
          <p className="text-xs text-muted-foreground text-center">
            The AI will automatically extract vendor, amount, dates, and line items.
          </p>
        </DialogContent>
      </Dialog>
    </div>
  );
}
