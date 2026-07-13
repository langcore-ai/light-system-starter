import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { build as buildVite } from "vite";

/** 项目根目录。 */
const ROOT_DIR = new URL("..", import.meta.url).pathname;
/** Worker 源码路径，后端代码必须和浏览器代码分目录存放。 */
const WORKER_SOURCE_PATH = join(ROOT_DIR, "src/server/worker.ts");
/** React 客户端入口，前端代码必须独立放在 src/client。 */
const CLIENT_ENTRY_PATH = join(ROOT_DIR, "src/client/main.tsx");
/** 部署 payload 输出路径。 */
const OUTPUT_PATH = join(ROOT_DIR, "deploy-source-payload.generated.json");
/** 浏览器 bundle 占位符。 */
const CLIENT_BUNDLE_PLACEHOLDER = "\"__LIGHT_SYSTEM_CLIENT_BUNDLE__\"";
/** 浏览器 CSS 占位符。 */
const CLIENT_STYLE_PLACEHOLDER = "\"__LIGHT_SYSTEM_CLIENT_STYLE__\"";
/** 版本占位符。 */
const VERSION_PLACEHOLDER = "\"__LIGHT_SYSTEM_VERSION__\"";
/** Worker compatibility date。 */
const COMPATIBILITY_DATE = "2026-06-03";

/** Vite 输出资产。 */
type OutputAsset = {
	/** 文件名。 */
	fileName: string;
	/** 资产源码。 */
	source?: string | Uint8Array;
	/** chunk 代码。 */
	code?: string;
};

/**
 * 读取当前构建版本。
 * @returns 版本号
 */
function resolveVersion(): string {
	return process.env.LIGHT_SYSTEM_VERSION?.trim() || `starter-${Date.now()}`;
}

/**
 * 读取 Artifacts 来源信息。
 * @returns payload artifact 字段
 */
function resolveArtifact() {
	return {
		repo: process.env.LIGHT_SYSTEM_ARTIFACT_REPO || "light-system-starter",
		branch: process.env.LIGHT_SYSTEM_ARTIFACT_BRANCH || "main",
		commit: process.env.LIGHT_SYSTEM_ARTIFACT_COMMIT || "local-starter",
		remote: process.env.LIGHT_SYSTEM_ARTIFACT_REMOTE || "local-starter",
	};
}

/**
 * 构建 React 客户端，并返回 JS 与 CSS。
 * @returns 浏览器 JS/CSS
 */
async function buildClient(): Promise<{ js: string; css: string }> {
	const result = await buildVite({
		configFile: false,
		logLevel: "silent",
		plugins: [react(), tailwindcss()],
		resolve: {
			alias: {
				// shadcn-style 组件只允许解析到前端目录，避免误引用 Worker 代码。
				"@": join(ROOT_DIR, "src/client"),
			},
		},
		build: {
			cssCodeSplit: false,
			emptyOutDir: false,
			minify: true,
			rollupOptions: {
				input: CLIENT_ENTRY_PATH,
				output: {
					format: "es",
				},
			},
			write: false,
		},
	});

	const outputs = (Array.isArray(result) ? result[0].output : result.output) as OutputAsset[];
	const js = outputs.find((output) => output.fileName.endsWith(".js"))?.code;
	const cssAsset = outputs.find((output) => output.fileName.endsWith(".css"));
	const css = typeof cssAsset?.source === "string"
		? cssAsset.source
		: cssAsset?.source
			? new TextDecoder().decode(cssAsset.source)
			: "";
	if (!js) {
		throw new Error("client build did not emit a JavaScript chunk");
	}

	return { js, css };
}

/**
 * 构建 Worker 源码，并注入前端资产。
 * @param assets 前端 JS/CSS
 * @returns 可交给 deploy-source 的 Worker JS
 */
async function buildWorkerSource(assets: { js: string; css: string }, version: string): Promise<string> {
	const built = await Bun.build({
		entrypoints: [WORKER_SOURCE_PATH],
		// 部署端不会安装 npm 依赖，只保留 workerd 原生提供的平台模块。
		external: ["cloudflare:workers"],
		format: "esm",
		minify: false,
		packages: "bundle",
		target: "browser",
		write: false,
	});
	if (!built.success || built.outputs.length === 0) {
		throw new Error("worker source build failed");
	}

	let source = await built.outputs[0].text();
	source = source.replace(VERSION_PLACEHOLDER, () => JSON.stringify(version));
	source = source.replace(CLIENT_BUNDLE_PLACEHOLDER, () => JSON.stringify(assets.js));
	source = source.replace(CLIENT_STYLE_PLACEHOLDER, () => JSON.stringify(assets.css));
	if (
		source.includes("__LIGHT_SYSTEM_VERSION__") ||
		source.includes("__LIGHT_SYSTEM_CLIENT_BUNDLE__") ||
		source.includes("__LIGHT_SYSTEM_CLIENT_STYLE__")
	) {
		throw new Error("worker source still contains unreplaced placeholders");
	}
	return source;
}

/**
 * 写入 deploy-source payload。
 * @returns void
 */
async function main() {
	const version = resolveVersion();
	const assets = await buildClient();
	const workerSource = await buildWorkerSource(assets, version);
	const payload = {
		version,
		compatibilityDate: COMPATIBILITY_DATE,
		entryPoint: "src/server/worker.js",
		dependencies: {
			hono: "4.11.1",
			react: "19.2.1",
			"react-dom": "19.2.1",
		},
		artifact: resolveArtifact(),
		files: {
			"src/server/worker.js": workerSource,
		},
	};

	await mkdir(dirname(OUTPUT_PATH), { recursive: true });
	await writeFile(OUTPUT_PATH, `${JSON.stringify(payload, null, "\t")}\n`);
	console.log(JSON.stringify({ output: OUTPUT_PATH, entryPoint: payload.entryPoint }, null, 2));
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
