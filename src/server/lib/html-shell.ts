/**
 * 渲染浏览器端 React SPA shell。
 * @param assets 前端资产
 * @returns HTML 字符串
 */
export function renderHtmlShell(assets: { clientStyle: string }): string {
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
		<script type="module" src="?asset=client"></script>
	</body>
</html>`;
}
