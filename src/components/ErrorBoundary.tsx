import { Component, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error) {
    console.error(error);
  }

  render() {
    if (!this.state.hasError || !this.state.error) {
      return this.props.children;
    }

    const isChunkError =
      this.state.error.message.includes('Loading chunk') ||
      this.state.error.message.includes('Importing a module script failed');

    return (
      <div className="flex h-screen w-full flex-col items-center justify-center gap-4 p-4 text-center">
        <h2 className="text-2xl font-bold">Something went wrong!</h2>
        <p className="text-muted-foreground">
          {isChunkError
            ? 'A new version of the app is available.'
            : 'An unexpected error occurred.'}
        </p>
        <Button
          onClick={() => {
            if (isChunkError) {
              window.location.reload();
            } else {
              this.setState({ hasError: false, error: null });
            }
          }}
        >
          {isChunkError ? 'Reload' : 'Try again'}
        </Button>
      </div>
    );
  }
}
