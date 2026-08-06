import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { transformWithOxc } from "vite";

/** 平台隔离构建器读取的标准静态输出目录。 */
const DIST_PATH = join(new URL("..", import.meta.url).pathname, "dist");

/** 轻系统固定 HTML 入口。 */
const ENTRYPOINT_PATH = join(DIST_PATH, "index.html");

/** 平台 Builder 会私下提取、不会进入公开 manifest 的 map。 */
const PRIVATE_SOURCE_MAP_PATH = join(
	DIST_PATH,
	".noumi-private",
	"index.html.map",
);

/** 断言构建结果满足静态发布契约。 */
function assert(condition: boolean, message: string): asserts condition {
	if (!condition) throw new Error(message);
}

/** 验证 dist 只包含公开自包含 HTML 和固定私有诊断 map。 */
async function main() {
	const entries = await readdir(DIST_PATH, { recursive: true });
	assert(
		entries.length === 3 &&
			entries.includes("index.html") &&
			entries.includes(".noumi-private") &&
			entries.includes(".noumi-private/index.html.map"),
		"starter must emit index.html and one private diagnostics map",
	);
	const index = await readFile(ENTRYPOINT_PATH, "utf8");
	const privateSourceMap = JSON.parse(
		await readFile(PRIVATE_SOURCE_MAP_PATH, "utf8"),
	) as { version?: unknown; sections?: unknown };
	assert(privateSourceMap.version === 3, "private source map version is invalid");
	assert(
		Array.isArray(privateSourceMap.sections) &&
			privateSourceMap.sections.length === 2,
		"private source map must combine Runtime and client sections",
	);
	const inlineModule = index.match(
		/<script type="module">([\s\S]*?)<\/script>/i,
	)?.[1];
	assert(typeof inlineModule === "string", "inline browser module is missing");
	// 两段独立压缩的 bundle 即使都能单独解析，直接拼接后仍可能变量重名。
	await transformWithOxc(inlineModule, "index.js", {
		lang: "js",
		sourceType: "module",
		target: "es2022",
	});
	assert(index.includes('data-light-system-root="true"'), "React root marker is missing");
	assert(index.includes("__LIGHT_SYSTEM_REACT_SPA_READY__"), "React ready marker is missing");
	assert(index.includes('"NoumiBridge"'), "NoumiBridge runtime is missing");
	assert(index.includes("noumi:light-system:bridge:ready"), "NoumiBridge handshake is missing");
	assert(index.includes("https://db.noumi.invalid"), "Noumi DB virtual protocol is missing");
	assert(index.includes("structuredCrud"), "Noumi DB capability validation is missing");
	assert(index.includes("bridge:diagnostics"), "Noumi diagnostics runtime is missing");
	assert(!index.includes("sourceMappingURL"), "public HTML must not reference a source map");
	assert(!index.includes("/api/health"), "backend health API must not exist in a static app");
	assert(!index.includes("DurableObject"), "Dynamic Worker code must not be bundled");
	console.log(JSON.stringify({ ok: true, entrypoint: "index.html" }, null, 2));
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
