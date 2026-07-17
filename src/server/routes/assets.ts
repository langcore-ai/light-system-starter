import type { Hono } from "hono";
import { htmlResponse } from "../lib/http";
import { renderHtmlShell } from "../lib/html-shell";

/**
 * 注册前端资产和页面路由。
 * @param app Hono 应用
 * @param assets 前端资产
 */
export function registerAssetRoutes(app: Hono, assets: { clientBundle: string; clientStyle: string }): void {
	app.get("*", (c) => {
		return htmlResponse(renderHtmlShell(assets));
	});
}
