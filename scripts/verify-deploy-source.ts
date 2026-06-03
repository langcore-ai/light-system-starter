import { readFile } from "node:fs/promises";
import { join } from "node:path";

/** 项目根目录。 */
const ROOT_DIR = new URL("..", import.meta.url).pathname;
/** 部署 payload 路径。 */
const PAYLOAD_PATH = join(ROOT_DIR, "deploy-source-payload.generated.json");
/** 固定 Worker 部署入口。 */
const EXPECTED_ENTRY_POINT = "src/server/worker.js";
/** Worker 源码中禁止出现的运行时能力。 */
const FORBIDDEN_WORKER_PATTERNS = ["process.env", "node:fs", "fs/promises", "child_process"] as const;
/** 构建占位符，生成后必须全部替换。 */
const PLACEHOLDERS = [
	"__LIGHT_SYSTEM_VERSION__",
	"__LIGHT_SYSTEM_CLIENT_BUNDLE__",
	"__LIGHT_SYSTEM_CLIENT_STYLE__",
] as const;

/** deploy-source payload 的最小结构。 */
type DeploySourcePayload = {
	/** 当前构建版本。 */
	version?: unknown;
	/** Worker compatibility date。 */
	compatibilityDate?: unknown;
	/** 入口模块路径。 */
	entryPoint?: unknown;
	/** 源码文件表。 */
	files?: Record<string, unknown>;
};

/**
 * 断言条件成立。
 * @param condition 条件
 * @param message 错误信息
 */
function assert(condition: boolean, message: string): void {
	if (!condition) {
		throw new Error(message);
	}
}

/**
 * 读取并解析 payload。
 * @returns deploy-source payload
 */
async function readPayload(): Promise<DeploySourcePayload> {
	const raw = await readFile(PAYLOAD_PATH, "utf8");
	return JSON.parse(raw) as DeploySourcePayload;
}

/**
 * 验证 deploy-source payload 可以直接提交给主服务。
 * @returns void
 */
async function main() {
	const payload = await readPayload();
	assert(payload.entryPoint === EXPECTED_ENTRY_POINT, `entryPoint must be ${EXPECTED_ENTRY_POINT}`);
	assert(typeof payload.version === "string" && payload.version.length > 0, "version is required");
	assert(typeof payload.compatibilityDate === "string", "compatibilityDate is required");
	assert(Boolean(payload.files), "files is required");
	assert(Object.hasOwn(payload.files ?? {}, EXPECTED_ENTRY_POINT), `${EXPECTED_ENTRY_POINT} is required`);
	assert(!Object.hasOwn(payload.files ?? {}, "src/worker.js"), "old src/worker.js entry must not be emitted");

	const workerSource = payload.files?.[EXPECTED_ENTRY_POINT];
	assert(typeof workerSource === "string", "worker source must be a string");
	for (const placeholder of PLACEHOLDERS) {
		assert(!workerSource.includes(placeholder), `${placeholder} was not replaced`);
	}
	for (const pattern of FORBIDDEN_WORKER_PATTERNS) {
		assert(!workerSource.includes(pattern), `${pattern} must not be bundled into worker source`);
	}
	assert(workerSource.includes("class App extends DurableObject"), "App Durable Object class is missing");
	assert(workerSource.includes('data-react-spa-root="true"'), "HTML shell root is missing");
	assert(workerSource.includes("__LIGHT_SYSTEM_REACT_SPA_READY__"), "client bundle marker is missing");
	assert(workerSource.includes("tailwindcss v4"), "Tailwind CSS output is missing");

	console.log(JSON.stringify({ ok: true, entryPoint: payload.entryPoint, version: payload.version }, null, 2));
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
