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
