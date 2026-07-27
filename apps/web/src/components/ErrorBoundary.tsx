import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Last-resort error boundary around the whole app: a render error shows a
 * recoverable message instead of a blank screen. Data-layer errors are handled
 * closer to their source by TanStack Query error states.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Surface in the browser console for debugging/error reporting tools.
    console.error('Unhandled render error:', error, info.componentStack);
  }

  render(): ReactNode {
    if (!this.state.error) return this.props.children;

    return (
      <div className="flex min-h-screen items-center justify-center bg-base p-6">
        <Card className="max-w-md items-center px-8 py-10 text-center">
          <span className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-emergency-subtle text-emergency">
            <AlertTriangle className="h-6 w-6" aria-hidden />
          </span>
          <h1 className="text-h4 text-ink">Something went wrong</h1>
          <p className="mt-1.5 max-w-sm text-body leading-6 text-ink-muted">
            An unexpected error occurred. Reloading usually fixes it — your data is safe.
          </p>
          <Button className="mt-6" onClick={() => window.location.reload()}>
            Reload the app
          </Button>
        </Card>
      </div>
    );
  }
}
