import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in NodeCraft:', error, errorInfo);
  }

  // Auto-recover when the children change (e.g., user navigates / parents
  // re-render with new props after a transient error).
  public componentDidUpdate(prevProps: Props) {
    if (this.state.hasError && prevProps.children !== this.props.children) {
      this.setState({ hasError: false, error: null });
    }
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 transition-colors duration-200">
          <div className="w-full max-w-md bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 p-6">
            <h2 className="text-xl font-bold text-red-600 dark:text-red-400 mb-2">Something went wrong</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
              An unexpected error occurred in the application canvas. You can try
              resetting the workspace (without losing your diagram) or reload the
              page entirely.
            </p>
            <div className="bg-slate-100 dark:bg-slate-950 rounded p-3 text-xs font-mono overflow-auto max-h-40 mb-4 text-red-500 whitespace-pre-wrap break-words">
              {this.state.error?.toString() || 'Unknown error'}
            </div>
            <div className="flex gap-2">
              <button
                onClick={this.handleReset}
                className="flex-1 py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium transition-colors"
              >
                Try Again
              </button>
              <button
                onClick={this.handleReload}
                className="flex-1 py-2 px-4 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded font-medium transition-colors"
              >
                Reload Page
              </button>
            </div>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-3 text-center">
              Your diagram is auto-saved to localStorage, so reloading is safe.
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
