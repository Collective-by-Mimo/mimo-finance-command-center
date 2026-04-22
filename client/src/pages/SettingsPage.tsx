import { trpc } from "@/lib/trpc";
import { motion } from "framer-motion";
import { Settings, Save, ExternalLink, Info, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";

export default function SettingsPage() {
  const { user } = useAuth();
  const settings = trpc.settings.get.useQuery();
  const updateSettings = trpc.settings.update.useMutation();
  const utils = trpc.useUtils();

  const [appsScriptUrl, setAppsScriptUrl] = useState("");
  const [sheetsId, setSheetsId] = useState("");
  const [defaultCurrency, setDefaultCurrency] = useState("USD");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (settings.data) {
      setAppsScriptUrl(settings.data.appsScriptUrl ?? "");
      setSheetsId(settings.data.sheetsId ?? "");
      setDefaultCurrency(settings.data.defaultCurrency ?? "USD");
    }
  }, [settings.data]);

  const handleSave = async () => {
    try {
      await updateSettings.mutateAsync({
        appsScriptUrl: appsScriptUrl || undefined,
        sheetsId: sheetsId || undefined,
        defaultCurrency: defaultCurrency || undefined,
      });
      utils.settings.get.invalidate();
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      toast.success("Settings saved");
    } catch {
      toast.error("Failed to save settings");
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-9 h-9 rounded-xl bg-secondary flex items-center justify-center">
            <Settings className="w-4.5 h-4.5 text-muted-foreground" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Settings</h1>
            <p className="text-xs text-muted-foreground">Configure integrations and preferences</p>
          </div>
        </div>
      </div>

      {/* Profile */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-card border border-border rounded-xl p-5 mb-4"
      >
        <h2 className="text-sm font-semibold text-foreground mb-4">Profile</h2>
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center text-primary font-bold text-lg">
            {user?.name?.slice(0, 2).toUpperCase() ?? "M"}
          </div>
          <div>
            <p className="font-semibold text-foreground">{user?.name ?? "Mimo"}</p>
            <p className="text-sm text-muted-foreground">{user?.email ?? ""}</p>
            <p className="text-xs text-muted-foreground/60 mt-0.5 capitalize">{user?.role ?? "user"}</p>
          </div>
        </div>
      </motion.div>

      {/* Google Integration */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="bg-card border border-border rounded-xl p-5 mb-4"
      >
        <h2 className="text-sm font-semibold text-foreground mb-1">Google Integration</h2>
        <p className="text-xs text-muted-foreground mb-4">Connect Gmail and Google Sheets via Apps Script</p>

        {/* Apps Script setup guide */}
        <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg mb-4">
          <div className="flex items-start gap-2">
            <Info className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-medium text-primary mb-1">Setup Instructions</p>
              <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
                <li>Open Google Apps Script (script.google.com)</li>
                <li>Create a new project and paste the integration script</li>
                <li>Deploy as a Web App (Execute as: Me, Access: Anyone)</li>
                <li>Copy the deployment URL and paste it below</li>
              </ol>
              <a
                href="https://script.google.com"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-primary mt-2 hover:underline"
              >
                Open Apps Script <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block font-medium">
              Apps Script Web App URL
            </label>
            <Input
              value={appsScriptUrl}
              onChange={(e) => setAppsScriptUrl(e.target.value)}
              placeholder="https://script.google.com/macros/s/.../exec"
              className="bg-secondary/50 border-border/50 text-sm font-mono"
            />
            <p className="text-xs text-muted-foreground/60 mt-1">
              Used for both Gmail scanning and Sheets sync
            </p>
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block font-medium">
              Google Sheets ID (optional)
            </label>
            <Input
              value={sheetsId}
              onChange={(e) => setSheetsId(e.target.value)}
              placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms"
              className="bg-secondary/50 border-border/50 text-sm font-mono"
            />
            <p className="text-xs text-muted-foreground/60 mt-1">
              The ID from your Google Sheets URL
            </p>
          </div>
        </div>
      </motion.div>

      {/* Preferences */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-card border border-border rounded-xl p-5 mb-6"
      >
        <h2 className="text-sm font-semibold text-foreground mb-4">Preferences</h2>
        <div>
          <label className="text-xs text-muted-foreground mb-1.5 block font-medium">Default Currency</label>
          <div className="flex gap-2 flex-wrap">
            {["USD", "EUR", "GBP", "AED", "AZN"].map((c) => (
              <button
                key={c}
                onClick={() => setDefaultCurrency(c)}
                className={cn(
                  "px-4 py-2 rounded-lg text-sm font-medium transition-colors border",
                  defaultCurrency === c
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-secondary text-muted-foreground border-border hover:text-foreground"
                )}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Save */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
      >
        <Button
          className="w-full gap-2"
          onClick={handleSave}
          disabled={updateSettings.isPending}
        >
          {saved ? (
            <>
              <CheckCircle className="w-4 h-4" />
              Saved!
            </>
          ) : updateSettings.isPending ? (
            "Saving..."
          ) : (
            <>
              <Save className="w-4 h-4" />
              Save Settings
            </>
          )}
        </Button>
      </motion.div>
    </div>
  );
}
