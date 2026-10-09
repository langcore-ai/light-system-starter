import { createNoumiRequestId } from "./noumi-request-id";
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
import {
	createNoumiOutsideDb,
	type NoumiOutsideDbCapabilities,
	type NoumiOutsideDbTransport,
} from "./noumi-outside-db";

/** 项目管理员管理的不可变 Secret 名称；仅服务端解析，轮换在下一次请求生效，无需发布。 */
export type NoumiHttpSecretReference = { $secret: string; prefix?: string };
export type NoumiHttpValue = string | NoumiHttpSecretReference;
/** JSON 可递归包含 Secret 引用；不支持任意模板插值。 */
export type NoumiHttpJson =
	| null
	| boolean
	| number
	| string
	| NoumiHttpSecretReference
	| NoumiHttpJson[]
	| { [key: string]: NoumiHttpJson };
/** 文件上传由平台生成 multipart boundary，二进制字节不会按 UTF-8 转码。 */
export type NoumiHttpMultipart = {
	fields?: Record<string, NoumiHttpValue>;
	files: Array<{ name: string; filename: string; contentType?: string; data: Blob | Uint8Array | ArrayBuffer }>;
};
/** 五种正文形式互斥；省略所有正文适用于 GET/HEAD。 */
export type NoumiHttpBody =
	| { body?: string; json?: never; form?: never; text?: never; multipart?: never }
	| { body?: never; json: NoumiHttpJson; form?: never; text?: never; multipart?: never }
	| { body?: never; json?: never; form: Record<string, NoumiHttpValue>; text?: never; multipart?: never }
	| { body?: never; json?: never; form?: never; text: NoumiHttpValue[]; multipart?: never }
	| { body?: never; json?: never; form?: never; text?: never; multipart: NoumiHttpMultipart };
/** 后端代理公网 HTTP(S)；Secret 仅服务端解析并发往公网 HTTPS，不继承平台 Cookie。 */
export type NoumiHttpRequest = {
	url: string;
	method?: "GET" | "HEAD" | "POST" | "PUT" | "PATCH" | "DELETE" | "OPTIONS";
	headers?: Record<string, NoumiHttpValue>;
	query?: Record<string, NoumiHttpValue>;
	/** 追加到固定 URL path，各段独立编码；URL 不得包含 query。 */
	pathSegments?: NoumiHttpValue[];
	/** 默认 30000，允许 100–30000 毫秒。 */
	timeoutMs?: number;
} & NoumiHttpBody;
/** 平台 HTTP 错误；catch 后按 code/outcome 等属性收窄，unknown 不得自动重试。 */
export type NoumiHttpError = Error & {
	readonly code: string;
	readonly secretName?: string;
	readonly requiredPermission?: "project-admin";
	readonly outcome: "not-sent" | "unknown";
};
/** HTTP 响应同时保留文本和解码传输压缩后的二进制 base64 表示。 */
export type NoumiHttpResponse = {
	status: number;
	statusText: string;
	headers: Array<[string, string]>;
	body: string;
	bodyBase64: string;
};

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
	/** 文件内容传输由宿主统一执行。 */
	hostFileTransfer?: boolean;
	/** Shell 支持无持久化的临时 File/Blob 下载，和存储授权独立。 */
	generatedFileDownload?: boolean;
	app: { name: string };
	createByMember: BootstrapMember;
	currentMember: (BootstrapMember & { id: string }) | null;
	databaseCapabilities: NoumiDbCapabilities;
	appStorageCapabilities: NoumiFileCapabilities;
	outsideDbCapabilities: NoumiOutsideDbCapabilities;
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

// 原控制台输出保持不变；诊断自身不调用 console.error，避免递归。
const originalConsoleError = console.error.bind(console);
console.error = (...args: unknown[]) => {
	originalConsoleError(...args);
	diagnosticsReporter.captureConsoleError(args);
};

