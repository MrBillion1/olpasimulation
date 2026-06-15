import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Component, ReactNode, useEffect } from "react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";
import SCL from "./pages/SCL.tsx";
import SCLHub from "./pages/SCLHub.tsx";
import { startEngine } from "@/lib/simulation-store";
import { installNpcEngine, seedInitialPosts } from "@/lib/npc-voices";
import { loadPersistedState, installAutoSave } from "@/lib/persistence";

const queryClient = new QueryClient();

class AppErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error('App render failure:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
          <div className="border border-border bg-card/80 rounded-md p-5 max-w-sm w-full space-y-3">
            <div className="font-mono text-[12px] font-bold uppercase tracking-widest text-gold">Session recovered</div>
            <button
              onClick={() => this.setState({ hasError: false })}
              className="w-full text-[10px] uppercase tracking-wider font-bold px-4 py-2 rounded bg-gold text-primary-foreground hover:brightness-110"
            >
              Resume Terminal
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function Bootstrap() {
  useEffect(() => {
    startEngine();
    installNpcEngine();
    seedInitialPosts();
    installAutoSave();
    loadPersistedState();
  }, []);
  return null;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
      <TooltipProvider>
      <Toaster />
      <Sonner />
        <AppErrorBoundary>
          <BrowserRouter>
            <Bootstrap />
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/scl" element={<SCL />} />
              <Route path="/scl/:contract" element={<SCLHub />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </AppErrorBoundary>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
