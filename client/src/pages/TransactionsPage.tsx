import { trpc } from "@/lib/trpc";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Plus, ArrowUpRight, ArrowDownLeft, ArrowLeftRight, Trash2, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";

const TYPE_FILTERS = ["all", "income", "expense", "transfer"] as const;
const CATEGORIES = ["Salary", "Freelance", "Rent", "Utilities", "Food", "Transport", "Software", "Marketing", "Tax", "Other"];

function formatCurrency(val: number | string | null | undefined) {
  if (!val) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0 }).format(Number(val));
}

function formatDate(d: Date | string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

type TxForm = {
  description: string;
  amount: number;
  type: "income" | "expense" | "transfer";
  category: string;
  date: string;
};

export default function TransactionsPage() {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [addOpen, setAddOpen] = useState(false);
  const { register, handleSubmit, reset, watch, setValue } = useForm<TxForm>({
    defaultValues: { type: "expense", date: new Date().toISOString().slice(0, 10) },
  });

  const transactions = trpc.transaction.list.useQuery({
    search: search || undefined,
    type: typeFilter === "all" ? undefined : typeFilter,
    limit: 100,
  });

  const createTx = trpc.transaction.create.useMutation();
  const deleteTx = trpc.transaction.delete.useMutation();
  const utils = trpc.useUtils();

  const onSubmit = async (data: TxForm) => {
    try {
      await createTx.mutateAsync({
        description: data.description,
        amount: Number(data.amount),
        type: data.type,
        category: data.category || undefined,
        date: new Date(data.date),
      });
      utils.transaction.list.invalidate();
      toast.success("Transaction added");
      setAddOpen(false);
      reset();
    } catch {
      toast.error("Failed to add transaction");
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteTx.mutateAsync({ id });
      utils.transaction.list.invalidate();
      toast.success("Transaction deleted");
    } catch {
      toast.error("Failed to delete");
    }
  };

  const txType = watch("type");

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-foreground">Transactions</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{transactions.data?.length ?? 0} records</p>
        </div>
        <Button size="sm" className="gap-1.5 text-xs" onClick={() => setAddOpen(true)}>
          <Plus className="w-3.5 h-3.5" />
          Add
        </Button>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search transactions..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 bg-secondary/50 border-border/50 text-sm"
        />
      </div>

      {/* Type filters */}
      <div className="flex gap-1.5 mb-4 overflow-x-auto pb-1">
        {TYPE_FILTERS.map((t) => (
          <button
            key={t}
            onClick={() => setTypeFilter(t)}
            className={cn(
              "px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors flex-shrink-0",
              typeFilter === t ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"
            )}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* Transaction list */}
      <div className="space-y-2">
        {transactions.isLoading ? (
          Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-16 bg-card border border-border rounded-xl animate-pulse" />
          ))
        ) : transactions.data?.length === 0 ? (
          <div className="text-center py-16">
            <ArrowLeftRight className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">No transactions yet</p>
            <Button variant="outline" size="sm" className="mt-4 gap-2" onClick={() => setAddOpen(true)}>
              <Plus className="w-3.5 h-3.5" />
              Add Transaction
            </Button>
          </div>
        ) : (
          <AnimatePresence>
            {transactions.data?.map((tx, i) => (
              <motion.div
                key={tx.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ delay: i * 0.02 }}
                className="flex items-center gap-3 p-4 bg-card border border-border rounded-xl group hover:border-border/80 transition-colors"
              >
                <div className={cn(
                  "w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0",
                  tx.type === "income" ? "bg-emerald-500/15" : tx.type === "expense" ? "bg-red-500/15" : "bg-blue-500/15"
                )}>
                  {tx.type === "income" ? (
                    <ArrowDownLeft className="w-4 h-4 text-emerald-400" />
                  ) : tx.type === "expense" ? (
                    <ArrowUpRight className="w-4 h-4 text-red-400" />
                  ) : (
                    <ArrowLeftRight className="w-4 h-4 text-blue-400" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{tx.description}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <p className="text-xs text-muted-foreground">{formatDate(tx.date)}</p>
                    {tx.category && (
                      <span className="flex items-center gap-1 text-[10px] text-muted-foreground/70">
                        <Tag className="w-2.5 h-2.5" />
                        {tx.category}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <p className={cn(
                    "text-sm font-bold",
                    tx.type === "income" ? "amount-income" : tx.type === "expense" ? "amount-expense" : "text-foreground"
                  )}>
                    {tx.type === "income" ? "+" : tx.type === "expense" ? "-" : ""}{formatCurrency(tx.amount)}
                  </p>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-7 h-7 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                    onClick={() => handleDelete(tx.id)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>

      {/* Add Transaction Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-foreground">Add Transaction</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">Description</label>
              <Input {...register("description", { required: true })} placeholder="e.g. Client payment" className="bg-secondary/50" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Amount</label>
                <Input type="number" step="0.01" {...register("amount", { required: true, min: 0 })} placeholder="0.00" className="bg-secondary/50" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Type</label>
                <Select value={txType} onValueChange={(v) => setValue("type", v as any)}>
                  <SelectTrigger className="bg-secondary/50 border-border/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    <SelectItem value="income">Income</SelectItem>
                    <SelectItem value="expense">Expense</SelectItem>
                    <SelectItem value="transfer">Transfer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Category</label>
                <Select onValueChange={(v) => setValue("category", v)}>
                  <SelectTrigger className="bg-secondary/50 border-border/50">
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Date</label>
                <Input type="date" {...register("date")} className="bg-secondary/50" />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setAddOpen(false)}>Cancel</Button>
              <Button type="submit" className="flex-1" disabled={createTx.isPending}>
                {createTx.isPending ? "Adding..." : "Add Transaction"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
