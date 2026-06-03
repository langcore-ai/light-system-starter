/** 允许写入和展示的任务状态。 */
export const RECORD_STATUSES = ["todo", "doing", "done"] as const;

/** 任务状态。 */
export type RecordStatus = (typeof RECORD_STATUSES)[number];

/** 任务记录。 */
export type RecordItem = {
	/** 记录唯一标识。 */
	id: string;
	/** 记录标题。 */
	title: string;
	/** 当前任务状态。 */
	status: RecordStatus;
	/** 创建时间戳，单位毫秒。 */
	created_at: number;
	/** 更新时间戳，单位毫秒。 */
	updated_at: number;
};

/** 统计结果。 */
export type Stats = {
	/** 总记录数。 */
	total: number;
	/** 已完成记录数。 */
	done: number;
};

/** 创建记录请求。 */
export type CreateRecordInput = {
	/** 记录标题。 */
	title: string;
	/** 可选状态；缺省时后端使用 todo。 */
	status?: RecordStatus;
};

/** 更新记录状态请求。 */
export type UpdateRecordInput = {
	/** 新状态。 */
	status: RecordStatus;
};

/** 记录列表响应。 */
export type RecordsResponse = {
	/** 按更新时间倒序返回的记录。 */
	records: RecordItem[];
};
