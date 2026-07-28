import {
	createNoumiDatabase,
	type NoumiDbCapabilities,
	type NoumiDbTransport,
} from "./noumi-db-sdk";
import {
	NoumiClientDiagnosticsReporter,
	type NoumiReportErrorOptions,
} from "./noumi-client-diagnostics";
import {
	createNoumiAppStorage,
	type NoumiAppStorageControlTransport,
	type NoumiFileCapabilities,
} from "./noumi-app-storage";
import {
	createNoumiWorkspaceFiles,
	type NoumiWorkspaceFilesControlTransport,
} from "./noumi-workspace-files";

/** iframe Bridge 协议版本；必须和主平台可信外壳保持一致。 */
const BRIDGE_VERSION = 1;

/** iframe 通知可信外壳已准备接收启动上下文。 */
const BRIDGE_READY_MESSAGE = "noumi:light-system:bridge:ready";

/** 可信外壳向 iframe 返回启动上下文。 */
const BRIDGE_BOOTSTRAP_MESSAGE = "noumi:light-system:bridge:bootstrap";

/** iframe 请求可信外壳执行受控能力。 */
const BRIDGE_REQUEST_MESSAGE = "noumi:light-system:bridge:request";

/** 可信外壳返回能力调用结果。 */
const BRIDGE_RESPONSE_MESSAGE = "noumi:light-system:bridge:response";

/** 启动上下文和单次能力调用的最长等待时间。 */
const BRIDGE_REQUEST_TIMEOUT_MS = 10_000;

/** Bridge bootstrap 中的成员信息。 */
type BootstrapMember = {
	email: string;
	displayName: string | null;
};

/** Bridge bootstrap payload。 */
type BootstrapPayload = {
	app: { name: string };
	createByMember: BootstrapMember;
	currentMember: BootstrapMember | null;
	databaseCapabilities: NoumiDbCapabilities;
	appStorageCapabilities: NoumiFileCapabilities;
	workspaceFilesCapabilities: NoumiFileCapabilities;
};

/** 等待中的 Bridge RPC。 */
type PendingRequest = {
	resolve(value: unknown): void;
	reject(reason: unknown): void;
	timer: ReturnType<typeof setTimeout>;
};

/** db.request 返回的可结构化克隆 response。 */
type BridgeDatabaseResponse = {
	status: number;
	headers: Array<[string, string]>;
	body: string;
};

/** 页面级错误探针在业务 bundle 之前安装，bootstrap 前错误先进入有界队列。 */
const diagnosticsReporter = new NoumiClientDiagnosticsReporter();

addEventListener("error", (event) => {
	// 资源 error 不冒泡，必须使用捕获阶段；监听器只观察，不调用 preventDefault。
	if (event.target && event.target !== window) {
		diagnosticsReporter.captureResourceError(event.target as {
			tagName?: unknown;
			src?: unknown;
			href?: unknown;
			currentSrc?: unknown;
		});
		return;
	}
	diagnosticsReporter.captureRuntimeError({
		error: event.error,
		message: event.message,
		filename: event.filename,
		lineno: event.lineno,
		colno: event.colno,
	});
}, true);

addEventListener("unhandledrejection", (event) => {
	// 不取消浏览器默认行为，原始 rejection 仍显示在 DevTools。
	diagnosticsReporter.captureUnhandledRejection(event.reason);
});

addEventListener("pagehide", () => {
	// pagehide 只尝试同步 postMessage，HTTPS transport 由可信父外壳 best-effort 完成。
	diagnosticsReporter.flush();
});

Object.defineProperty(window, "__NOUMI_REPORT_REACT_ERROR__", {
	value(error: unknown, componentStack: unknown) {
		diagnosticsReporter.reportBoundaryError(error, componentStack);
	},
	writable: false,
	configurable: false,
	enumerable: false,
});

/** 判断普通 object。 */
function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** 校验成员 bootstrap。 */
function isMember(value: unknown): value is BootstrapMember {
	return isRecord(value) &&
		typeof value.email === "string" &&
		(value.displayName === null || typeof value.displayName === "string");
}

