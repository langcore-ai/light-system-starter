import { mkdir, rm, writeFile } from "node:fs/promises";
import { isAbsolute, join, relative } from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { build as buildVite } from "vite";
import { createNoumiBrowserRuntimeBuild } from "./noumi-browser-runtime";

/** starter 根目录。 */
const ROOT_DIR = new URL("..", import.meta.url).pathname;

/** 浏览器入口。 */
const CLIENT_ENTRY_PATH = join(ROOT_DIR, "src/client/main.tsx");

/** 平台隔离构建器读取的标准 Vite 输出目录。 */
const OUTPUT_DIR = join(ROOT_DIR, "dist");

/** 轻系统固定 HTML 入口。 */
const OUTPUT_PATH = join(OUTPUT_DIR, "index.html");

/** 平台 Builder 会从该保留目录提取私有诊断产物，并禁止进入公开 manifest。 */
const PRIVATE_DIAGNOSTICS_DIR = join(OUTPUT_DIR, ".noumi-private");

/** 最终内联 HTML 对应的私有 indexed sourcemap。 */
const PRIVATE_SOURCE_MAP_PATH = join(
	PRIVATE_DIAGNOSTICS_DIR,
	"index.html.map",
);

/** Vite 输出资产的最小结构。 */
type OutputAsset = {
	fileName: string;
	source?: string | Uint8Array;
	code?: string;
	map?: {
		toString(): string;
	} | null;
};

/** 避免内联源码提前结束 HTML 标签。 */
function escapeInlineSource(source: string, tagName: "script" | "style"): string {
	return source.replace(new RegExp(`</${tagName}`, "gi"), `<\\/${tagName}`);
}

/** 删除内联后不再成立的公开 sourceMappingURL 注释。 */
function stripSourceMappingUrl(code: string): string {
	return code.replace(/\n?\/\/# sourceMappingURL=.*$/gm, "");
}

/** 把 Vite/Rollup map 转成普通 JSON object。 */
function parseSourceMap(
	output: OutputAsset,
	label: string,
): Record<string, unknown> {
	if (!output.map) throw new Error(`${label} did not emit a source map`);
	const parsed = JSON.parse(output.map.toString()) as unknown;
	if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
		throw new Error(`${label} emitted an invalid source map`);
	}
	return parsed as Record<string, unknown>;
}

/** 统计字符串中的换行数量，用作 sourcemap 0-based line offset。 */
function countNewlines(value: string): number {
	return [...value.matchAll(/\n/g)].length;
}

