import React, { Component, type ReactNode } from "react";
import { AlertTriangle, RefreshCw, Home, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
  fallbackRoute?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: string;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null, errorInfo: "" };

  static getDerivedStateFromError(error: Error): Partial<State> {
    // Ignore non-fatal React DOM cleanup errors caused by portal conflicts
    if (error?.message?.includes("removeChild") || error?.message?.includes("removeNode")) {
      console.warn("[ErrorBoundary] Ignoring non-fatal DOM cleanup error:", error.message);
      return {};
    }
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    if (error?.message?.includes("removeChild") || error?.message?.includes("removeNode")) {
      return; // Don't log non-fatal portal cleanup errors
    }
    console.error("[ErrorBoundary]", error, info.componentStack);
    this.setState({ errorInfo: info.componentStack || "" });
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: "" });
  };

  handleGoHome = () => {
    window.location.href = this.props.fallbackRoute || "/";
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    const msg = this.state.error?.message || "Something went wrong";
    const isNetwork = msg.includes("network") || msg.includes("Failed to fetch") || msg.includes("NetworkError");
    const isAuth = msg.includes("Session expired") || msg.includes("401") || msg.includes("Unauthorized");

    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="mx-auto w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
            {isNetwork ? (
              <WifiOff className="h-8 w-8 text-destructive" />
            ) : (
              <AlertTriangle className="h-8 w-8 text-destructive" />
            )}
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-semibold text-foreground">
              {isNetwork ? "Connection Lost" : isAuth ? "Session Expired" : "Something Went Wrong"}
            </h2>
            <p className="text-sm text-muted-foreground">
              {isNetwork
                ? "Unable to reach the server. Please check your internet connection and try again."
                : isAuth
                  ? "Your session has expired. Please log in again to continue."
                  : "An unexpected error occurred. You can try again or return to the dashboard."}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            {isAuth ? (
              <Button onClick={() => (window.location.href = "/admin/login")} className="gap-2">
                <RefreshCw className="h-4 w-4" /> Log In Again
              </Button>
            ) : (
              <>
                <Button onClick={this.handleRetry} className="gap-2">
                  <RefreshCw className="h-4 w-4" /> Try Again
                </Button>
                <Button variant="outline" onClick={this.handleGoHome} className="gap-2">
                  <Home className="h-4 w-4" /> Go to Dashboard
                </Button>
              </>
            )}
          </div>

          {import.meta.env.DEV && this.state.error && (
            <details className="mt-4 text-left border border-border rounded-lg p-3 bg-muted/30">
              <summary className="text-xs font-medium text-muted-foreground cursor-pointer">
                Error Details (dev only)
              </summary>
              <pre className="mt-2 text-xs text-destructive overflow-auto max-h-40 whitespace-pre-wrap">
                {msg}
                {this.state.errorInfo}
              </pre>
            </details>
          )}
        </div>
      </div>
    );
  }
}
