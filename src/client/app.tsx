import { useCallback, useEffect, useMemo, useState } from "react";
import {
	CheckCircle2,
	Circle,
	Cloud,
	Database,
	Plus,
	RefreshCw,
	Trash2,
} from "lucide-react";
import { Button } from "./components/ui/button";
import { Card } from "./components/ui/card";
import { AppStorageTestPanel } from "./app-storage-test-panel";
import { DiagnosticsTestPanel } from "./diagnostics-test-panel";
import { WorkspaceFilesTestPanel } from "./workspace-files-test-panel";

/** Starter migration 创建的共享任务行。 */
type Task = {
	id: string;
	title: string;
	completed: boolean;
	position: number;
	created_at: string;
};

/** 把 SDK failure envelope 转成适合人工验收的短消息。 */
function resultError(result: NoumiDbFailure): string {
	return `${result.error.code}: ${result.error.message}`;
}

/** 可人工验证 NoumiBridge 数据库与隔离 localStorage 的 starter 首页。 */
export function App() {
	const [tasks, setTasks] = useState<Task[]>([]);
	const [title, setTitle] = useState("");
	const [loading, setLoading] = useState(true);
	const [busy, setBusy] = useState(false);
	const [message, setMessage] = useState("正在读取共享 SQLite…");
	const [localCount, setLocalCount] = useState(0);
	const [sqlSummary, setSqlSummary] = useState<string>("SQL capability 未启用");
	const capabilities = window.NoumiBridge.db.capabilities;
	const completed = useMemo(
		() => tasks.filter((task) => task.completed).length,
		[tasks],
	);

	/** 从专属 DO SQLite 重新读取任务，并可选运行一条 aggregate SQL。 */
	const loadTasks = useCallback(async () => {
		setLoading(true);
		try {
			const result = await window.NoumiBridge.db
				.from<Task>("tasks")
				.select("id,title,completed,position,created_at")
				.order("position");
			if (!result.ok) {
				setMessage(resultError(result));
				return;
			}
			setTasks(result.data);
			setMessage(`已从共享 SQLite 读取 ${result.data.length} 条任务`);
			if (capabilities.sqlQuery) {
				const summary = await window.NoumiBridge.db.sql.query<{
					total: number;
					completed: number;
				}>(
					"SELECT COUNT(*) AS total, SUM(completed) AS completed FROM tasks",
				);
				setSqlSummary(
					summary.ok
						? `SQL aggregate: ${summary.data[0]?.completed ?? 0}/${summary.data[0]?.total ?? 0}`
						: resultError(summary),
				);
			}
		} catch (error) {
			setMessage(error instanceof Error ? error.message : "数据库 transport 失败");
		} finally {
			setLoading(false);
		}
	}, [capabilities.sqlQuery]);

	useEffect(() => {
		void loadTasks();
		void window.NoumiBridge.localStorage.getItem("starter-local-count")
			.then((value) => setLocalCount(value ? Number(value) || 0 : 0))
			.catch(() => setMessage("隔离 localStorage 读取失败"));
	}, [loadTasks]);

	/** 串行执行一次 mutation，并在成功后刷新可见数据。 */
	async function mutate(operation: () => Promise<NoumiDbResult<unknown>>) {
		setBusy(true);
		try {
			const result = await operation();
			if (!result.ok) {
				setMessage(resultError(result));
				return;
			}
			await loadTasks();
		} catch (error) {
			setMessage(error instanceof Error ? error.message : "数据库 mutation transport 失败");
		} finally {
			setBusy(false);
		}
	}

	function addTask() {
		const normalized = title.trim();
		if (!normalized) return;
		const nextPosition = tasks.reduce(
			(maximum, task) => Math.max(maximum, task.position),
			-1,
		) + 1;
		void mutate(async () => {
			const result = await window.NoumiBridge.db.from<Task>("tasks").insert({
				id: crypto.randomUUID(),
				title: normalized,
				completed: false,
				position: nextPosition,
				created_at: new Date().toISOString(),
			}).select("*").single();
			if (result.ok) setTitle("");
			return result;
		});
	}

	async function incrementLocalCount() {
		const next = localCount + 1;
		await window.NoumiBridge.localStorage.setItem(
			"starter-local-count",
			String(next),
		);
		setLocalCount(next);
	}

	return (
		<main className="min-h-screen bg-background px-4 py-8 text-foreground sm:px-6">
			<div className="mx-auto flex w-full max-w-4xl flex-col gap-5">
				<header className="flex flex-col gap-4 rounded-2xl border bg-card p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
					<div className="space-y-2">
						<div className="flex items-center gap-2 text-sm font-semibold text-primary">
							<Database className="size-4" />
							NoumiBridge database E2E
						</div>
						<h1 className="text-3xl font-bold tracking-tight">共享任务面板</h1>
						<p className="max-w-2xl text-sm leading-6 text-muted-foreground">
							任务写入当前轻系统独享的 Durable Object SQLite；右侧计数只写入与主前端隔离的异步 localStorage。
						</p>
					</div>
					<div className="shrink-0 rounded-xl bg-muted px-4 py-3 text-center">
						<p className="text-2xl font-bold">{completed}/{tasks.length}</p>
						<p className="text-xs text-muted-foreground">SQLite 已完成</p>
					</div>
				</header>

				<section className="grid gap-3 sm:grid-cols-3" aria-label="Bridge 状态">
					<Card className="p-4">
						<p className="text-xs text-muted-foreground">当前成员</p>
						<p className="mt-1 truncate text-sm font-medium">
							{window.NoumiBridge.currentMember?.displayName ??
								window.NoumiBridge.currentMember?.email ??
								"未登录"}
						</p>
					</Card>
					<Card className="p-4">
						<p className="text-xs text-muted-foreground">数据库能力</p>
						<p className="mt-1 text-sm font-medium">
							CRUD {capabilities.structuredCrud ? "ON" : "OFF"} · SQL{" "}
							{capabilities.sqlQuery ? "ON" : "OFF"}
						</p>
					</Card>
					<Card className="p-4">
						<p className="text-xs text-muted-foreground">隔离本地计数</p>
						<button
							className="mt-1 text-left text-sm font-medium text-primary"
							onClick={() => void incrementLocalCount()}
							type="button"
						>
							{localCount}（点击 +1）
						</button>
					</Card>
				</section>

				<Card className="p-5">
					<form
						className="flex gap-2"
						onSubmit={(event) => {
							event.preventDefault();
							addTask();
						}}
					>
						<input
							aria-label="新任务"
							className="min-w-0 flex-1 rounded-md border bg-background px-3 py-2 text-sm outline-none ring-ring focus:ring-2"
							disabled={busy || !capabilities.structuredCrud}
							onChange={(event) => setTitle(event.target.value)}
							placeholder="添加一条共享任务"
							value={title}
						/>
						<Button disabled={busy || !capabilities.structuredCrud} type="submit">
							<Plus className="size-4" />添加
						</Button>
						<Button
							aria-label="刷新数据库"
							disabled={loading}
							onClick={() => void loadTasks()}
							size="icon"
							type="button"
							variant="secondary"
						>
							<RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
						</Button>
					</form>
				</Card>

				<section className="grid gap-3" aria-label="共享任务列表">
					{tasks.map((task) => (
						<Card className="flex items-center gap-3 p-4" key={task.id}>
							<button
								aria-label={task.completed ? "标记为未完成" : "标记为完成"}
								className="shrink-0 text-primary"
								disabled={busy}
								onClick={() => void mutate(async () =>
									await window.NoumiBridge.db.from<Task>("tasks")
										.update({ completed: !task.completed })
										.eq("id", task.id)
										.select("*")
										.single())}
								type="button"
							>
								{task.completed
									? <CheckCircle2 className="size-5" />
									: <Circle className="size-5" />}
							</button>
							<div className="min-w-0 flex-1">
								<p className={`truncate text-sm ${task.completed ? "text-muted-foreground line-through" : ""}`}>
									{task.title}
								</p>
								<p className="text-xs text-muted-foreground">{task.created_at}</p>
							</div>
							<Button
								aria-label="删除任务"
								disabled={busy}
								onClick={() => void mutate(async () =>
									await window.NoumiBridge.db.from<Task>("tasks")
										.delete()
										.eq("id", task.id)
										.execute())}
								size="icon"
								type="button"
								variant="ghost"
							>
								<Trash2 className="size-4" />
							</Button>
						</Card>
					))}
					{!loading && tasks.length === 0 && (
						<Card className="p-8 text-center text-sm text-muted-foreground">
							数据库为空。添加一条任务后刷新页面，确认数据仍然存在。
						</Card>
					)}
				</section>

				<Card className="flex flex-col gap-2 p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
					<div className="flex min-w-0 items-center gap-2">
						<Cloud className="size-4 shrink-0 text-primary" />
						<span className="truncate">{message}</span>
					</div>
					<code className="text-xs text-muted-foreground">{sqlSummary}</code>
				</Card>

				<AppStorageTestPanel />
				<WorkspaceFilesTestPanel />
				<DiagnosticsTestPanel />
			</div>
		</main>
	);
}
