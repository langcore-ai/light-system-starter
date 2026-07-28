import { useState } from "react";
import { Bug, ImageOff, RadioTower, Repeat2, ShieldAlert } from "lucide-react";
import { Button } from "./components/ui/button";
import { Card } from "./components/ui/card";

/** Error Boundary 人工验收专用崩溃子组件。 */
function DiagnosticsRenderCrash(): never {
	throw new Error("Diagnostics test: React Error Boundary");
}

/** starter fixture 的可见 diagnostics 人工验收区域。 */
export function DiagnosticsTestPanel() {
	const [missingImageKey, setMissingImageKey] = useState(0);
	const [renderCrash, setRenderCrash] = useState(false);
	const [lastAction, setLastAction] = useState("尚未触发测试错误");

	if (renderCrash) return <DiagnosticsRenderCrash />;

	/** 在当前事件循环之后抛错，避免 React click handler 代为处理。 */
	function throwRuntimeError() {
		setLastAction("已触发同步/回调异常");
		setTimeout(() => {
			throw new Error("Diagnostics test: runtime error");
		}, 0);
	}

	/** 产生浏览器可观察的未处理 rejection。 */
	function rejectPromise() {
		setLastAction("已触发未处理 Promise rejection");
		void Promise.reject(new Error("Diagnostics test: unhandled rejection"));
	}

	/** 主动报告一个已经被业务代码捕获的异常。 */
	function reportCaughtError() {
		setLastAction("已主动 reportError");
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

	/** 连续主动报告同一错误，用于人工确认服务端归组和有界样本。 */
	function reportRepeatedError() {
		setLastAction("已提交 30 次重复错误");
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

	/** 验证自由文本中的 URL query 和伪 token 会被最小化。 */
	function reportSensitiveText() {
		setLastAction("已提交含 URL query/伪 token 的错误");
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
					<h2 className="font-semibold">Diagnostics 测试</h2>
					<p className="mt-1 text-sm text-muted-foreground">
						该区域只用于 starter/E2E fixture。错误应继续显示在 iframe DevTools，同时由平台 best-effort 收集。
					</p>
				</div>
			</div>

			<div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
				<Button onClick={throwRuntimeError} type="button" variant="secondary">
					<ShieldAlert className="size-4" />抛出同步异常
				</Button>
				<Button onClick={rejectPromise} type="button" variant="secondary">
					<RadioTower className="size-4" />未处理 rejection
				</Button>
				<Button
					onClick={() => {
						setLastAction("已请求不存在的图片");
						setMissingImageKey((value) => value + 1);
					}}
					type="button"
					variant="secondary"
				>
					<ImageOff className="size-4" />加载不存在图片
				</Button>
				<Button onClick={reportCaughtError} type="button" variant="secondary">
					<Bug className="size-4" />主动 reportError
				</Button>
				<Button onClick={reportRepeatedError} type="button" variant="secondary">
					<Repeat2 className="size-4" />高频重复错误
				</Button>
				<Button onClick={reportSensitiveText} type="button" variant="secondary">
					<ShieldAlert className="size-4" />URL 与伪 token
				</Button>
				<Button
					className="sm:col-span-2 lg:col-span-3"
					onClick={() => setRenderCrash(true)}
					type="button"
					variant="destructive"
				>
					触发 React Error Boundary（页面进入 fallback）
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
