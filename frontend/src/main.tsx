import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { RuntimeErrorBoundary } from "@/components/runtime-error-boundary";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <RuntimeErrorBoundary>
      <App />
    </RuntimeErrorBoundary>
  </React.StrictMode>,
);
