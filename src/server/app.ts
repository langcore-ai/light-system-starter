import { Hono } from "hono";
import type { SqlStorage } from "./db/schema";
import { registerAssetRoutes } from "./routes/assets";
import { registerHealthRoutes } from "./routes/health";
import { registerHttpBindingProbeRoutes } from "./routes/http-binding-probe";
import { registerRecordRoutes } from "./routes/records";

/** 轻系统可见的受控 HTTP binding。 */
type HttpBinding = {
	/** 通过主 Worker 代理发起公网 fetch。 */
	fetch(input: Request | string, init?: RequestInit): Promise<Response>;
};

/** 创建 Hono 应用所需参数。 */
type ServerAppOptions = {
	/** 当前轻系统版本。 */
	version: string;
	/** 浏览器端 React bundle。 */
	clientBundle: string;
	/** 浏览器端 Tailwind CSS。 */
	clientStyle: string;
	/** Durable Object SQLite 句柄。 */
	sql: SqlStorage;
	/** 主 Worker 注入的受控公网 fetch binding。 */
	http?: HttpBinding;
};

/**
 * 创建轻系统 Hono 后端应用。
 * @param options 创建参数
 * @returns Hono 应用
 */
export function createServerApp(options: ServerAppOptions): Hono {
	const app = new Hono();
	registerHealthRoutes(app, options.version);
	registerHttpBindingProbeRoutes(app, options.http);
	registerRecordRoutes(app, options.sql);
	registerAssetRoutes(app, {
		clientBundle: options.clientBundle,
		clientStyle: options.clientStyle,
	});
	return app;
}
