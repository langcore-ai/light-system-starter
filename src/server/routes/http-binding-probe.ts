import type { Hono } from "hono";

/** 轻系统可见的受控 HTTP binding。 */
type HttpBinding = {
	/**
	 * 通过主 Worker 代理发起公网 fetch。
	 * @param input 请求或 URL
	 * @param init fetch 参数
	 * @returns 上游响应
	 */
	fetch(input: Request | string, init?: RequestInit): Promise<Response>;
};

/** 公网 binding 探测目标。 */
const PROBE_TARGETS = ["https://www.cloudflare.com/cdn-cgi/trace"] as const;

/**
 * 通过 HTTP binding 探测一个公网 URL。
 * @param http HTTP binding
 * @param url 目标 URL
 * @returns 探测结果
 */
async function probeViaBinding(http: HttpBinding, url: string) {
	try {
		const response = await http.fetch(url);
		const bodyPreview = (await response.text()).slice(0, 180);
		return {
			url,
			ok: response.ok,
			status: response.status,
			contentType: response.headers.get("content-type"),
			bodyPreview,
		};
	} catch (error) {
		return {
			url,
			ok: false,
			error: error instanceof Error ? error.message : String(error),
		};
	}
}

/**
 * 注册自定义 HTTP binding 探测路由。
 * @param app Hono 应用
 * @param http HTTP binding
 */
export function registerHttpBindingProbeRoutes(app: Hono, http?: HttpBinding): void {
	app.get("/api/http-binding-probe", async (c) => {
		if (!http) {
			return c.json({ ok: false, error: "HTTP binding is not configured" }, 501);
		}

		const results = await Promise.all(PROBE_TARGETS.map((url) => probeViaBinding(http, url)));
		return c.json({
			ok: results.every((result) => result.ok),
			results,
		});
	});
}
