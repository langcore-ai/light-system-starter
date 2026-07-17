/**
 * 生成当前挂载路径下的 API URL。
 * @param path API path
 * @returns 带轻系统 base path 的 URL
 */
function apiUrl(path: string): string {
	const matched = window.location.pathname.match(/^\/light-systems\/[^/]+/);
	if (!matched) {
		throw new Error("Light System mount path is missing");
	}
	// 深层 SPA 路由仍必须请求 slug 根目录下的 API，不能把当前页面路径误当成 base path。
	const basePath = matched[0];
	return `${basePath}${path}`;
}

/**
 * 请求 JSON API。
 * @param path API path
 * @param init fetch 参数
 * @returns JSON 响应
 */
export async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
	const response = await fetch(apiUrl(path), init);
	const body = await response.json().catch(() => ({}));
	if (!response.ok) {
		const errorBody = body as { error?: string };
		throw new Error(errorBody.error ?? "request failed");
	}
	return body as T;
}
