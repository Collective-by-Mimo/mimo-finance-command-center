import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { motion } from "framer-motion";
import { Zap, ArrowRight, BarChart3, FileText, Brain, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect } from "react";
import { useLocation } from "wouter";

const features = [
  { icon: BarChart3, title: "Live Dashboard", desc: "Real-time KPIs: income, expenses, balance, and pending invoices at a glance." },
  { icon: FileText, title: "Invoice Management", desc: "Create, track, and export professional invoices with PDF preview." },
  { icon: Brain, title: "AI Composer", desc: "Generate invoices from natural language. Just describe what you need." },
  { icon: RefreshCw, title: "Gmail & Sheets Sync", desc: "Auto-scan emails for invoices and sync your ledger with Google Sheets." },
];

export default function LandingPage() {
  const { isAuthenticated, loading } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!loading && isAuthenticated) {
      navigate("/dashboard");
    }
  }, [isAuthenticated, loading, navigate]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="px-6 py-4 flex items-center justify-between border-b border-border/50">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
            <Zap className="w-4 h-4 text-primary" />
          </div>
          <span className="font-semibold text-sm tracking-tight">Finance Command</span>
        </div>
        <Button
          size="sm"
          onClick={() => window.location.href = getLoginUrl()}
          className="gap-2"
        >
          Sign in <ArrowRight className="w-3.5 h-3.5" />
        </Button>
      </header>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-16 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="max-w-2xl"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-medium mb-6">
            <Zap className="w-3 h-3" />
            MFIAS — Mimo's Finance Intelligence & Automation System
          </div>

          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-foreground mb-4 leading-tight">
            Your finances,{" "}
            <span className="gradient-text">intelligently automated</span>
          </h1>

          <p className="text-muted-foreground text-lg mb-8 leading-relaxed">
            A premium finance command center with AI-powered invoice parsing, Gmail scanning,
            Google Sheets sync, and real-time dashboards — built for precision.
          </p>

          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Button
              size="lg"
              onClick={() => window.location.href = getLoginUrl()}
              className="gap-2 px-8 h-12 text-base font-semibold"
            >
              Enter Command Center
              <ArrowRight className="w-4 h-4" />
            </Button>
          </motion.div>
        </motion.div>

        {/* Features grid */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-16 max-w-2xl w-full"
        >
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + i * 0.1 }}
              className="glass rounded-xl p-5 text-left"
            >
              <div className="w-9 h-9 rounded-lg bg-primary/15 flex items-center justify-center mb-3">
                <f.icon className="w-4.5 h-4.5 text-primary" />
              </div>
              <h3 className="font-semibold text-foreground text-sm mb-1.5">{f.title}</h3>
              <p className="text-muted-foreground text-xs leading-relaxed">{f.desc}</p>
            </motion.div>
          ))}
        </motion.div>
      </main>

      <footer className="px-6 py-4 border-t border-border/50 text-center text-xs text-muted-foreground">
        Mimo's Finance Command Center — Built with precision
      </footer>
    </div>
  );
}
