import { useMemo, useState } from "react";
import { CheckCircle2, Circle, Plus, Trash2, Zap } from "lucide-react";
import { Button } from "./components/ui/button";
import { Card } from "./components/ui/card";

/** 纯前端示例任务；刷新页面后会恢复 starter 默认值。 */
type Task = {
	id: string;
	title: string;
	completed: boolean;
};

const INITIAL_TASKS: Task[] = [
	{ id: "discover", title: "确认轻系统目标", completed: true },
	{ id: "build", title: "完成纯前端交互", completed: false },
	{ id: "publish", title: "构建并发布静态生成物", completed: false },
];

/**
 * starter 首页只演示浏览器内状态和外部 API 能力。
 * 本阶段不提供数据库或同源后端，业务代码不应调用 `/api/*`。
 */
export function App() {
	const [tasks, setTasks] = useState(INITIAL_TASKS);
	const [title, setTitle] = useState("");
	const completed = useMemo(() => tasks.filter((task) => task.completed).length, [tasks]);

	function addTask() {
		const normalized = title.trim();
		if (!normalized) return;
		setTasks((current) => [
			...current,
			{ id: crypto.randomUUID(), title: normalized, completed: false },
		]);
		setTitle("");
	}

	return (
		<main className="min-h-screen bg-background px-4 py-10 text-foreground sm:px-6">
			<div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
				<header className="flex flex-col gap-4 rounded-2xl border bg-card p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
					<div className="space-y-2">
						<div className="flex items-center gap-2 text-sm font-semibold text-primary">
							<Zap className="size-4" />
							Pure frontend Light System
						</div>
						<h1 className="text-3xl font-bold tracking-tight">轻量任务面板</h1>
						<p className="max-w-xl text-sm leading-6 text-muted-foreground">
							这是纯前端 starter。代码会编译成自包含 HTML，发布到对象存储，并在 opaque-origin iframe 中运行。
						</p>
					</div>
					<div className="shrink-0 rounded-xl bg-muted px-4 py-3 text-center">
						<p className="text-2xl font-bold">{completed}/{tasks.length}</p>
						<p className="text-xs text-muted-foreground">已完成</p>
					</div>
				</header>

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
							onChange={(event) => setTitle(event.target.value)}
							placeholder="添加一个浏览器内任务"
							value={title}
						/>
						<Button type="submit"><Plus className="size-4" />添加</Button>
					</form>
				</Card>

				<section className="grid gap-3" aria-label="任务列表">
					{tasks.map((task) => (
						<Card className="flex items-center gap-3 p-4" key={task.id}>
							<button
								aria-label={task.completed ? "标记为未完成" : "标记为完成"}
								className="shrink-0 text-primary"
								onClick={() => setTasks((current) => current.map((item) =>
									item.id === task.id ? { ...item, completed: !item.completed } : item))}
								type="button"
							>
								{task.completed ? <CheckCircle2 className="size-5" /> : <Circle className="size-5" />}
							</button>
							<span className={`min-w-0 flex-1 text-sm ${task.completed ? "text-muted-foreground line-through" : ""}`}>
								{task.title}
							</span>
							<Button
								aria-label="删除任务"
								onClick={() => setTasks((current) => current.filter((item) => item.id !== task.id))}
								size="icon"
								type="button"
								variant="ghost"
							>
								<Trash2 className="size-4" />
							</Button>
						</Card>
					))}
				</section>

				<p className="text-center text-xs text-muted-foreground">
					当前阶段没有持久化能力；刷新会恢复默认数据。需要外部数据时，可直接请求允许 CORS 的外部 API。
				</p>
			</div>
		</main>
	);
}
