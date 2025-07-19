import { Alert, Box, Button, Typography } from '@mui/material';
import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <Alert severity="error" sx={{ mb: 2 }}>
          <Box>
            <Typography variant="body2" gutterBottom>
              Something went wrong with this component.
            </Typography>
            <Button size="small" onClick={this.handleRetry} sx={{ mt: 1 }}>
              Try Again
            </Button>
          </Box>
        </Alert>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
