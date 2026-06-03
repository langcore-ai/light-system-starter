import type { Hono } from "hono";
import {
	createRecord,
	getStats,
	listRecords,
	updateRecordStatus,
} from "../db/records-repository";
import type { SqlStorage } from "../db/schema";
import { normalizeStatus, normalizeTitle } from "../lib/validation";

/**
 * 注册记录相关 API。
 * @param app Hono 应用
 * @param sql Durable Object SQLite 句柄
 */
export function registerRecordRoutes(app: Hono, sql: SqlStorage): void {
	app.get("/api/stats", (c) => c.json(getStats(sql)));

	app.get("/api/records", (c) => c.json({ records: listRecords(sql) }));

	app.post("/api/records", async (c) => {
		try {
			const body = await c.req.json().catch(() => ({}));
			const record = createRecord(sql, {
				title: normalizeTitle(body.title),
				status: normalizeStatus(body.status),
			});
			return c.json(record, 201);
		} catch (error) {
			return c.json({ error: error instanceof Error ? error.message : "invalid record" }, 400);
		}
	});

	app.patch("/api/records/:id", async (c) => {
		const body = await c.req.json().catch(() => ({}));
		const status = normalizeStatus(body.status);
		const updatedAt = updateRecordStatus(sql, c.req.param("id"), status);
		return c.json({ ok: true, status, updated_at: updatedAt });
	});
}
