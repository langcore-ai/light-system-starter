import { RECORD_STATUSES, type RecordStatus } from "../../shared/records-contract";

/**
 * 标准化任务状态。
 * @param value 输入值
 * @returns 合法状态
 */
export function normalizeStatus(value: unknown): RecordStatus {
	return RECORD_STATUSES.includes(value as RecordStatus) ? (value as RecordStatus) : "todo";
}

/**
 * 标准化标题。
 * @param value 输入值
 * @returns 非空标题
 */
export function normalizeTitle(value: unknown): string {
	const title = typeof value === "string" ? value.trim() : "";
	if (!title || title.length > 120) {
		throw new Error("title is required and must be <= 120 chars");
	}
	return title;
}
