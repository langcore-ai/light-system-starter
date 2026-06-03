import { DurableObject } from "cloudflare:workers";
import { createServerApp } from "./app";
import { initializeSchema } from "./db/schema";

/** 当前轻系统版本，构建脚本会从 package/version 或环境覆盖。 */
const APP_VERSION = "__LIGHT_SYSTEM_VERSION__";
/** 浏览器端 React bundle，占位符由构建脚本替换。 */
const CLIENT_BUNDLE = "__LIGHT_SYSTEM_CLIENT_BUNDLE__";
/** 浏览器端 Tailwind CSS，占位符由构建脚本替换。 */
const CLIENT_STYLE = "__LIGHT_SYSTEM_CLIENT_STYLE__";

/** Dynamic Worker 环境绑定；starter 默认不需要额外 binding。 */
interface Env {
	/** 主 Worker 注入的受控公网 fetch binding。 */
	HTTP?: {
		/** 通过主 Worker 代理发起公网 fetch。 */
		fetch(input: Request | string, init?: RequestInit): Promise<Response>;
	};
}

export class App extends DurableObject<Env> {
	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env);

		ctx.blockConcurrencyWhile(async () => {
			// schema 初始化必须保持轻量、幂等，避免阻塞 Durable Object 首次请求。
			initializeSchema(this.ctx.storage.sql);
		});
	}

	fetch(request: Request): Response | Promise<Response> {
		const app = createServerApp({
			version: APP_VERSION,
			clientBundle: CLIENT_BUNDLE,
			clientStyle: CLIENT_STYLE,
			sql: this.ctx.storage.sql,
			http: this.env.HTTP,
		});
		return app.fetch(request);
	}
}
