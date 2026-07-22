import { readFile } from "node:fs/promises";
import { join } from "node:path";

/** 平台读取的固定静态包路径。 */
const BUNDLE_PATH = join(new URL("..", import.meta.url).pathname, "static-bundle.generated.json");

/** 断言构建结果满足静态发布契约。 */
function assert(condition: boolean, message: string): asserts condition {
	if (!condition) throw new Error(message);
}

/** 验证生成物只包含自包含浏览器 HTML。 */
async function main() {
	const bundle = JSON.parse(await readFile(BUNDLE_PATH, "utf8")) as Record<string, unknown>;
	assert(bundle.schemaVersion === 1, "schemaVersion must be 1");
	assert(bundle.entrypoint === "index.html", "entrypoint must be index.html");
	assert(bundle.files && typeof bundle.files === "object" && !Array.isArray(bundle.files), "files is required");
	const files = bundle.files as Record<string, unknown>;
	assert(Object.keys(files).length === 1, "starter must emit one self-contained index.html");
	const index = files["index.html"] as Record<string, unknown> | undefined;
	assert(index && index.contentType === "text/html; charset=utf-8", "index.html contentType is invalid");
	assert(typeof index.content === "string", "index.html content is required");
	assert(index.content.includes('data-light-system-root="true"'), "React root marker is missing");
	assert(index.content.includes("__LIGHT_SYSTEM_REACT_SPA_READY__"), "React ready marker is missing");
	assert(!index.content.includes("/api/health"), "backend health API must not exist in a static app");
	assert(!index.content.includes("DurableObject"), "Dynamic Worker code must not be bundled");
	console.log(JSON.stringify({ ok: true, entrypoint: bundle.entrypoint }, null, 2));
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
