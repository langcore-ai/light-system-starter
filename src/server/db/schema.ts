/** Durable Object SQLite 句柄。 */
export type SqlStorage = DurableObjectState["storage"]["sql"];

/**
 * 初始化记录表结构。
 * @param sql Durable Object SQLite 句柄
 */
export function initializeSchema(sql: SqlStorage): void {
	sql.exec(`
		CREATE TABLE IF NOT EXISTS records (
			id TEXT PRIMARY KEY,
			title TEXT NOT NULL,
			status TEXT NOT NULL DEFAULT 'todo',
			created_at INTEGER NOT NULL,
			updated_at INTEGER NOT NULL
		)
	`);
	// 更新时间是列表排序主维度，保留索引避免记录量上来后全表排序。
	sql.exec("CREATE INDEX IF NOT EXISTS idx_records_updated ON records(updated_at)");
}
