import { BarChart3, CheckCircle2, Database } from "lucide-react";
import type { Stats } from "../../../shared/records-contract";
import { Card } from "../ui/card";

/**
 * 记录统计卡片组。
 * @param props 组件属性
 * @returns React 节点
 */
export function StatsCards({ stats }: { stats: Stats }) {
	const completionRate = stats.total === 0 ? 0 : Math.round((stats.done / stats.total) * 100);

	return (
		<section className="grid gap-4 md:grid-cols-3">
			<Card className="p-5">
				<div className="mb-3 flex items-center gap-2 text-slate-500">
					<Database className="size-4" />
					<span className="text-sm font-semibold">总记录</span>
				</div>
				<strong className="text-3xl">{stats.total}</strong>
			</Card>
			<Card className="p-5">
				<div className="mb-3 flex items-center gap-2 text-slate-500">
					<CheckCircle2 className="size-4" />
					<span className="text-sm font-semibold">已完成</span>
				</div>
				<strong className="text-3xl">{stats.done}</strong>
			</Card>
			<Card className="p-5">
				<div className="mb-3 flex items-center gap-2 text-slate-500">
					<BarChart3 className="size-4" />
					<span className="text-sm font-semibold">完成率</span>
				</div>
				<strong className="text-3xl">{completionRate}%</strong>
			</Card>
		</section>
	);
}
