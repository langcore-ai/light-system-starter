import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

/** 平台隔离构建器读取的标准静态输出目录。 */
const DIST_PATH = join(new URL("..", import.meta.url).pathname, "dist");

/** 轻系统固定 HTML 入口。 */
const ENTRYPOINT_PATH = join(DIST_PATH, "index.html");

/** 断言构建结果满足静态发布契约。 */
function assert(condition: boolean, message: string): asserts condition {
	if (!condition) throw new Error(message);
}

/** 验证 dist 只包含自包含浏览器 HTML。 */
async function main() {
	const entries = await readdir(DIST_PATH, { recursive: true });
	assert(entries.length === 1 && entries[0] === "index.html", "starter must emit one self-contained index.html");
	const index = await readFile(ENTRYPOINT_PATH, "utf8");
	assert(index.includes('data-light-system-root="true"'), "React root marker is missing");
	assert(index.includes("__LIGHT_SYSTEM_REACT_SPA_READY__"), "React ready marker is missing");
	assert(index.includes('"NoumiBridge"'), "NoumiBridge runtime is missing");
	assert(index.includes("noumi:light-system:bridge:ready"), "NoumiBridge handshake is missing");
	assert(index.includes("https://db.noumi.invalid"), "Noumi DB virtual protocol is missing");
	assert(index.includes("structuredCrud"), "Noumi DB capability validation is missing");
	assert(!index.includes("/api/health"), "backend health API must not exist in a static app");
	assert(!index.includes("DurableObject"), "Dynamic Worker code must not be bundled");
	console.log(JSON.stringify({ ok: true, entrypoint: "index.html" }, null, 2));
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
