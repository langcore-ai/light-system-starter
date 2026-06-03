import type { RecordItem } from "../../../shared/records-contract";
import { Button } from "../ui/button";
import { Card } from "../ui/card";

/**
 * 记录列表。
 * @param props 组件属性
 * @returns React 节点
 */
export function RecordList({
	records,
	onToggle,
}: {
	/** 当前记录列表。 */
	records: RecordItem[];
	/** 切换完成状态。 */
	onToggle: (record: RecordItem) => Promise<void>;
}) {
	return (
		<section className="grid gap-3">
			{records.map((record) => (
				<Card className="flex items-center justify-between gap-3 p-4" key={record.id}>
					<div>
						<strong className="block">{record.title}</strong>
						<span className="text-sm text-slate-500">
							{record.status} · {new Date(record.created_at).toLocaleString()}
						</span>
					</div>
					<Button onClick={() => onToggle(record)} type="button" variant="ghost">
						{record.status === "done" ? "重开" : "完成"}
					</Button>
				</Card>
			))}
			{records.length === 0 ? (
				<Card className="p-8 text-center text-slate-500">暂无记录，先新增一条。</Card>
			) : null}
		</section>
	);
}
