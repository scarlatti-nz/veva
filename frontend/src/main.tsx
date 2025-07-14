import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initSentry } from "./utils/sentry.ts";

if (import.meta.env.VITE_SENTRY_DSN) {
  initSentry(import.meta.env.VITE_SENTRY_DSN);
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
