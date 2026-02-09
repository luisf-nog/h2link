// Ensure Supabase env vars are available BEFORE any module imports them
if (!import.meta.env.VITE_SUPABASE_URL) {
  (import.meta.env as any).VITE_SUPABASE_URL = "https://dalarhopratsgzmmzhxx.supabase.co";
}
if (!import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY) {
  (import.meta.env as any).VITE_SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRhbGFyaG9wcmF0c2d6bW16aHh4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwODM5NDksImV4cCI6MjA4NDY1OTk0OX0.CIV7u2pMSudse-Zpfqf8OHLkm_exZn0EaYXVEFwoXTQ";
}
if (!import.meta.env.VITE_SUPABASE_PROJECT_ID) {
  (import.meta.env as any).VITE_SUPABASE_PROJECT_ID = "dalarhopratsgzmmzhxx";
}

// Use dynamic imports so env vars are set before supabase client initializes
async function bootstrap() {
  try {
    await import("./i18n");
    await import("./index.css");
    const { createRoot } = await import("react-dom/client");
    const { default: App } = await import("./App.tsx");

    const rootElement = document.getElementById("root");
    if (!rootElement) {
      throw new Error("Root element not found");
    }
    createRoot(rootElement).render(<App />);
  } catch (error) {
    console.error("Failed to initialize app:", error);
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
}

bootstrap();
