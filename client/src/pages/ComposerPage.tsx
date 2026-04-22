import { trpc } from "@/lib/trpc";
import { motion, AnimatePresence } from "framer-motion";
import { Wand2, Send, Save, Eye, RotateCcw, Sparkles, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

const EXAMPLE_PROMPTS = [
  "Create an invoice for web design services, 3 pages at $500 each, for client Acme Corp",
  "Invoice for consulting services in April 2024, 20 hours at $150/hr for TechStartup Ltd",
  "Generate an invoice for photography services: event coverage $800, editing $200, for John Smith",
];

function formatCurrency(val: number | string | null | undefined) {
  if (!val) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(val));
}

function formatDate(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function ComposerPage() {
  const [prompt, setPrompt] = useState("");
  const [preview, setPreview] = useState<any>(null);
  const [showLineItems, setShowLineItems] = useState(true);
  const [, navigate] = useLocation();

  const composeInvoice = trpc.ai.composeInvoice.useMutation();
  const createInvoice = trpc.invoice.create.useMutation();
  const utils = trpc.useUtils();

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast.error("Please describe the invoice you want to create");
      return;
    }
    try {
      toast.loading("AI is composing your invoice...", { id: "compose" });
      const result = await composeInvoice.mutateAsync({ prompt });
      toast.dismiss("compose");
      setPreview(result);
      toast.success("Invoice composed! Review and save.");
    } catch (err) {
      toast.dismiss("compose");
      toast.error("Failed to compose invoice. Please try again.");
    }
  };

  const handleSave = async () => {
    if (!preview) return;
    try {
      const id = await createInvoice.mutateAsync({
        invoiceNumber: preview.invoiceNumber,
        vendor: preview.vendor,
        clientName: preview.clientName,
        clientEmail: preview.clientEmail,
        description: preview.description,
        amount: preview.amount,
        currency: preview.currency ?? "USD",
        issueDate: preview.issueDate ? new Date(preview.issueDate) : new Date(),
        dueDate: preview.dueDate ? new Date(preview.dueDate) : undefined,
        lineItems: preview.lineItems,
        notes: preview.notes,
        source: "ai_generated",
        status: "draft",
        type: "income",
      });
      utils.invoice.list.invalidate();
      utils.invoice.kpis.invalidate();
      toast.success("Invoice saved!");
      navigate(`/invoices/${id.id}`);
    } catch {
      toast.error("Failed to save invoice");
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center">
            <Wand2 className="w-4.5 h-4.5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">AI Invoice Composer</h1>
            <p className="text-xs text-muted-foreground">Describe your invoice in plain language</p>
          </div>
        </div>
      </div>

      {/* Prompt Input */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-card border border-border rounded-xl p-5 mb-4"
      >
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-4 h-4 text-primary" />
          <p className="text-sm font-medium text-foreground">Describe your invoice</p>
        </div>
        <Textarea
          placeholder="e.g. Create a professional invoice for 3 months of social media management at $1,200/month for client Dubai Luxury Hotels..."
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          className="min-h-[100px] bg-secondary/50 border-border/50 text-sm resize-none mb-3"
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleGenerate();
          }}
        />
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">⌘+Enter to generate</p>
          <div className="flex gap-2">
            {preview && (
              <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => { setPreview(null); setPrompt(""); }}>
                <RotateCcw className="w-3.5 h-3.5" />
                Reset
              </Button>
            )}
            <Button
              size="sm"
              className="gap-1.5 text-xs"
              onClick={handleGenerate}
              disabled={composeInvoice.isPending || !prompt.trim()}
            >
              {composeInvoice.isPending ? (
                <>
                  <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
                    <Sparkles className="w-3.5 h-3.5" />
                  </motion.div>
                  Composing...
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  Generate
                </>
              )}
            </Button>
          </div>
        </div>
      </motion.div>

      {/* Example prompts */}
      {!preview && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="mb-6"
        >
          <p className="text-xs text-muted-foreground mb-2 font-medium">Try an example:</p>
          <div className="space-y-2">
            {EXAMPLE_PROMPTS.map((ex, i) => (
              <motion.button
                key={i}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.15 + i * 0.05 }}
                onClick={() => setPrompt(ex)}
                className="w-full text-left px-4 py-3 rounded-lg bg-secondary/50 hover:bg-secondary border border-border/50 hover:border-primary/30 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                "{ex}"
              </motion.button>
            ))}
          </div>
        </motion.div>
      )}

      {/* Preview */}
      <AnimatePresence>
        {preview && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="bg-card border border-primary/30 rounded-xl overflow-hidden"
          >
            {/* Preview header */}
            <div className="flex items-center justify-between px-5 py-4 bg-primary/10 border-b border-primary/20">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-primary" />
                <p className="text-sm font-semibold text-foreground">Invoice Preview</p>
              </div>
              <Button size="sm" className="gap-1.5 text-xs" onClick={handleSave} disabled={createInvoice.isPending}>
                <Save className="w-3.5 h-3.5" />
                {createInvoice.isPending ? "Saving..." : "Save Invoice"}
              </Button>
            </div>

            <div className="p-5 space-y-5">
              {/* Invoice number + amount */}
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Invoice Number</p>
                  <p className="text-lg font-bold text-foreground">{preview.invoiceNumber}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Total</p>
                  <p className="text-2xl font-bold amount-income">{formatCurrency(preview.amount)}</p>
                </div>
              </div>

              {/* Parties */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-secondary/30 rounded-lg">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">From</p>
                  <p className="text-sm font-semibold text-foreground">{preview.vendor || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Bill To</p>
                  <p className="text-sm font-semibold text-foreground">{preview.clientName || "—"}</p>
                  {preview.clientEmail && <p className="text-xs text-muted-foreground">{preview.clientEmail}</p>}
                </div>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Issue Date</p>
                  <p className="text-sm text-foreground">{formatDate(preview.issueDate)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Due Date</p>
                  <p className="text-sm text-foreground">{formatDate(preview.dueDate)}</p>
                </div>
              </div>

              {/* Line Items */}
              {preview.lineItems?.length > 0 && (
                <div>
                  <button
                    onClick={() => setShowLineItems(!showLineItems)}
                    className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 hover:text-foreground transition-colors"
                  >
                    Line Items ({preview.lineItems.length})
                    {showLineItems ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>
                  <AnimatePresence>
                    {showLineItems && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="border border-border rounded-lg overflow-hidden">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="bg-secondary/50 border-b border-border">
                                <th className="text-left px-3 py-2 text-muted-foreground font-medium">Description</th>
                                <th className="text-right px-3 py-2 text-muted-foreground font-medium">Qty</th>
                                <th className="text-right px-3 py-2 text-muted-foreground font-medium">Price</th>
                                <th className="text-right px-3 py-2 text-muted-foreground font-medium">Total</th>
                              </tr>
                            </thead>
                            <tbody>
                              {preview.lineItems.map((li: any, i: number) => (
                                <tr key={i} className="border-b border-border/50 last:border-0">
                                  <td className="px-3 py-2.5 text-foreground">{li.description}</td>
                                  <td className="px-3 py-2.5 text-right text-muted-foreground">{li.quantity}</td>
                                  <td className="px-3 py-2.5 text-right text-muted-foreground">{formatCurrency(li.unitPrice)}</td>
                                  <td className="px-3 py-2.5 text-right font-semibold text-foreground">{formatCurrency(li.total)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}

              {/* Notes */}
              {preview.notes && (
                <div className="p-3 bg-secondary/30 rounded-lg">
                  <p className="text-xs text-muted-foreground mb-1">Notes</p>
                  <p className="text-sm text-foreground">{preview.notes}</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
