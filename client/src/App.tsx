import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import BroadcastPage from "@/pages/broadcast";
import ListenPage from "@/pages/listen";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={BroadcastPage} />
      <Route path="/broadcast" component={BroadcastPage} />
      <Route path="/listen" component={ListenPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <div className="min-h-screen bg-slate-50 font-inter">
          <Toaster />
          <Router />
          
          {/* Footer */}
          <footer className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 py-3">
            <div className="max-w-7xl mx-auto px-4 text-center">
              <p className="text-sm text-slate-600">
                Developed by <span className="font-semibold text-slate-800">Shepherd Zsper Phiri</span>
              </p>
            </div>
          </footer>
        </div>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
