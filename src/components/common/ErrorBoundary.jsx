import React from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error("ErrorBoundary caught:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
          <div className="w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center">
            <AlertTriangle className="w-7 h-7 text-destructive" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">Ein Fehler ist aufgetreten</h2>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm">
              {this.props.message || "Diese Seite konnte nicht geladen werden. Möglicherweise sind die Daten zu umfangreich."}
            </p>
            {this.state.error?.message && (
              <p className="text-xs text-muted-foreground/60 mt-2 font-mono">{this.state.error.message}</p>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => this.setState({ hasError: false, error: null })}>
              Erneut versuchen
            </Button>
            <Button onClick={() => window.history.back()}>
              Zurück
            </Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}