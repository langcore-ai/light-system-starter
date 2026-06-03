import * as React from "react";
import { Plus } from "lucide-react";
import { Button } from "../ui/button";
import { Card } from "../ui/card";

/**
 * 新增记录表单。
 * @param props 组件属性
 * @returns React 节点
 */
export function RecordForm({
	error,
	onCreate,
}: {
	/** 最近一次请求错误。 */
	error: string;
	/** 创建记录回调。 */
	onCreate: (title: string) => Promise<void>;
}) {
	const [title, setTitle] = React.useState("");

	/**
	 * 提交新记录。
	 * @param event 表单提交事件
	 */
	async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const trimmed = title.trim();
		if (!trimmed) {
			return;
		}
		await onCreate(trimmed);
		setTitle("");
	}

	return (
		<Card className="p-5">
			<form className="grid gap-3 md:grid-cols-[1fr_auto]" onSubmit={handleSubmit}>
				<input
					className="h-10 rounded-md border border-slate-200 px-3 outline-none focus:ring-2 focus:ring-slate-950"
					maxLength={120}
					onChange={(event) => setTitle(event.target.value)}
					placeholder="新增一条结构化记录"
					value={title}
				/>
				<Button type="submit">
					<Plus className="size-4" />
					新增
				</Button>
			</form>
			{error ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}
		</Card>
	);
}
