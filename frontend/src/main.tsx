import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

import "./i18n";

// Error boundary for initialization
try {
  const rootElement = document.getElementById("root");
  
  if (!rootElement) {
    throw new Error("Root element not found");
  }

  createRoot(rootElement).render(<App />);
} catch (error) {
  console.error("Failed to initialize app:", error);
  // Fallback UI
  document.body.innerHTML = `
    <div style="display: flex; align-items: center; justify-content: center; min-height: 100vh; font-family: sans-serif;">
      <div style="text-align: center; padding: 2rem;">
        <h1 style="color: #dc2626; margin-bottom: 1rem;">Failed to load application</h1>
        <p style="color: #6b7280;">Please check the console for more details.</p>
        <p style="color: #6b7280; margin-top: 1rem;">Error: ${error instanceof Error ? error.message : 'Unknown error'}</p>
      </div>
    </div>
  `;
}
