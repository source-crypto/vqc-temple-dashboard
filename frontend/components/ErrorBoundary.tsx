import { Component, ErrorInfo, ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw, Bug } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    // Report error to monitoring service
    this.reportError(error, errorInfo);
    
    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    this.setState({ error, errorInfo });
  }

  private reportError = async (error: Error, errorInfo: ErrorInfo) => {
    try {
      // In a real application, you would send this to your error reporting service
      const errorReport = {
        message: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        url: window.location.href,
      };

      console.log('Error Report:', errorReport);
      
      // Example: Send to error reporting service
      // await fetch('/api/errors', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(errorReport)
      // });
    } catch (reportingError) {
      console.error('Failed to report error:', reportingError);
    }
  };

  private handleRetry = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  private handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <Card className="bg-slate-800 border-red-500 border-2 max-w-2xl mx-auto mt-8">
          <CardHeader>
            <CardTitle className="text-red-400 flex items-center">
              <AlertTriangle className="w-5 h-5 mr-2" />
              Something went wrong
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-slate-300">
              We're sorry, but something unexpected happened. The error has been reported 
              and our team will investigate.
            </div>
            
            {this.state.error && (
              <details className="bg-slate-900 p-4 rounded border border-slate-600">
                <summary className="text-slate-400 cursor-pointer mb-2">
                  Error Details
                </summary>
                <div className="text-red-400 font-mono text-sm">
                  <div className="mb-2">
                    <strong>Error:</strong> {this.state.error.message}
                  </div>
                  {this.state.error.stack && (
                    <div className="text-xs text-slate-500 whitespace-pre-wrap">
                      {this.state.error.stack}
                    </div>
                  )}
                </div>
              </details>
            )}

            <div className="flex space-x-3">
              <Button onClick={this.handleRetry} variant="outline">
                <RefreshCw className="w-4 h-4 mr-2" />
                Try Again
              </Button>
              <Button onClick={this.handleReload} variant="destructive">
                Reload Page
              </Button>
              <Button 
                onClick={() => window.open('mailto:support@vqctemple.com', '_blank')}
                variant="secondary"
              >
                <Bug className="w-4 h-4 mr-2" />
                Report Issue
              </Button>
            </div>
          </CardContent>
        </Card>
      );
    }

    return this.props.children;
  }
}

// Higher-order component for wrapping components with error boundary
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  fallback?: ReactNode
) {
  return function WrappedComponent(props: P) {
    return (
      <ErrorBoundary fallback={fallback}>
        <Component {...props} />
      </ErrorBoundary>
    );
  };
}

// Hook for error reporting in functional components
export function useErrorHandler() {
  return React.useCallback((error: Error, errorInfo?: any) => {
    console.error('Manual error report:', error, errorInfo);
    
    // Report error to monitoring service
    const errorReport = {
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      additionalInfo: errorInfo,
    };

    console.log('Error Report:', errorReport);
  }, []);
}
