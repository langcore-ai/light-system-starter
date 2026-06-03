/**
 * 生成当前挂载路径下的 API URL。
 * @param path API path
 * @returns 带轻系统 base path 的 URL
 */
function apiUrl(path: string): string {
	const basePath = window.location.pathname.replace(/\/$/, "");
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
