import * as React from "react";
import { RefreshCw } from "lucide-react";
import { createRecord, getStats, listRecords, updateRecord } from "./api/records";
import { RecordForm } from "./components/records/record-form";
import { RecordList } from "./components/records/record-list";
import { StatsCards } from "./components/records/stats-cards";
import { Button } from "./components/ui/button";
import type { RecordItem, Stats } from "../shared/records-contract";

/**
 * 轻系统 starter React 应用。
 * @returns React 节点
 */
export function App() {
	const [records, setRecords] = React.useState<RecordItem[]>([]);
	const [stats, setStats] = React.useState<Stats>({ total: 0, done: 0 });
	const [error, setError] = React.useState("");

	/**
	 * 刷新列表和统计。
	 */
	async function refresh() {
		const [recordsResult, statsResult] = await Promise.all([listRecords(), getStats()]);
		setRecords(recordsResult.records);
		setStats(statsResult);
		setError("");
	}

	React.useEffect(() => {
		refresh().catch((nextError: Error) => setError(nextError.message));
	}, []);

	/**
	 * 创建任务。
	 * @param title 任务标题
	 */
	async function handleCreate(title: string) {
		await createRecord({ title });
		await refresh();
	}

	/**
	 * 切换任务完成状态。
	 * @param record 任务记录
	 */
	async function handleToggle(record: RecordItem) {
		await updateRecord(record.id, { status: record.status === "done" ? "todo" : "done" });
		await refresh();
	}

	return (
		<main className="mx-auto grid min-h-screen max-w-6xl gap-6 px-5 py-8">
			<section className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
				<div>
					<p className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
						Dynamic Workers Light System
					</p>
					<h1 className="text-3xl font-bold tracking-normal text-slate-950">轻系统脚手架</h1>
				</div>
				<Button className="w-fit" onClick={() => refresh()} type="button" variant="secondary">
					<RefreshCw className="size-4" />
					刷新
				</Button>
			</section>

			<StatsCards stats={stats} />
			<RecordForm error={error} onCreate={handleCreate} />
			<RecordList onToggle={handleToggle} records={records} />
		</main>
	);
}
