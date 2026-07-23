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
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="max-w-md rounded border border-gray-200 bg-white p-8 text-center">
          <h1 className="text-xl font-bold">Something went wrong</h1>
          <p className="mt-2 text-sm text-gray-600">
            An unexpected error occurred. Reloading usually fixes it — your data is safe.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-5 rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white"
          >
            Reload the app
          </button>
        </div>
      </div>
    );
  }
}
