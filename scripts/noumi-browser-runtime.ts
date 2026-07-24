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
};

/**
 * 构建运行在业务 bundle 之前的 Browser Runtime。
 *
 * Runtime 与业务 bundle 分开构建，确保它可以先完成 Bridge 握手并冻结
 * `window.NoumiBridge`，同时让数据库 SDK 保持普通可单测 TypeScript。
 */
export async function createNoumiBrowserRuntimeSource(): Promise<string> {
	const result = await buildVite({
		configFile: false,
		logLevel: "silent",
		build: {
			emptyOutDir: false,
			minify: true,
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
	const javascript = outputs.find((output) => output.fileName.endsWith(".js"))?.code;
	if (!javascript) throw new Error("Browser Runtime did not emit JavaScript");
	return javascript;
}
