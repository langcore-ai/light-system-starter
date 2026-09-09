import { useState } from "react";
import { Bug, ImageOff, RadioTower, Repeat2, ShieldAlert } from "lucide-react";
import { Button } from "./components/ui/button";
import { Card } from "./components/ui/card";

/** Crash child component for Error Boundary acceptance testing. */
function DiagnosticsRenderCrash(): never {
	throw new Error("Diagnostics test: React Error Boundary");
}

/** Visible diagnostics acceptance fixture. */
export function DiagnosticsTestPanel() {
	const [missingImageKey, setMissingImageKey] = useState(0);
	const [renderCrash, setRenderCrash] = useState(false);
	const [lastAction, setLastAction] = useState("No test error triggered yet");

	if (renderCrash) return <DiagnosticsRenderCrash />;

	/** Throw after the current event loop so the React click handler does not handle it. */
	function throwRuntimeError() {
		setLastAction("Triggered synchronous/callback error");
		setTimeout(() => {
			throw new Error("Diagnostics test: runtime error");
		}, 0);
	}

	/** Produce an unhandled rejection observable by the browser. */
	function rejectPromise() {
		setLastAction("Triggered unhandled Promise rejection");
		void Promise.reject(new Error("Diagnostics test: unhandled rejection"));
	}

	/** Explicitly report an exception already caught by business code. */
	function reportCaughtError() {
		setLastAction("Explicitly called reportError");
		try {
			throw new Error("Diagnostics test: caught business error");
		} catch (error) {
			window.NoumiBridge.diagnostics.reportError(error, {
				component: "DiagnosticsTestPanel",
				operation: "diagnostics.manual",
				tags: { fixture: true, scenario: "manual" },
			});
		}
	}

	/** Report the same error repeatedly to verify server grouping and bounded samples. */
	function reportRepeatedError() {
		setLastAction("Submitted 30 repeated errors");
		for (let index = 0; index < 30; index += 1) {
			window.NoumiBridge.diagnostics.reportError(
				new Error("Diagnostics test: repeated error 1001"),
				{
					component: "DiagnosticsTestPanel",
					operation: "diagnostics.repeat",
					tags: { fixture: true, scenario: "repeat" },
				},
			);
		}
	}

	/** Verify that URL queries and fake tokens in free text are minimized. */
	function reportSensitiveText() {
		setLastAction("Submitted an error containing a URL query/fake token");
		window.NoumiBridge.diagnostics.reportError(
			new Error(
				"Diagnostics test https://app.example/tasks?token=never-store-me#secret token=fake-token-123",
			),
			{
				component: "DiagnosticsTestPanel",
				operation: "diagnostics.redaction",
				tags: { fixture: true, scenario: "redaction" },
			},
		);
	}

	return (
		<Card className="space-y-4 p-5">
			<div className="flex items-start gap-3">
				<div className="rounded-lg bg-destructive/10 p-2 text-destructive">
					<Bug className="size-5" />
				</div>
				<div>
				<h2 className="font-semibold">Diagnostics Test</h2>
					<p className="mt-1 text-sm text-muted-foreground">
						This area is for starter/E2E fixtures only. Errors remain visible in iframe DevTools while the platform collects them on a best-effort basis.
					</p>
				</div>
			</div>

			<div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
				<Button onClick={throwRuntimeError} type="button" variant="secondary">
					<ShieldAlert className="size-4" />Throw synchronous error
				</Button>
				<Button onClick={rejectPromise} type="button" variant="secondary">
					<RadioTower className="size-4" />Unhandled rejection
				</Button>
				<Button
					onClick={() => {
						setLastAction("Requested a missing image");
						setMissingImageKey((value) => value + 1);
					}}
					type="button"
					variant="secondary"
				>
					<ImageOff className="size-4" />Load missing image
				</Button>
				<Button onClick={reportCaughtError} type="button" variant="secondary">
					<Bug className="size-4" />Call reportError
				</Button>
				<Button onClick={reportRepeatedError} type="button" variant="secondary">
					<Repeat2 className="size-4" />Repeated errors
				</Button>
				<Button onClick={reportSensitiveText} type="button" variant="secondary">
					<ShieldAlert className="size-4" />URL and fake token
				</Button>
				<Button
					className="sm:col-span-2 lg:col-span-3"
					onClick={() => setRenderCrash(true)}
					type="button"
					variant="destructive"
				>
					Trigger React Error Boundary (show fallback)
				</Button>
			</div>

			<p aria-live="polite" className="text-xs text-muted-foreground">
				{lastAction}
			</p>
			{missingImageKey > 0 && (
				<img
					alt=""
					className="hidden"
					key={missingImageKey}
					src={`/__noumi-diagnostics-missing-${missingImageKey}.png?token=never-store`}
				/>
			)}
		</Card>
	);
}