/** 校验数据库 capability 快照；它只用于 UI fallback，不替代服务端鉴权。 */
function isDatabaseCapabilities(value: unknown): value is NoumiDbCapabilities {
	return isRecord(value) &&
		value.dbProtocolVersion === 1 &&
		typeof value.structuredCrud === "boolean" &&
		typeof value.sqlQuery === "boolean" &&
		typeof value.sqlExecute === "boolean" &&
		typeof value.operationRecovery === "boolean";
}

/** 校验 App Storage capability 快照；真实授权仍由 Gateway 逐请求复核。 */
function isAppStorageCapabilities(
	value: unknown,
): value is NoumiFileCapabilities {
	return isRecord(value) &&
		value.protocolVersion === 1 &&
		typeof value.read === "boolean" &&
		typeof value.write === "boolean" &&
		Number.isSafeInteger(value.maxFileBytes) &&
		Number(value.maxFileBytes) > 0;
}

/** 校验父窗口返回的数据库 response。 */
function isBridgeDatabaseResponse(value: unknown): value is BridgeDatabaseResponse {
	if (
		!isRecord(value) ||
		!Number.isInteger(value.status) ||
		Number(value.status) < 100 ||
		Number(value.status) > 599 ||
		typeof value.body !== "string" ||
		!Array.isArray(value.headers)
	) {
		return false;
	}
	const names = new Set<string>();
	for (const entry of value.headers) {
		if (
			!Array.isArray(entry) ||
			entry.length !== 2 ||
			typeof entry[0] !== "string" ||
			typeof entry[1] !== "string"
		) {
			return false;
		}
		const name = entry[0].toLowerCase();
		if (
			!["content-type", "cache-control"].includes(name) ||
			names.has(name)
		) {
			return false;
		}
		names.add(name);
	}
	return names.has("content-type") &&
		names.has("cache-control") &&
		value.headers.some(([name, content]) =>
			name.toLowerCase() === "content-type" &&
			content.toLowerCase().startsWith("application/json")
		) &&
		value.headers.some(([name, content]) =>
			name.toLowerCase() === "cache-control" &&
			content.toLowerCase() === "no-store"
		);
}

/** 冻结只读成员上下文。 */
function freezeMember(member: BootstrapMember): BootstrapMember {
	return Object.freeze({
		email: member.email,
		displayName: member.displayName,
	});
}

const channelId = Array.from(
	crypto.getRandomValues(new Uint32Array(4)),
	(value) => value.toString(36),
).join("-");
const pending = new Map<string, PendingRequest>();
let bootstrapResolve: (payload: BootstrapPayload) => void;
let bootstrapReject: (reason: unknown) => void;
let bootstrapTimer: ReturnType<typeof setTimeout>;

const bootstrap = new Promise<BootstrapPayload>((resolve, reject) => {
	bootstrapResolve = resolve;
	bootstrapReject = reject;
	bootstrapTimer = setTimeout(
		() => reject(new Error("Noumi iframe bootstrap timed out")),
		BRIDGE_REQUEST_TIMEOUT_MS,
	);
});

