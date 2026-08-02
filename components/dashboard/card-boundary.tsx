"use client";

import { Component, type ReactNode } from "react";
import { CardError } from "@/components/dashboard/card-states";

/**
 * Suspense only catches loading states, not thrown errors — a failing card
 * needs its own error boundary so it degrades in place instead of taking
 * down the whole dashboard grid.
 */
export class CardBoundary extends Component<
  { children: ReactNode; errorTitle: string; retryLabel: string },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return <CardError title={this.props.errorTitle} retryLabel={this.props.retryLabel} />;
    }
    return this.props.children;
  }
}
