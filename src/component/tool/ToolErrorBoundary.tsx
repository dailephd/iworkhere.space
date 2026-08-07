"use client";

import React, { Component, type ReactNode } from "react";
import { captureError } from "@/module/observability";

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
        captureError(error, {
            toolId: this.props.toolId,
            componentStack: errorInfo.componentStack,
            boundary: "ToolErrorBoundary",
        });
    }

    render(): ReactNode {
        if (this.state.hasError) {
            return (
                <div className="error-state" role="alert">
                    <h2 className="mb-2 text-xl font-semibold leading-7 text-danger">Something went wrong</h2>
                    <p className="mb-5 text-text-secondary">
                        The tool encountered an unexpected error and could not continue.
                    </p>
                    <button
                        onClick={() => this.setState({ hasError: false })}
                        className="button-base button-danger"
                    >
                        Try again
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}
