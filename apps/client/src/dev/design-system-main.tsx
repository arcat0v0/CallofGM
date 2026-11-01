import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { DesignSystemDemo } from "./design-system-demo";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import "@/styles/globals.css";

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Root element not found");

createRoot(rootElement).render(
  <StrictMode>
    <TooltipProvider>
      <DesignSystemDemo />
      <Toaster />
    </TooltipProvider>
  </StrictMode>,
);