addEventListener("message", (event) => {
	if (
		event.source !== window.parent ||
		!isRecord(event.data) ||
		event.data.version !== BRIDGE_VERSION ||
		event.data.channelId !== channelId
	) {
		return;
	}
	if (event.data.type === BRIDGE_BOOTSTRAP_MESSAGE) {
		const payload = event.data.payload;
		if (
			!isRecord(payload) ||
			!isRecord(payload.app) ||
			typeof payload.app.name !== "string" ||
			!isMember(payload.createByMember) ||
			payload.currentMember !== null && !isMember(payload.currentMember) ||
			!isDatabaseCapabilities(payload.databaseCapabilities) ||
			!isAppStorageCapabilities(payload.appStorageCapabilities) ||
			!isAppStorageCapabilities(payload.workspaceFilesCapabilities)
		) {
			bootstrapReject(new Error("Noumi iframe bootstrap payload is invalid"));
			return;
		}
		clearTimeout(bootstrapTimer);
		diagnosticsReporter.setChannel(channelId);
		bootstrapResolve(payload as BootstrapPayload);
		return;
	}
	if (
		event.data.type !== BRIDGE_RESPONSE_MESSAGE ||
		typeof event.data.requestId !== "string"
	) {
		return;
	}
	const active = pending.get(event.data.requestId);
	if (!active) return;
	pending.delete(event.data.requestId);
	clearTimeout(active.timer);
	if (event.data.ok === true) active.resolve(event.data.result);
	else {
		active.reject(
			createBridgeCallError(
				typeof event.data.error === "string"
					? event.data.error
					: "Noumi capability call failed",
				event.data.requestId,
				"unknown",
			),
		);
	}
});

window.parent.postMessage({
	type: BRIDGE_READY_MESSAGE,
	version: BRIDGE_VERSION,
	channelId,
}, "*");

/** 创建带 request ID/outcome 的 Bridge transport error。 */
function createBridgeCallError(
	cause: unknown,
	requestId: string,
	outcome: "not-sent" | "unknown",
): Error & {
	requestId: string;
	outcome: "not-sent" | "unknown";
} {
	const error = new Error(
		cause instanceof Error ? cause.message : String(cause),
		{ cause },
	) as Error & {
		requestId: string;
		outcome: "not-sent" | "unknown";
	};
	error.name = "NoumiBridgeCallError";
	error.requestId = requestId;
	error.outcome = outcome;
	return error;
}

/** 调用可信父窗口能力。 */
function call(
	method: string,
	params: unknown,
	signal?: AbortSignal,
): Promise<unknown> {
	return new Promise((resolve, reject) => {
		// UUID 避免同一 Light System 的多成员、多 tab 在同一毫秒产生碰撞。
		const requestId = crypto.randomUUID();
		const cancelMethod = method === "appStorage.request"
			? "appStorage.cancel"
			: method === "workspaceFiles.request"
				? "workspaceFiles.cancel"
			: method === "db.request"
				? "db.cancel"
				: null;
		if (signal?.aborted) {
			reject(createBridgeCallError(
				signal.reason ?? new DOMException("Aborted", "AbortError"),
				requestId,
				"not-sent",
			));
			return;
		}
		const abort = () => {
			const active = pending.get(requestId);
			if (!active) return;
			pending.delete(requestId);
			clearTimeout(active.timer);
			reject(createBridgeCallError(
				signal?.reason ?? new DOMException("Aborted", "AbortError"),
				requestId,
				"unknown",
			));
			// 取消只表示停止等待；父窗口和服务端仍按 operation ID 收敛 mutation。
			if (cancelMethod) {
				window.parent.postMessage({
					type: BRIDGE_REQUEST_MESSAGE,
					version: BRIDGE_VERSION,
					channelId,
					requestId: `${requestId}:cancel`,
					method: cancelMethod,
					params: { requestId },
				}, "*");
			}
		};
		const timer = setTimeout(() => {
			pending.delete(requestId);
			signal?.removeEventListener("abort", abort);
			reject(createBridgeCallError(
				"Noumi capability call timed out",
				requestId,
				"unknown",
			));
			// Query 尽快释放 provider 资源；mutation 仍只把结果视为 unknown。
			if (cancelMethod) {
				window.parent.postMessage({
					type: BRIDGE_REQUEST_MESSAGE,
					version: BRIDGE_VERSION,
					channelId,
					requestId: `${requestId}:timeout`,
					method: cancelMethod,
					params: { requestId },
				}, "*");
			}
		}, BRIDGE_REQUEST_TIMEOUT_MS);
		pending.set(requestId, {
			resolve(value) {
				signal?.removeEventListener("abort", abort);
				resolve(value);
			},
			reject(reason) {
				signal?.removeEventListener("abort", abort);
				reject(reason);
			},
			timer,
		});
		signal?.addEventListener("abort", abort, { once: true });
		window.parent.postMessage({
			type: BRIDGE_REQUEST_MESSAGE,
			version: BRIDGE_VERSION,
			channelId,
			requestId,
			method,
			params,
		}, "*");
	});
}

