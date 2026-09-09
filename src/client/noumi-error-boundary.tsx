import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "./components/ui/button";
import { Card } from "./components/ui/card";

/** Error Boundary 内部状态。 */
type NoumiErrorBoundaryState = {
	error: Error | null;
};

/** starter 默认错误兜底；保留可见失败状态并把 React 已捕获异常主动交给 diagnostics。 */
export class NoumiErrorBoundary extends Component<
	{ children: ReactNode },
	NoumiErrorBoundaryState
> {
	state: NoumiErrorBoundaryState = { error: null };

	static getDerivedStateFromError(error: Error): NoumiErrorBoundaryState {
		return { error };
	}

	componentDidCatch(error: Error, info: ErrorInfo): void {
		// React 已吞掉该异常，必须主动报告；内部 reporter 失败不会再次抛错。
		window.__NOUMI_REPORT_REACT_ERROR__(error, info.componentStack);
	}

	render(): ReactNode {
		if (!this.state.error) return this.props.children;
		return (
			<main className="flex min-h-screen items-center justify-center bg-background p-6 text-foreground">
				<Card className="w-full max-w-xl space-y-4 p-6">
					<div>
						<p className="text-sm font-medium text-destructive">Light System render failed</p>
						<h1 className="mt-2 text-xl font-semibold">The page encountered an unrecoverable error</h1>
						<p className="mt-2 text-sm text-muted-foreground">
							The error remains visible in DevTools, and Noumi diagnostics has been notified when possible.
						</p>
					</div>
					<pre className="max-h-40 overflow-auto rounded-md bg-muted p-3 text-xs">
						{this.state.error.message}
					</pre>
					<Button onClick={() => location.reload()} type="button">
						Reload
					</Button>
				</Card>
			</main>
		);
	}
}
