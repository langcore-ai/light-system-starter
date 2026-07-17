/**
 * 渲染浏览器端 React SPA shell。
 * @param assets 前端资产
 * @returns HTML 字符串
 */
export function renderHtmlShell(assets: { clientBundle: string; clientStyle: string }): string {
	// 浏览器端脚本必须和 HTML 自包含，避免 opaque origin 的模块子请求丢失平台 capability。
	const clientBundle = assets.clientBundle.replace(/<\/script/gi, "<\\/script");
	return `<!doctype html>
<html lang="zh-CN">
	<head>
		<meta charset="utf-8" />
		<meta name="viewport" content="width=device-width, initial-scale=1" />
		<title>Light System Starter</title>
		<style>${assets.clientStyle}</style>
	</head>
	<body>
		<div id="root" data-react-spa-root="true"></div>
		<script type="module">${clientBundle}</script>
	</body>
</html>`;
}
