import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Dashboard from "./pages/Dashboard";
import InvoicesPage from "./pages/InvoicesPage";
import InvoiceDetail from "./pages/InvoiceDetail";
import TransactionsPage from "./pages/TransactionsPage";
import ComposerPage from "./pages/ComposerPage";
import SyncPage from "./pages/SyncPage";
import SettingsPage from "./pages/SettingsPage";
import AppLayout from "./components/AppLayout";
import LandingPage from "./pages/LandingPage";

function Router() {
  return (
    <Switch>
      <Route path="/" component={LandingPage} />
      <Route path="/dashboard">
        <AppLayout><Dashboard /></AppLayout>
      </Route>
      <Route path="/invoices">
        <AppLayout><InvoicesPage /></AppLayout>
      </Route>
      <Route path="/invoices/:id">
        {(params) => <AppLayout><InvoiceDetail id={Number(params.id)} /></AppLayout>}
      </Route>
      <Route path="/transactions">
        <AppLayout><TransactionsPage /></AppLayout>
      </Route>
      <Route path="/composer">
        <AppLayout><ComposerPage /></AppLayout>
      </Route>
      <Route path="/sync">
        <AppLayout><SyncPage /></AppLayout>
      </Route>
      <Route path="/settings">
        <AppLayout><SettingsPage /></AppLayout>
      </Route>
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster
            position="top-center"
            toastOptions={{
              style: {
                background: "oklch(0.14 0.012 250)",
                border: "1px solid oklch(0.22 0.015 250)",
                color: "oklch(0.96 0.005 250)",
              },
            }}
          />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
