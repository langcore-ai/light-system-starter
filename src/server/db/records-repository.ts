import type { RecordItem, RecordStatus, Stats } from "../../shared/records-contract";
import { normalizeStatus } from "../lib/validation";
import type { SqlStorage } from "./schema";

/** SQLite 返回的记录行。 */
type RecordRow = {
	/** 记录 id。 */
	id: unknown;
	/** 标题。 */
	title: unknown;
	/** 状态。 */
	status: unknown;
	/** 创建时间。 */
	created_at: unknown;
	/** 更新时间。 */
	updated_at: unknown;
};

/**
 * 转换 SQLite 行为记录对象。
 * @param row SQLite 行
 * @returns 任务记录
 */
function toRecordItem(row: RecordRow): RecordItem {
	return {
		id: String(row.id),
		title: String(row.title),
		status: normalizeStatus(row.status),
		created_at: Number(row.created_at),
		updated_at: Number(row.updated_at),
	};
}

/**
 * 读取记录列表。
 * @param sql Durable Object SQLite 句柄
 * @returns 记录列表
 */
export function listRecords(sql: SqlStorage): RecordItem[] {
	return sql
		.exec("SELECT id, title, status, created_at, updated_at FROM records ORDER BY updated_at DESC")
		.toArray()
		.map((row) => toRecordItem(row as RecordRow));
}

/**
 * 读取记录统计。
 * @param sql Durable Object SQLite 句柄
 * @returns 统计结果
 */
export function getStats(sql: SqlStorage): Stats {
	const rows = sql.exec("SELECT status, COUNT(*) AS count FROM records GROUP BY status").toArray();
	let total = 0;
	let done = 0;
	for (const row of rows) {
		const count = Number(row.count);
		total += count;
		if (row.status === "done") {
			done = count;
		}
	}
	return { total, done };
}

/**
 * 创建记录。
 * @param sql Durable Object SQLite 句柄
 * @param input 创建参数
 * @returns 新记录
 */
export function createRecord(
	sql: SqlStorage,
	input: {
		/** 记录标题。 */
		title: string;
		/** 记录状态。 */
		status: RecordStatus;
	},
): RecordItem {
	const now = Date.now();
	const record: RecordItem = {
		id: crypto.randomUUID(),
		title: input.title,
		status: input.status,
		created_at: now,
		updated_at: now,
	};
	sql.exec(
		"INSERT INTO records (id, title, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
		record.id,
		record.title,
		record.status,
		record.created_at,
		record.updated_at,
	);
	return record;
}

/**
 * 更新记录状态。
 * @param sql Durable Object SQLite 句柄
 * @param id 记录 id
 * @param status 新状态
 * @returns 更新时间戳
 */
export function updateRecordStatus(sql: SqlStorage, id: string, status: RecordStatus): number {
	const now = Date.now();
	sql.exec("UPDATE records SET status = ?, updated_at = ? WHERE id = ?", status, now, id);
	return now;
}
