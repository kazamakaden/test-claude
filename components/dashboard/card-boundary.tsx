"use client";

import { Component, type ReactNode } from "react";
import { unstable_rethrow } from "next/navigation";
import { CardError } from "@/components/dashboard/card-states";

type BoundaryError = Error & { digest?: string };

/**
 * Suspense only catches loading states, not thrown errors — a failing card
 * needs its own error boundary so it degrades in place instead of taking
 * down the whole dashboard grid.
 */
export class CardBoundary extends Component<
  { children: ReactNode; errorTitle: string; retryLabel: string },
  { hasError: boolean; digest?: string }
> {
  state: { hasError: boolean; digest?: string } = { hasError: false };

  static getDerivedStateFromError(error: BoundaryError) {
    // redirect()/notFound()/dynamic-rendering bailouts are thrown by Next
    // as control-flow signals, not real failures — a boundary that
    // swallows them turns a working redirect (or a correct "this must be
    // rendered dynamically" bailout) into a permanent error card instead
    // of letting Next's own machinery handle it. This is the same lesson
    // CLAUDE.md already records for services/dashboard.ts's redirect()
    // call, applied here to the one place in the codebase that catches
    // errors from an arbitrary Server Component subtree.
    unstable_rethrow(error);
    return { hasError: true, digest: error.digest };
  }

  componentDidCatch(error: BoundaryError) {
    // Vercel's Runtime Logs key a production error by its digest — this is
    // the one thing missing that made a live-only card failure
    // undiagnosable without shipping this logging first.
    console.error(error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <CardError
          title={this.props.errorTitle}
          retryLabel={this.props.retryLabel}
          digest={this.state.digest}
        />
      );
    }
    return this.props.children;
  }
}