/** 校验 localStorage 字符串参数。 */
function requireString(value: unknown, name: string): string {
	if (typeof value !== "string") throw new TypeError(`${name} must be a string`);
	return value;
}

/** 把虚拟 Request 结构化克隆给可信父窗口。 */
const databaseTransport: NoumiDbTransport = async (request, options) => {
	const response = await call("db.request", {
		dbProtocolVersion: 1,
		url: request.url,
		method: request.method,
		headers: [...request.headers.entries()],
		body: request.body === null ? null : await request.text(),
	}, options?.signal);
	if (!isBridgeDatabaseResponse(response)) {
		throw new Error("Noumi database Bridge response is invalid");
	}
	return new Response(response.body, {
		status: response.status,
		headers: response.headers,
	});
};

/** App Storage control JSON 通过可信父外壳；文件 bytes 由 SDK 直接走 ticket URL。 */
const appStorageTransport: NoumiAppStorageControlTransport = async (
	request,
	options,
) => {
	const response = await call("appStorage.request", request, options?.signal);
	if (!isBridgeDatabaseResponse(response)) {
		throw new Error("Noumi App Storage Bridge response is invalid");
	}
	return new Response(response.body, {
		status: response.status,
		headers: response.headers,
	});
};

/** Workspace Files control JSON 通过可信父外壳；bytes 直接走 ticket URL。 */
const workspaceFilesTransport: NoumiWorkspaceFilesControlTransport = async (
	request,
	options,
) => {
	const response = await call(
		"workspaceFiles.request",
		request,
		options?.signal,
	);
	if (!isBridgeDatabaseResponse(response)) {
		throw new Error("Noumi Workspace Files Bridge response is invalid");
	}
	return new Response(response.body, {
		status: response.status,
		headers: response.headers,
	});
};

const payload = await bootstrap;
const bridge = Object.freeze({
	app: Object.freeze({ name: payload.app.name }),
	createByMember: freezeMember(payload.createByMember),
	currentMember: payload.currentMember === null
		? null
		: freezeMember(payload.currentMember),
	diagnostics: Object.freeze({
		reportError(error: unknown, options?: NoumiReportErrorOptions): void {
			diagnosticsReporter.reportError(error, options);
		},
	}),
	localStorage: Object.freeze({
		async setItem(key: string, value: string) {
			await call("localStorage.setItem", {
				key: requireString(key, "key"),
				value: requireString(value, "value"),
			});
		},
		async getItem(key: string) {
			const value = await call("localStorage.getItem", {
				key: requireString(key, "key"),
			});
			return typeof value === "string" ? value : null;
		},
		async removeItem(key: string) {
			await call("localStorage.removeItem", { key: requireString(key, "key") });
		},
		async clear() {
			await call("localStorage.clear", {});
		},
		async length() {
			const value = await call("localStorage.length", {});
			return typeof value === "number" ? value : 0;
		},
		async keys() {
			const value = await call("localStorage.keys", {});
			return Array.isArray(value)
				? value.filter((item): item is string => typeof item === "string")
				: [];
		},
		async has(key: string) {
			return await call("localStorage.has", {
				key: requireString(key, "key"),
			}) === true;
		},
		}),
	appStorage: createNoumiAppStorage(
		appStorageTransport,
		payload.appStorageCapabilities,
	),
	workspaceFiles: createNoumiWorkspaceFiles(
		workspaceFilesTransport,
		payload.workspaceFilesCapabilities,
	),
	db: createNoumiDatabase(databaseTransport, payload.databaseCapabilities),
});

Object.defineProperty(window, "NoumiBridge", {
	value: bridge,
	writable: false,
	configurable: false,
	enumerable: true,
});
