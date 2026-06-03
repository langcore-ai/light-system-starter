/**
 * 返回 JavaScript 资产。
 * @param source JavaScript 源码
 * @returns Response
 */
export function javascriptResponse(source: string): Response {
	return new Response(source, {
		headers: {
			"cache-control": "no-store",
			"content-type": "text/javascript; charset=utf-8",
		},
	});
}

/**
 * 返回 HTML 文档。
 * @param html HTML 字符串
 * @returns Response
 */
export function htmlResponse(html: string): Response {
	return new Response(html, {
		headers: {
			"content-type": "text/html; charset=utf-8",
			"x-content-type-options": "nosniff",
		},
	});
}
