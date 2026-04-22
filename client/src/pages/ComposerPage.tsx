import { trpc } from "@/lib/trpc";
import { motion, AnimatePresence } from "framer-motion";
import {
  Wand2, Send, Save, Eye, RotateCcw, Sparkles, ChevronDown, ChevronUp,
  Bot, Zap, ArrowRight, CheckCircle2, AlertCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

// Mimo's exact service categories from Config.gs
const SERVICE_CATEGORIES = [
  { group: "PROFESSIONAL SERVICES", items: ["Management Consulting", "Business Strategy Advisory", "Project Management", "Operations Consulting"] },
  { group: "CREATIVE & MEDIA", items: ["Creative Direction", "Content Creation", "Brand Development", "Photography & Videography"] },
  { group: "PERFORMANCE", items: ["Acting Services", "Film Direction", "Commercial Performance", "Voice Over Services"] },
  { group: "DIGITAL", items: ["Digital Marketing", "Website Development", "SEO & Online Presence", "Automation & AI Services"] },
  { group: "FREELANCE", items: ["General Freelance Work", "Short-term Project", "Research Services"] },
];

const EXAMPLE_PROMPTS = [
  "Invoice for 3 months of Operations Consulting at AED 8,000/month for Dubai Luxury Hotels LLC",
  "Creative Direction for brand campaign, 2 weeks at AED 5,500/week for Emaar Properties",
  "Business Strategy Advisory: 10 sessions at AED 1,200/session for TechStartup MENA",
];

function formatCurrency(val: number | string | null | undefined, currency = "AED") {
  if (val === null || val === undefined || val === "") return "—";
  return new Intl.NumberFormat("en-AE", { style: "currency", currency }).format(Number(val));
}

function formatDate(d: string | null | undefined) {
  if (!d) return "—";
  try { return new Date(d).toLocaleDateString("en-AE", { month: "short", day: "numeric", year: "numeric" }); }
  catch { return d; }
}

type Mode = "local" | "apps_script";

export default function ComposerPage() {
  const [prompt, setPrompt] = useState("");
  const [preview, setPreview] = useState<any>(null);
  const [showLineItems, setShowLineItems] = useState(true);
  const [mode, setMode] = useState<Mode>("local");
  const [aiHistory, setAiHistory] = useState<any[]>([]);
  const [, navigate] = useLocation();

  // Local LLM compose (always available)
  const composeInvoice = trpc.ai.composeInvoice.useMutation();
  // Apps Script AI (requires URL in Settings)
  const processAi = trpc.ai.processAi.useMutation();
  // Apps Script generate (saves to Google Sheet)
  const generateInvoice = trpc.ai.generateInvoice.useMutation();
  // Local DB save
  const createInvoice = trpc.invoice.create.useMutation();
  const utils = trpc.useUtils();

  const isPending = composeInvoice.isPending || processAi.isPending;

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast.error("Please describe the invoice you want to create");
      return;
    }
    try {
      toast.loading("AI is composing your invoice...", { id: "compose" });

      if (mode === "apps_script") {
        // Use your Gemini 1.5 Flash via Apps Script
        const result = await processAi.mutateAsync({
          prompt,
          history: aiHistory,
        });
        toast.dismiss("compose");

        // result = { message: string, formData: { client_name, client_email, invoice_title,
        //   service_description, quantity, unit_price, currency } }
        const fd = result.formData ?? {};
        const qty = Number(fd.quantity) || 1;
        const unitPrice = Number(fd.unit_price) || 0;
        const subtotal = qty * unitPrice;
        const vat = subtotal * 0.05;
        const total = subtotal + vat;

        // Update conversation history for multi-turn
        setAiHistory(prev => [
          ...prev,
          { role: "user", parts: [{ text: prompt }] },
          { role: "model", parts: [{ text: JSON.stringify(result) }] },
        ]);

        setPreview({
          // Map Apps Script formData fields to our preview format
          invoiceNumber: `INV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
          vendor: "Mirmovsum Mirzazada",
          clientName: fd.client_name ?? "",
          clientEmail: fd.client_email ?? "",
          description: fd.service_description ?? fd.invoice_title ?? "",
          amount: total,
          currency: fd.currency ?? "AED",
          issueDate: new Date().toISOString(),
          dueDate: new Date(Date.now() + 30 * 86400000).toISOString(),
          lineItems: [{
            description: fd.service_description ?? fd.invoice_title ?? "Service",
            quantity: qty,
            unitPrice: unitPrice,
            total: subtotal,
          }],
          notes: `VAT (5%): ${formatCurrency(vat, fd.currency ?? "AED")}`,
          _aiMessage: result.message,
          _formData: fd,
          _mode: "apps_script",
        });
        toast.success(result.message ?? "Invoice composed! Review and save.");
      } else {
        // Use Manus built-in LLM
        const result = await composeInvoice.mutateAsync({ prompt });
        toast.dismiss("compose");
        setPreview({ ...result, _mode: "local" });
        toast.success("Invoice composed! Review and save.");
      }
    } catch (err: any) {
      toast.dismiss("compose");
      const msg = err?.message ?? "Failed to compose invoice";
      if (msg.includes("Apps Script URL not configured")) {
        toast.error("Apps Script not configured. Switching to local AI.", { duration: 4000 });
        setMode("local");
      } else {
        toast.error(msg);
      }
    }
  };

  // Save to Google Sheet via Apps Script + local DB
  const handleSaveToSheet = async () => {
    if (!preview?._formData) return;
    try {
      toast.loading("Saving to Google Sheet...", { id: "save-sheet" });
      const fd = preview._formData;
      const result = await generateInvoice.mutateAsync({
        client_name: fd.client_name ?? preview.clientName,
        client_email: fd.client_email ?? preview.clientEmail,
        invoice_title: fd.invoice_title ?? preview.description,
        service_description: fd.service_description ?? preview.description,
        quantity: Number(fd.quantity) || 1,
        unit_price: Number(fd.unit_price) || 0,
        currency: fd.currency ?? preview.currency ?? "AED",
      });
      toast.dismiss("save-sheet");
      utils.invoice.list.invalidate();
      utils.invoice.kpis.invalidate();
      toast.success(`Invoice ${result.Invoice_No ?? ""} saved to Google Sheet!`);
      if (result.localId) navigate(`/invoices/${result.localId}`);
    } catch (err: any) {
      toast.dismiss("save-sheet");
      toast.error(err?.message ?? "Failed to save to Google Sheet");
    }
  };

  // Save to local DB only
  const handleSaveLocal = async () => {
    if (!preview) return;
    try {
      const id = await createInvoice.mutateAsync({
        invoiceNumber: preview.invoiceNumber,
        vendor: preview.vendor,
        clientName: preview.clientName,
        clientEmail: preview.clientEmail,
        description: preview.description,
        amount: preview.amount,
        currency: preview.currency ?? "AED",
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
    <div className="p-4 md:p-6 max-w-3xl mx-auto pb-24 md:pb-6">
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

      {/* Mode Selector */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setMode("local")}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border transition-all ${
            mode === "local"
              ? "bg-primary/15 border-primary/40 text-primary"
              : "bg-secondary/40 border-border/50 text-muted-foreground hover:text-foreground"
          }`}
        >
          <Zap className="w-3.5 h-3.5" />
          Local AI
        </button>
        <button
          onClick={() => setMode("apps_script")}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border transition-all ${
            mode === "apps_script"
              ? "bg-primary/15 border-primary/40 text-primary"
              : "bg-secondary/40 border-border/50 text-muted-foreground hover:text-foreground"
          }`}
        >
          <Bot className="w-3.5 h-3.5" />
          Gemini (Apps Script)
        </button>
      </div>

      {mode === "apps_script" && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="mb-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg"
        >
          <div className="flex items-start gap-2">
            <AlertCircle className="w-3.5 h-3.5 text-amber-400 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-amber-300">
              Uses your Gemini 1.5 Flash via Apps Script. Requires Apps Script URL in Settings. Saves directly to your Google Sheet.
            </p>
          </div>
        </motion.div>
      )}

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
          placeholder={
            mode === "apps_script"
              ? "e.g. Create invoice for 3 months Operations Consulting at AED 8,000/month for Dubai Luxury Hotels LLC..."
              : "e.g. Invoice for Creative Direction services, 2 weeks at AED 5,500/week for Emaar Properties..."
          }
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
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs"
                onClick={() => { setPreview(null); setPrompt(""); setAiHistory([]); }}
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset
              </Button>
            )}
            <Button
              size="sm"
              className="gap-1.5 text-xs"
              onClick={handleGenerate}
              disabled={isPending || !prompt.trim()}
            >
              {isPending ? (
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
                <ArrowRight className="w-3 h-3 inline mr-1.5 text-primary/60" />
                {ex}
              </motion.button>
            ))}
          </div>

          {/* Service categories reference */}
          <div className="mt-5">
            <p className="text-xs text-muted-foreground mb-2 font-medium">Your service categories:</p>
            <div className="space-y-2">
              {SERVICE_CATEGORIES.map((cat) => (
                <div key={cat.group} className="flex flex-wrap gap-1.5 items-center">
                  <span className="text-xs text-muted-foreground/60 font-medium w-full mb-0.5">{cat.group}</span>
                  {cat.items.map((item) => (
                    <Badge
                      key={item}
                      variant="outline"
                      className="text-xs cursor-pointer hover:bg-primary/10 hover:border-primary/30 transition-colors"
                      onClick={() => setPrompt(`Invoice for ${item} services for `)}
                    >
                      {item}
                    </Badge>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      )}

      {/* AI Message (Apps Script mode) */}
      {preview?._aiMessage && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 p-4 bg-primary/10 border border-primary/20 rounded-xl"
        >
          <div className="flex items-start gap-2">
            <Bot className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
            <p className="text-sm text-foreground">{preview._aiMessage}</p>
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
                {preview._mode === "apps_script" && (
                  <Badge variant="outline" className="text-xs border-primary/30 text-primary">Gemini</Badge>
                )}
              </div>
              <div className="flex gap-2">
                {preview._mode === "apps_script" && preview._formData && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 text-xs"
                    onClick={handleSaveToSheet}
                    disabled={generateInvoice.isPending}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {generateInvoice.isPending ? "Saving..." : "Save to Sheet"}
                  </Button>
                )}
                <Button
                  size="sm"
                  className="gap-1.5 text-xs"
                  onClick={handleSaveLocal}
                  disabled={createInvoice.isPending}
                >
                  <Save className="w-3.5 h-3.5" />
                  {createInvoice.isPending ? "Saving..." : "Save Invoice"}
                </Button>
              </div>
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
                  <p className="text-2xl font-bold amount-income">
                    {formatCurrency(preview.amount, preview.currency ?? "AED")}
                  </p>
                </div>
              </div>

              {/* Parties */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-secondary/30 rounded-lg">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">From</p>
                  <p className="text-sm font-semibold text-foreground">{preview.vendor || "Mirmovsum Mirzazada"}</p>
                  <p className="text-xs text-muted-foreground">Dubai, UAE</p>
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
                                  <td className="px-3 py-2.5 text-right text-muted-foreground">
                                    {formatCurrency(li.unitPrice, preview.currency ?? "AED")}
                                  </td>
                                  <td className="px-3 py-2.5 text-right font-semibold text-foreground">
                                    {formatCurrency(li.total, preview.currency ?? "AED")}
                                  </td>
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
