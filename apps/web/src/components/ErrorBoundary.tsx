import { Component, type ErrorInfo, type ReactNode } from 'react';

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
      <div className="flex min-h-screen items-center justify-center bg-surface-2 p-6">
        <div className="max-w-md rounded-2xl border border-line-subtle bg-surface p-8 text-center shadow-sm">
          <h1 className="text-lg font-semibold text-ink">Something went wrong</h1>
          <p className="mt-2 text-sm text-ink-muted">
            An unexpected error occurred. Reloading usually fixes it — your data is safe.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="focus-ring mt-5 rounded-lg bg-brand-700 px-4 py-2 text-sm font-medium text-white hover:bg-brand-800"
          >
            Reload the app
          </button>
        </div>
      </div>
    );
  }
}
