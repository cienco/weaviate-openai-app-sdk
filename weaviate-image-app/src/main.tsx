import React from "react";
import ReactDOM from "react-dom/client";
import { OpenAIProvider } from "@openai/apps";
import App from "./App";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <OpenAIProvider>
      <App />
    </OpenAIProvider>
  </React.StrictMode>
);
