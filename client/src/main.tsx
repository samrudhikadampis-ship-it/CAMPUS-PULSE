import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

type BoundaryState = { error: Error | null };

class AppErrorBoundary extends React.Component<React.PropsWithChildren, BoundaryState> {
  state: BoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): BoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("CampusPulse render failed:", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <main
          role="alert"
          style={{
            minHeight: "100vh",
            display: "grid",
            placeItems: "center",
            padding: 24,
            background: "var(--bg)",
            color: "var(--tx)"
          }}
        >
          <div style={{ maxWidth: 640 }}>
            <h1 style={{ color: "var(--or2)", fontSize: 36 }}>CampusPulse couldn't render</h1>
            <p>{this.state.error.message}</p>
            <p>Next step: Check the browser console and verify the backend response shape.</p>
          </div>
        </main>
      );
    }
    return this.props.children;
  }
}

const rootElement = document.getElementById("root");
if (rootElement) {
  createRoot(rootElement).render(
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  );
}
