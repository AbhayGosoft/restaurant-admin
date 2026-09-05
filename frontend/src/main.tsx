import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { App } from "@/app/App";
import { queryClient } from "@/lib/query-client";
import { SocketProvider } from "@/providers/SocketProvider";
import { BackButtonProvider } from "@/providers/BackButtonProvider";
import "@/styles/index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <BackButtonProvider>
          <SocketProvider>
            <App />
          </SocketProvider>
        </BackButtonProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
