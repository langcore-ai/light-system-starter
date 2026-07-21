/**
 * 请求 JSON API。
 * @param path 当前轻系统虚拟根下的 API path
 * @param init fetch 参数
 * @returns JSON 响应
 */
export async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
	// 平台 fetch 会把字符串形式的相对路径映射到当前 `/light-systems/:slug` 挂载点。
	const response = await fetch(path, init);
	const body = await response.json().catch(() => ({}));
	if (!response.ok) {
		const errorBody = body as { error?: string };
		throw new Error(errorBody.error ?? "request failed");
	}
	return body as T;
}
