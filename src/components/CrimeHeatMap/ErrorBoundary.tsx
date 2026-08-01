import { Component, type ReactNode } from 'react';

export interface ErrorBoundaryProps {
  children: ReactNode;
  fallback: ReactNode;
  onError?: (error: Error) => void;
}

interface State { hasError: boolean }

/**
 * Contains a render failure inside the component's own box.
 *
 * This is a library dropped into someone else's page; a crash here must not
 * take that page down with it.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, State> {
  override state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  override componentDidCatch(error: Error): void {
    this.props.onError?.(error);
  }

  override render(): ReactNode {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}
