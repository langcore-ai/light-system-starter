import { build as buildVite } from "vite";

/** Browser Runtime 源码入口。 */
const BROWSER_RUNTIME_ENTRY_PATH = new URL(
	"./noumi-browser-runtime-client.ts",
	import.meta.url,
).pathname;

/** Vite 单文件输出的最小结构。 */
type RuntimeOutputAsset = {
	fileName: string;
	code?: string;
	map?: {
		toString(): string;
	} | null;
};

/** Browser Runtime 构建字节和对应 leaf sourcemap。 */
export type NoumiBrowserRuntimeBuild = {
	code: string;
	sourceMap: Record<string, unknown>;
};

/** 删除内联后不再成立的公开 sourceMappingURL 注释。 */
function stripSourceMappingUrl(code: string): string {
	return code.replace(/\n?\/\/# sourceMappingURL=.*$/gm, "");
}

/** 解析 Rollup SourceMap，避免把 provider class 实例传入最终 JSON。 */
function parseSourceMap(
	output: RuntimeOutputAsset,
	label: string,
): Record<string, unknown> {
	if (!output.map) throw new Error(`${label} did not emit a source map`);
	const parsed = JSON.parse(output.map.toString()) as unknown;
	if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
		throw new Error(`${label} emitted an invalid source map`);
	}
	return parsed as Record<string, unknown>;
}

/**
 * 构建运行在业务 bundle 之前的 Browser Runtime。
 *
 * Runtime 与业务 bundle 分开构建，确保它可以先完成 Bridge 握手并冻结
 * `window.NoumiBridge`，同时让数据库 SDK 保持普通可单测 TypeScript。
 */
export async function createNoumiBrowserRuntimeBuild(): Promise<NoumiBrowserRuntimeBuild> {
	const result = await buildVite({
		configFile: false,
		logLevel: "silent",
		build: {
			emptyOutDir: false,
			minify: true,
			sourcemap: true,
			rollupOptions: {
				input: BROWSER_RUNTIME_ENTRY_PATH,
				output: { format: "es", inlineDynamicImports: true },
			},
			target: "es2022",
			write: false,
		},
	});
	const outputs = (Array.isArray(result) ? result[0].output : result.output) as
		| RuntimeOutputAsset[];
	const output = outputs.find((candidate) => candidate.fileName.endsWith(".js"));
	if (!output?.code) throw new Error("Browser Runtime did not emit JavaScript");
	return {
		code: stripSourceMappingUrl(output.code),
		sourceMap: parseSourceMap(output, "Browser Runtime"),
	};
}

/** 兼容浏览器 E2E fixture 的只读源码入口。 */
export async function createNoumiBrowserRuntimeSource(): Promise<string> {
	return (await createNoumiBrowserRuntimeBuild()).code;
}
