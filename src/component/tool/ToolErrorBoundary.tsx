"use client";

import React, { Component, type ReactNode } from "react";
import { captureError } from "@/module/observability";
import { reportClientErrorMetric } from "@/module/observability/errorMetric.client";

interface Props {
    children: ReactNode;
    toolId: string;
}

interface State {
    hasError: boolean;
}

export class ToolErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError(): State {
        return { hasError: true };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
        reportClientErrorMetric(error, { failureCategory: "tool-render-error", toolId: this.props.toolId });
        captureError(error, {
            toolId: this.props.toolId,
            componentStack: errorInfo.componentStack,
            boundary: "ToolErrorBoundary",
        });
    }

    render(): ReactNode {
        if (this.state.hasError) {
            return (
                <div className="p-6 rounded-lg border border-danger/20 bg-danger/5 text-center">
                    <h3 className="text-lg font-semibold text-danger mb-2">Something went wrong</h3>
                    <p className="text-textMuted mb-4">
                        The tool encountered an unexpected error and could not continue.
                    </p>
                    <button
                        onClick={() => this.setState({ hasError: false })}
                        className="px-4 py-2 bg-danger text-white rounded-md hover:bg-danger/90 transition-colors"
                    >
                        Try again
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}