/** 把绝对构建路径收敛为轻系统仓库相对路径，避免泄漏 Builder host 路径。 */
function normalizeSourceName(value: unknown): string {
	if (typeof value !== "string") return "unknown-source";
	const withoutScheme = value.replace(/^file:\/\//, "");
	if (isAbsolute(withoutScheme)) {
		const relativePath = relative(ROOT_DIR, withoutScheme).replaceAll("\\", "/");
		return relativePath.startsWith("../")
			? `external/${relativePath.replace(/^(\.\.\/)+/, "")}`
			: relativePath;
	}
	return withoutScheme
		.replace(/^(\.\.\/)+/, "")
		.replaceAll("\\", "/");
}

/** 递归规范化 leaf map 的 source path，并去除 node_modules 的 sourcesContent。 */
function normalizeLeafSourceMap(
	sourceMap: Record<string, unknown>,
): Record<string, unknown> {
	const sources = Array.isArray(sourceMap.sources)
		? sourceMap.sources.map(normalizeSourceName)
		: [];
	const sourcesContent = Array.isArray(sourceMap.sourcesContent)
		? sourceMap.sourcesContent.map((content, index) =>
			sources[index]?.startsWith("node_modules/")
				? null
				: typeof content === "string"
					? content
					: null)
		: undefined;
	return {
		...sourceMap,
		file: "index.html",
		sources,
		...(sourcesContent ? { sourcesContent } : {}),
	};
}

/** 构建纯浏览器应用并输出自包含 HTML。 */
async function main() {
	const result = await buildVite({
		configFile: false,
		logLevel: "silent",
		plugins: [react(), tailwindcss()],
		resolve: { alias: { "@": join(ROOT_DIR, "src/client") } },
		build: {
			assetsInlineLimit: Number.MAX_SAFE_INTEGER,
			cssCodeSplit: false,
			emptyOutDir: false,
			minify: true,
			sourcemap: true,
			rollupOptions: {
				input: CLIENT_ENTRY_PATH,
				output: { format: "es", inlineDynamicImports: true },
			},
			write: false,
		},
	});
	const outputs = (Array.isArray(result) ? result[0].output : result.output) as OutputAsset[];
	const javascriptOutput = outputs.find((output) =>
		output.fileName.endsWith(".js")
	);
	const javascript = javascriptOutput?.code
		? stripSourceMappingUrl(javascriptOutput.code)
		: undefined;
	const cssAsset = outputs.find((output) => output.fileName.endsWith(".css"));
	const css = typeof cssAsset?.source === "string"
		? cssAsset.source
		: cssAsset?.source
			? new TextDecoder().decode(cssAsset.source)
			: "";
	if (!javascript) throw new Error("client build did not emit a JavaScript chunk");
	const unsupported = outputs.filter((output) =>
		!output.fileName.endsWith(".js") &&
		!output.fileName.endsWith(".css") &&
		!output.fileName.endsWith(".map"));
	if (unsupported.length > 0) {
		throw new Error(`static build emitted non-inline assets: ${unsupported.map((item) => item.fileName).join(", ")}`);
	}
	// 两段代码由不同 Rollup build 独立压缩，必须隔离词法作用域，避免短变量名碰撞。
	// 顺序 await 同时保证 Browser Runtime 完成可信外壳握手后，业务 bundle 才开始执行。
	const browserRuntime = await createNoumiBrowserRuntimeBuild();
	const inlineJavascript =
		`await (async()=>{\n${browserRuntime.code}\n})();\nawait (async()=>{\n${javascript}\n})();`;
	const htmlPrefix =
		`<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light dark"><title>Light System</title><style>${escapeInlineSource(css, "style")}</style></head><body><div id="root" data-light-system-root="true"></div><script type="module">\n`;
	const html =
		`${htmlPrefix}${escapeInlineSource(inlineJavascript, "script")}\n</script></body></html>`;
	const scriptStartLine = countNewlines(htmlPrefix);
	const runtimeLineCount = countNewlines(browserRuntime.code) + 1;
	const privateSourceMap = {
		version: 3,
		file: "index.html",
		sections: [
			{
				// 第一层 wrapper 占一行，Runtime bundle 从下一行开始。
				offset: { line: scriptStartLine + 1, column: 0 },
				map: normalizeLeafSourceMap(browserRuntime.sourceMap),
			},
			{
				// Runtime、闭合 wrapper 和业务 wrapper 各自占据稳定行数。
				offset: {
					line: scriptStartLine + runtimeLineCount + 3,
					column: 0,
				},
				map: normalizeLeafSourceMap(
					parseSourceMap(javascriptOutput!, "Light System client"),
				),
			},
		],
	};
	// dist 是一次性构建输出，不属于源码仓库；每次构建都从空目录开始。
	await rm(OUTPUT_DIR, { force: true, recursive: true });
	await mkdir(OUTPUT_DIR, { recursive: true });
	await mkdir(PRIVATE_DIAGNOSTICS_DIR, { recursive: true });
	await writeFile(OUTPUT_PATH, html);
	await writeFile(PRIVATE_SOURCE_MAP_PATH, JSON.stringify(privateSourceMap));
	console.log(JSON.stringify({ output: OUTPUT_PATH, bytes: new TextEncoder().encode(html).byteLength }, null, 2));
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
