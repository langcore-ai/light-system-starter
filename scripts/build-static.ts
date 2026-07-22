import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { build as buildVite } from "vite";

/** starter 根目录。 */
const ROOT_DIR = new URL("..", import.meta.url).pathname;

/** 浏览器入口。 */
const CLIENT_ENTRY_PATH = join(ROOT_DIR, "src/client/main.tsx");

/** 平台读取的固定静态包路径。 */
const OUTPUT_PATH = join(ROOT_DIR, "static-bundle.generated.json");

/** Vite 输出资产的最小结构。 */
type OutputAsset = {
	fileName: string;
	source?: string | Uint8Array;
	code?: string;
};

/** 避免内联源码提前结束 HTML 标签。 */
function escapeInlineSource(source: string, tagName: "script" | "style"): string {
	return source.replace(new RegExp(`</${tagName}`, "gi"), `<\\/${tagName}`);
}

/** 构建纯浏览器应用并输出自包含 HTML 静态包。 */
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
			rollupOptions: {
				input: CLIENT_ENTRY_PATH,
				output: { format: "es", inlineDynamicImports: true },
			},
			write: false,
		},
	});
	const outputs = (Array.isArray(result) ? result[0].output : result.output) as OutputAsset[];
	const javascript = outputs.find((output) => output.fileName.endsWith(".js"))?.code;
	const cssAsset = outputs.find((output) => output.fileName.endsWith(".css"));
	const css = typeof cssAsset?.source === "string"
		? cssAsset.source
		: cssAsset?.source
			? new TextDecoder().decode(cssAsset.source)
			: "";
	if (!javascript) throw new Error("client build did not emit a JavaScript chunk");
	const unsupported = outputs.filter((output) =>
		!output.fileName.endsWith(".js") && !output.fileName.endsWith(".css"));
	if (unsupported.length > 0) {
		throw new Error(`static build emitted non-inline assets: ${unsupported.map((item) => item.fileName).join(", ")}`);
	}
	const html = `<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light dark"><title>Light System</title><style>${escapeInlineSource(css, "style")}</style></head><body><div id="root" data-light-system-root="true"></div><script type="module">${escapeInlineSource(javascript, "script")}</script></body></html>`;
	const bundle = {
		schemaVersion: 1,
		entrypoint: "index.html",
		files: {
			"index.html": {
				content: html,
				contentType: "text/html; charset=utf-8",
				encoding: "utf8",
			},
		},
	};
	await writeFile(OUTPUT_PATH, `${JSON.stringify(bundle, null, "\t")}\n`);
	console.log(JSON.stringify({ output: OUTPUT_PATH, bytes: new TextEncoder().encode(html).byteLength }, null, 2));
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
