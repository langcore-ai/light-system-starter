import type {
	CreateRecordInput,
	RecordItem,
	RecordsResponse,
	Stats,
	UpdateRecordInput,
} from "../../shared/records-contract";
import { requestJson } from "../lib/api-client";

/**
 * 读取记录列表。
 * @returns 记录列表响应
 */
export function listRecords(): Promise<RecordsResponse> {
	return requestJson<RecordsResponse>("/api/records");
}

/**
 * 读取记录统计。
 * @returns 统计结果
 */
export function getStats(): Promise<Stats> {
	return requestJson<Stats>("/api/stats");
}

/**
 * 创建一条记录。
 * @param input 创建参数
 * @returns 新记录
 */
export function createRecord(input: CreateRecordInput): Promise<RecordItem> {
	return requestJson<RecordItem>("/api/records", {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify(input),
	});
}

/**
 * 更新记录状态。
 * @param id 记录 id
 * @param input 更新参数
 * @returns 更新结果
 */
export function updateRecord(id: string, input: UpdateRecordInput): Promise<{ ok: true; status: string; updated_at: number }> {
	return requestJson(`/api/records/${id}`, {
		method: "PATCH",
		headers: { "content-type": "application/json" },
		body: JSON.stringify(input),
	});
}