window.addEventListener("error", (event) => {
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

window.addEventListener("unhandledrejection", (event) => {
	// 不取消浏览器默认行为，原始 rejection 仍显示在 DevTools。
	diagnosticsReporter.captureUnhandledRejection(event.reason);
});

window.addEventListener("pagehide", () => {
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

/** 当前身份必须包含服务端注入的稳定Core成员ID。 */
function isCurrentMember(value: unknown): value is BootstrapMember & { id: string } {
	return isMember(value) && "id" in value && typeof value.id === "string" && value.id.length > 0;
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

/** 校验外部数据库 capability 快照；grant 不会通过 bootstrap 暴露。 */
function isOutsideDbCapabilities(
	value: unknown,
): value is NoumiOutsideDbCapabilities {
	return isRecord(value) &&
		value.protocolVersion === 1 &&
		typeof value.available === "boolean" &&
		value.driver === "POSTGRESQL";
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
	if (event.data.type === "noumi:light-system:bridge:route") {
		// 宿主拥有地址栏，iframe只消费当前应用hash；不重新加载业务页面。
		if (typeof event.data.hash === "string" && (event.data.hash === "" || event.data.hash.startsWith("#")) &&
			new TextEncoder().encode(event.data.hash).byteLength <= 8192 && location.hash !== event.data.hash) {
			const target = new URL(location.href);
			target.hash = event.data.hash;
			location.replace(target.href);
		}
		return;
	}
	if (event.data.type === BRIDGE_BOOTSTRAP_MESSAGE) {
		const payload = event.data.payload;
		if (
			!isRecord(payload) ||
			!isRecord(payload.app) ||
			typeof payload.app.name !== "string" ||
			!isMember(payload.createByMember) ||
			payload.currentMember !== null && !isCurrentMember(payload.currentMember) ||
			!isDatabaseCapabilities(payload.databaseCapabilities) ||
			!isAppStorageCapabilities(payload.appStorageCapabilities) ||
			!isOutsideDbCapabilities(payload.outsideDbCapabilities) ||
			!isAppStorageCapabilities(payload.workspaceFilesCapabilities)
		) {
			bootstrapReject(new Error("Noumi iframe bootstrap payload is invalid"));
			return;
		}
		clearTimeout(bootstrapTimer);
		diagnosticsReporter.setChannel(channelId, event.data.diagnosticsAcknowledgement === true);
		bootstrapResolve(payload as BootstrapPayload);
		return;
	}
	if (event.data.type === "noumi:light-system:bridge:diagnostics:ack" && typeof event.data.batchId === "string") {
		diagnosticsReporter.acknowledgeBatch(event.data.batchId);
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
		const failure = createBridgeCallError(
				typeof event.data.error === "string"
					? event.data.error
					: "Noumi capability call failed",
				event.data.requestId,
				"unknown",
			);
		// 受信宿主返回原requestId与outcome，不能把明确业务拒绝统一改成结果未知。
		const details = event.data.errorDetails;
		if (isRecord(details)) {
			if (typeof details.code === "string") Object.assign(failure, { code: details.code });
			if (typeof details.requestId === "string") failure.requestId = details.requestId;
			if (details.outcome === "not-sent" || details.outcome === "unknown") failure.outcome = details.outcome;
		}
		if (isRecord(details)) Object.assign(failure, { retryable: details.retryable === true, currentEtag: details.currentEtag });
		active.reject(failure);
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
	timeoutMs = BRIDGE_REQUEST_TIMEOUT_MS,
): Promise<unknown> {
	return new Promise((resolve, reject) => {
		// UUID 避免同一 Light System 的多成员、多 tab 在同一毫秒产生碰撞。
		const requestId = createNoumiRequestId();
		const cancelMethod = /^(appStorage|workspaceFiles)\.(uploadFile|readFile|downloadFile)$/.test(method) ? "files.cancel" : method === "appStorage.request"
			? "appStorage.cancel"
			: method === "workspaceFiles.request"
				? "workspaceFiles.cancel"
				: method === "outsideDb.request"
					? "outsideDb.cancel"
					: method.startsWith("media.") && method !== "media.cancel"
						? "media.cancel"
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
					requestId: createNoumiRequestId(),
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
					requestId: createNoumiRequestId(),
					method: cancelMethod,
					params: { requestId },
				}, "*");
			}
		}, timeoutMs);
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
		// Firefox 的空 Request body 可能非 null；GET/HEAD 按方法省略。
		body: request.method === "GET" || request.method === "HEAD" || request.body === null ? null : await request.text(),
	}, options?.signal);
	if (!isBridgeDatabaseResponse(response)) {
		throw new Error("Noumi database Bridge response is invalid");
	}
	return new Response(response.body, {
		status: response.status,
		headers: response.headers,
	});
};

/** App Storage 元数据控制面通过可信父外壳；二进制传输使用独立宿主RPC。 */
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

/** Workspace Files 元数据控制面通过可信父外壳；文件bytes由宿主执行。 */
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

/** 完整 SQL 只经可信父外壳发送；iframe 不接触连接或 Executor 信息。 */
const outsideDbTransport: NoumiOutsideDbTransport = async (
	request,
	options,
) => {
	const response = await call(
		"outsideDb.request",
		request,
		options?.signal,
		Math.min((options?.timeoutMs ?? 15_000) + 5_000, 65_000),
	);
	if (!isBridgeDatabaseResponse(response)) {
		throw new Error("Noumi external database Bridge response is invalid");
	}
	return response;
};

const payload = await bootstrap;
/** 大文件不经JSON控制面，File/Blob随RPC结构化克隆给Shell。 */
const fileHostTransport = (scope: "appStorage" | "workspaceFiles") => async (
	method: "uploadFile" | "readFile" | "downloadFile", input: Record<string, unknown>, options?: { signal?: AbortSignal },
) => {
	if (payload.hostFileTransfer !== true) throw new Error("NOUMI_FILE_HOST_TRANSFER_REQUIRED");
	// 新 SDK 不能把本地 Blob 请求发给旧 Shell 再退回 iframe 自行下载。
	if (method === "downloadFile" && input.file instanceof Blob && payload.generatedFileDownload !== true) throw Object.assign(new Error("NOUMI_GENERATED_FILE_DOWNLOAD_UNAVAILABLE"), { code: "NOUMI_GENERATED_FILE_DOWNLOAD_UNAVAILABLE", requestId: "local", retryable: false });
	return await call(`${scope}.${method}`, input, options?.signal, 310_000);
};

const bridge = Object.freeze({
	app: Object.freeze({ name: payload.app.name }),
	createByMember: freezeMember(payload.createByMember),
	currentMember: payload.currentMember === null
		? null
		: Object.freeze({ ...freezeMember(payload.currentMember), id: payload.currentMember.id }),
	diagnostics: Object.freeze({
		reportError(error: unknown, options?: NoumiReportErrorOptions): void {
			diagnosticsReporter.reportError(error, options);
		},
	}),
	localStorage: Object.freeze({
		/** 一次事务替换键集合；ifMatch不满足或净额超限均零修改。 */
		async replaceItems(input: { set: Record<string, string>; remove?: string[]; ifMatch?: Record<string, string | null> }): Promise<void> {
			await call("localStorage.replaceItems", input);
		},
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
	http: Object.freeze({
		/** 将请求交给可信外壳；不会在轻系统浏览器内发起外部 fetch。 */
		async request(input: NoumiHttpRequest): Promise<NoumiHttpResponse> {
			return await requestHttpCapability(input);
		},
	}),
	/** 宿主显示真实用户许可界面，结果仍由应用自行处理。 */
	media: Object.freeze({
		async recordAudio(options: { maxDurationMs?: number } = {}): Promise<Blob> {
			const value = await call("media.recordAudio", options, undefined, 210_000);
			if (!(value instanceof Blob)) throw new TypeError("Invalid media result");
			return value;
		},
		async takePhoto(options: { facingMode?: "user" | "environment" } = {}): Promise<Blob> {
			const value = await call("media.takePhoto", options, undefined, 150_000);
			if (!(value instanceof Blob)) throw new TypeError("Invalid media result");
			return value;
		},
		async cancel(): Promise<void> { await call("media.cancel", {}); },
	}),
	navigation: Object.freeze({
		async getRoute(): Promise<{ hash: string }> {
			return await call("navigation.getRoute", {}) as { hash: string };
		},
		async setHash(hash: string, options: { replace?: boolean } = {}): Promise<{ hash: string }> {
			return await call("navigation.setHash", { hash, replace: options.replace ?? false }) as { hash: string };
		},
		async openExternal(url: string): Promise<void> { await call("navigation.openExternal", { url }, undefined, 130_000); },
	}),
	appStorage: createNoumiAppStorage(
		appStorageTransport,
		payload.appStorageCapabilities,
		fileHostTransport("appStorage"),
	),
	workspaceFiles: createNoumiWorkspaceFiles(
		workspaceFilesTransport,
		payload.workspaceFilesCapabilities,
		fileHostTransport("workspaceFiles"),
	),
	outsideDb: createNoumiOutsideDb(
		outsideDbTransport,
		payload.outsideDbCapabilities,
	),
	db: createNoumiDatabase(databaseTransport, payload.databaseCapabilities),
});

/** 发送结构化 HTTP wire 并校验大小，响应统一按 base64 解码。 */
async function requestHttpCapability(input: NoumiHttpRequest): Promise<NoumiHttpResponse> {
	let wire: unknown = input;
	if ("multipart" in input && input.multipart) {
		const files = [];
		let fileBytes = 0;
		for (const file of input.multipart.files) {
			const size = file.data instanceof Blob ? file.data.size : file.data.byteLength;
			fileBytes += size;
			if (fileBytes > 4 * 1024 * 1024) throw new TypeError("HTTP request exceeds limit");
			const bytes = file.data instanceof Blob ? new Uint8Array(await file.data.arrayBuffer())
				: file.data instanceof Uint8Array ? file.data : new Uint8Array(file.data);
			let binary = "";
			for (let offset = 0; offset < bytes.length; offset += 16 * 1024) {
				binary += String.fromCharCode(...bytes.subarray(offset, offset + 16 * 1024));
			}
			files.push({ name: file.name, filename: file.filename, contentType: file.contentType, dataBase64: btoa(binary) });
		}
		wire = { ...input, multipart: { fields: input.multipart.fields, files } };
	}
	const payload = JSON.stringify(wire);
	if (typeof payload !== "string" || new TextEncoder().encode(payload).byteLength > 6 * 1024 * 1024)
		throw new TypeError("HTTP request exceeds limit");
	const response = await call("http.request", wire, undefined, 40_000);
	if (isRecord(response) && "httpError" in response) {
		const failure = response.httpError;
		if (
			!isRecord(failure) ||
			typeof failure.code !== "string" ||
			!/^(?:NOUMI_[A-Z0-9_]{1,100}|project_secret_[a-z_]{1,100})$/.test(failure.code) ||
			(failure.outcome !== "not-sent" && failure.outcome !== "unknown")
		) {
			throw new TypeError("Invalid HTTP Bridge response");
		}
		const error: NoumiHttpError = Object.assign(new Error(failure.code), {
			code: failure.code,
			outcome: failure.outcome,
			...(typeof failure.secretName === "string" && /^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(failure.secretName)
				? { secretName: failure.secretName }
				: {}),
			...(failure.requiredPermission === "project-admin" ? { requiredPermission: "project-admin" as const } : {}),
		} as const);
		throw error;
	}
	const result = response as {
		status: number;
		statusText: string;
		headers: Array<[string, string]>;
		body: string;
		bodyEncoding: string;
	};
	if (
		!result ||
		result.bodyEncoding !== "base64" ||
		typeof result.body !== "string" ||
		!Number.isInteger(result.status) ||
		!Array.isArray(result.headers)
	)
		throw new TypeError("Invalid HTTP Bridge response");
	const bytes = Uint8Array.from(atob(result.body), (char) => char.charCodeAt(0));
	return {
		status: result.status,
		statusText: result.statusText,
		headers: result.headers,
		body: new TextDecoder().decode(bytes),
		bodyBase64: result.body,
	};
}

Object.defineProperty(window, "NoumiBridge", {
	value: bridge,
	writable: false,
	configurable: false,
	enumerable: true,
});
