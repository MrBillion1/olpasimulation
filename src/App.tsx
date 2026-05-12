import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { useEffect } from "react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";
import SCL from "./pages/SCL.tsx";
import SCLHub from "./pages/SCLHub.tsx";
import { startEngine } from "@/lib/simulation-store";
import { installNpcEngine, seedInitialPosts } from "@/lib/npc-voices";

const queryClient = new QueryClient();

function Bootstrap() {
  useEffect(() => {
    startEngine();
    installNpcEngine();
    seedInitialPosts();
  }, []);
  return null;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
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
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
