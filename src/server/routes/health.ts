import type { Hono } from "hono";

/**
 * 注册健康检查路由。
 * @param app Hono 应用
 * @param version 当前版本
 */
export function registerHealthRoutes(app: Hono, version: string): void {
	app.get("/api/health", (c) => c.json({ ok: true, app: "light-system-starter", version }));
}
