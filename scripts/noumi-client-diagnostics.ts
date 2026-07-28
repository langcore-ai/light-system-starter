/** iframe 向可信父外壳发送的单向 diagnostics 消息类型。 */
export const NOUMI_DIAGNOSTICS_MESSAGE =
	"noumi:light-system:bridge:diagnostics";

/** diagnostics 协议版本；必须与平台可信父外壳保持一致。 */
export const NOUMI_DIAGNOSTICS_SCHEMA_VERSION = 1;

/** iframe 内最多暂存的错误事件数。 */
export const NOUMI_DIAGNOSTICS_QUEUE_MAX = 50;

/** 单批最多发送的事件数。 */
export const NOUMI_DIAGNOSTICS_BATCH_EVENT_MAX = 10;

/** 单事件 JSON 最大 UTF-8 字节数。 */
export const NOUMI_DIAGNOSTICS_EVENT_MAX_BYTES = 8 * 1024;

/** 单批 JSON 最大 UTF-8 字节数。 */
export const NOUMI_DIAGNOSTICS_BATCH_MAX_BYTES = 32 * 1024;

/** 错误消息最大 UTF-8 字节数。 */
export const NOUMI_DIAGNOSTICS_MESSAGE_MAX_BYTES = 2 * 1024;

/** 原始错误栈最大 UTF-8 字节数。 */
export const NOUMI_DIAGNOSTICS_STACK_MAX_BYTES = 6 * 1024;

/** React component stack 最大 UTF-8 字节数。 */
export const NOUMI_DIAGNOSTICS_COMPONENT_STACK_MAX_BYTES = 4 * 1024;

/** component/operation 最大 UTF-8 字节数。 */
export const NOUMI_DIAGNOSTICS_OPTION_MAX_BYTES = 80;

/** 单个 tag string value 最大 UTF-8 字节数。 */
export const NOUMI_DIAGNOSTICS_TAG_VALUE_MAX_BYTES = 160;

/** 首次错误的批处理等待时间。 */
export const NOUMI_DIAGNOSTICS_INITIAL_FLUSH_MS = 500;

/** 后续错误的最长批处理等待时间。 */
export const NOUMI_DIAGNOSTICS_FOLLOWUP_FLUSH_MS = 5_000;

/** 允许的稳定 tag key。 */
const DIAGNOSTICS_TAG_KEY = /^[a-z][a-z0-9_.-]{0,39}$/;

/** 明确属于浏览器扩展隔离 world 的 URL scheme。 */
const EXTENSION_SCHEME = /^(?:chrome-extension|moz-extension):/i;

/** diagnostics 自动或主动收集的事件类型。 */
export type NoumiClientDiagnosticKind =
	| "runtime_error"
	| "unhandled_rejection"
	| "resource_error"
	| "manual";

/** 公开主动上报接口的低基数分类参数。 */
export type NoumiReportErrorOptions = {
	component?: string;
	operation?: string;
	tags?: Readonly<Record<string, string | number | boolean | null>>;
};

/** iframe 内部统一、可结构化克隆的错误事件。 */
export type NoumiClientDiagnosticEventV1 = {
	schemaVersion: 1;
	clientEventId: string;
	kind: NoumiClientDiagnosticKind;
	observedAt: string;
	name: string | null;
	message: string;
	stack: string | null;
	source: {
		url: string | null;
		line: number | null;
		column: number | null;
	};
	resource: {
		element: "script" | "link" | "img" | "video" | "audio" | "source" | "other";
		url: string | null;
	} | null;
	componentStack: string | null;
	route: string | null;
	component: string | null;
	operation: string | null;
	tags: Readonly<Record<string, string | number | boolean | null>>;
};

/** iframe 发送给父外壳的有界单向批次。 */
export type NoumiDiagnosticsBatchMessageV1 = {
	type: typeof NOUMI_DIAGNOSTICS_MESSAGE;
	version: 1;
	channelId: string;
	batchId: string;
	events: NoumiClientDiagnosticEventV1[];
	droppedCount: number;
};

/** 资源加载错误所需的最小目标结构。 */
export type NoumiResourceErrorTarget = {
	tagName?: unknown;
	src?: unknown;
	href?: unknown;
	currentSrc?: unknown;
};

/** reporter 的运行时依赖，测试可以替换时间和调度器。 */
export type NoumiDiagnosticsReporterDependencies = {
	now(): Date;
	randomId(): string;
	schedule(callback: () => void, delayMs: number): ReturnType<typeof setTimeout>;
	cancel(timer: ReturnType<typeof setTimeout>): void;
	postBatch(message: NoumiDiagnosticsBatchMessageV1): void;
	locationHref(): string;
};

/** 主动上报时仅平台 Error Boundary 可补充的内部字段。 */
type InternalReportOptions = NoumiReportErrorOptions & {
	componentStack?: string | null;
};

/** 规范化错误后的中间字段。 */
type NormalizedError = {
	name: string | null;
	message: string;
	stack: string | null;
};

/** 默认浏览器依赖。 */
function createDefaultDependencies(): NoumiDiagnosticsReporterDependencies {
	return {
		now: () => new Date(),
		randomId: () => crypto.randomUUID(),
		schedule: (callback, delayMs) => setTimeout(callback, delayMs),
		cancel: (timer) => clearTimeout(timer),
		postBatch: (message) => window.parent.postMessage(message, "*"),
		locationHref: () => location.href,
	};
}

/** 计算 UTF-8 字节数。 */
function byteLength(value: string): number {
	return new TextEncoder().encode(value).byteLength;
}

/**
 * 从自由文本中移除 URL query/fragment、credentials 和常见凭据参数值。
 * 该规则只做自动最小化，不把自由文本识别结果当成安全边界；服务端会再次清理。
 */
export function redactSensitiveDiagnosticText(value: string): string {
	const withoutUrls = value.replace(
		/https?:\/\/[^\s<>"']+/gi,
		(rawUrl) => {
			const trailing = rawUrl.match(/[),.;]+$/)?.[0] ?? "";
			const candidate = trailing ? rawUrl.slice(0, -trailing.length) : rawUrl;
			const position = candidate.match(/:(\d+):(\d+)$/);
			const urlText = position
				? candidate.slice(0, -position[0].length)
				: candidate;
			try {
				const url = new URL(urlText);
				const cleaned = `${url.protocol}//${url.host}${url.pathname}`;
				return `${cleaned}${position?.[0] ?? ""}${trailing}`;
			} catch {
				return "[redacted-url]";
			}
		},
	);
	return withoutUrls.replace(
		/\b(token|access_token|api_key|apikey|password|secret)=([^\s&]+)/gi,
		"$1=[redacted]",
	);
}

/**
 * 按 UTF-8 字节上限截断字符串，不切断多字节 code point。
 * @param value 原始字符串
 * @param maxBytes 最大字节数
 * @returns 有界字符串
 */
export function truncateDiagnosticText(value: string, maxBytes: number): string {
	if (byteLength(value) <= maxBytes) return value;
	const encoder = new TextEncoder();
	let result = "";
	for (const character of value) {
		if (encoder.encode(result + character).byteLength > maxBytes) break;
		result += character;
	}
	return result;
}

/** 安全读取 Error 字段；异常 getter 只返回 fallback。 */
function readErrorText(
	error: Error,
	field: "name" | "message" | "stack",
	fallback: string | null,
): string | null {
	try {
		const value = error[field];
		return typeof value === "string" ? value : fallback;
	} catch {
		return fallback;
	}
}

/**
 * 把任意 rejection reason 收敛为不递归读取对象的错误摘要。
 * @param reason 任意异常值
 * @returns 有界错误字段
 */
export function normalizeDiagnosticError(reason: unknown): NormalizedError {
	if (reason instanceof Error) {
		return {
			name: truncateDiagnosticText(
				readErrorText(reason, "name", "Error") ?? "Error",
				160,
			),
			message: truncateDiagnosticText(
				redactSensitiveDiagnosticText(
					readErrorText(reason, "message", "Error") ?? "Error",
				),
				NOUMI_DIAGNOSTICS_MESSAGE_MAX_BYTES,
			),
			stack: (() => {
				const stack = readErrorText(reason, "stack", null);
				return stack
					? truncateDiagnosticText(
						redactSensitiveDiagnosticText(filterExtensionStackFrames(stack)),
						NOUMI_DIAGNOSTICS_STACK_MAX_BYTES,
					) || null
					: null;
			})(),
		};
	}
	if (
		typeof reason === "string" ||
		typeof reason === "number" ||
		typeof reason === "boolean" ||
		typeof reason === "bigint" ||
		reason === null ||
		reason === undefined
	) {
		let message = "Unknown error";
		try {
			message = String(reason);
		} catch {
			// Symbol.toPrimitive 也可能抛错，固定 fallback 避免 reporter 递归失败。
		}
		return {
			name: null,
			message: truncateDiagnosticText(
				redactSensitiveDiagnosticText(message),
				NOUMI_DIAGNOSTICS_MESSAGE_MAX_BYTES,
			),
			stack: null,
		};
	}
	let summary = "[object Object]";
	try {
		const tag = Object.prototype.toString.call(reason);
		summary = /^\[object [A-Za-z0-9 _-]{1,80}\]$/.test(tag)
			? tag
			: "[object Object]";
	} catch {
		// Proxy/getter 异常不继续读取对象内容。
	}
	return { name: null, message: summary, stack: null };
}

/**
 * 清理 URL 中的凭据、query 和 fragment。
 * 同文档 host 只保留逻辑 pathname，外部 URL 只保留 origin。
 */
export function sanitizeDiagnosticUrl(
	value: unknown,
	locationHref: string,
): string | null {
	if (typeof value !== "string" || value.length === 0) return null;
	const trimmed = value.trim();
	if (!trimmed) return null;
	if (EXTENSION_SCHEME.test(trimmed)) return null;
	if (/^(?:data|blob):/i.test(trimmed)) {
		return `${trimmed.slice(0, trimmed.indexOf(":")).toLowerCase()}:`;
	}
	try {
		const current = new URL(locationHref);
		const url = new URL(trimmed, current);
		if (EXTENSION_SCHEME.test(url.protocol)) return null;
		if (url.protocol === "data:" || url.protocol === "blob:") {
			return url.protocol;
		}
		if (!["http:", "https:"].includes(url.protocol)) return url.protocol;
		return url.host === current.host
			? truncateDiagnosticText(url.pathname || "/", 1_024)
			: url.origin;
	} catch {
		return null;
	}
}

/** 删除明确属于扩展 scheme 的 stack frame，不按通用文件名误杀应用代码。 */
export function filterExtensionStackFrames(stack: string): string {
	return stack
		.split("\n")
		.filter((line) => !/(?:chrome-extension|moz-extension):\/\//i.test(line))
		.join("\n");
}

/** 把客户端行列号收敛为正安全整数。 */
function normalizePosition(value: unknown): number | null {
	return Number.isSafeInteger(value) && Number(value) > 0 ? Number(value) : null;
}

/** 清理主动上报 options，忽略对象型 tag value。 */
function normalizeOptions(options: unknown): {
	component: string | null;
	operation: string | null;
	tags: Readonly<Record<string, string | number | boolean | null>>;
} {
	if (!options || typeof options !== "object" || Array.isArray(options)) {
		return { component: null, operation: null, tags: Object.freeze({}) };
	}
	const record = options as Record<string, unknown>;
	const normalizeLabel = (value: unknown) =>
		typeof value === "string"
			? truncateDiagnosticText(value, NOUMI_DIAGNOSTICS_OPTION_MAX_BYTES)
			: null;
	const tags: Record<string, string | number | boolean | null> = {};
	if (record.tags && typeof record.tags === "object" && !Array.isArray(record.tags)) {
		for (const [key, value] of Object.entries(record.tags)) {
			if (Object.keys(tags).length >= 8) break;
			if (!DIAGNOSTICS_TAG_KEY.test(key)) continue;
			if (typeof value === "string") {
				tags[key] = truncateDiagnosticText(
					value,
					NOUMI_DIAGNOSTICS_TAG_VALUE_MAX_BYTES,
				);
			} else if (
				typeof value === "number" && Number.isFinite(value) ||
				typeof value === "boolean" ||
				value === null
			) {
				tags[key] = value as number | boolean | null;
			}
		}
	}
	return {
		component: normalizeLabel(record.component),
		operation: normalizeLabel(record.operation),
		tags: Object.freeze(tags),
	};
}

/** 读取资源元素类型和 URL。 */
function normalizeResource(
	target: NoumiResourceErrorTarget | null,
	locationHref: string,
): NoumiClientDiagnosticEventV1["resource"] {
	if (!target) return null;
	const rawTag = typeof target.tagName === "string"
		? target.tagName.toLowerCase()
		: "other";
	const element = (
		["script", "link", "img", "video", "audio", "source"].includes(rawTag)
			? rawTag
			: "other"
	) as NonNullable<NoumiClientDiagnosticEventV1["resource"]>["element"];
	const rawUrl = typeof target.currentSrc === "string" && target.currentSrc
		? target.currentSrc
		: typeof target.src === "string" && target.src
			? target.src
			: typeof target.href === "string"
				? target.href
				: null;
	return {
		element,
		url: sanitizeDiagnosticUrl(rawUrl, locationHref),
	};
}

/** 生成不含 query/hash 的应用逻辑 route。 */
function currentRoute(locationHref: string): string | null {
	try {
		return truncateDiagnosticText(new URL(locationHref).pathname || "/", 1_024);
	} catch {
		return null;
	}
}

/**
 * iframe 客户端 diagnostics reporter。
 *
 * 所有入口都只做 best-effort 排队；序列化、调度和 postMessage 失败不会向业务代码抛出。
 */
export class NoumiClientDiagnosticsReporter {
	private readonly dependencies: NoumiDiagnosticsReporterDependencies;
	private readonly queue: NoumiClientDiagnosticEventV1[] = [];
	private activeChannelId: string | null = null;
	private droppedCount = 0;
	private timer: ReturnType<typeof setTimeout> | null = null;
	private hasFlushed = false;
	private reporting = false;

	constructor(
		dependencies: Partial<NoumiDiagnosticsReporterDependencies> = {},
	) {
		this.dependencies = { ...createDefaultDependencies(), ...dependencies };
	}

	/** Bridge bootstrap 成功后固定当前 channel，并尝试发送 bootstrap 前积压事件。 */
	setChannel(channelId: string): void {
		if (!channelId || channelId.length > 128) return;
		this.activeChannelId = channelId;
		if (this.queue.length > 0 || this.droppedCount > 0) this.scheduleFlush(0);
	}

	/** 公开主动上报入口；返回 void 且吞掉 reporter 自身错误。 */
	reportError(error: unknown, options?: NoumiReportErrorOptions): void {
		try {
			this.enqueue("manual", error, options ?? {}, null, null);
		} catch {
			// diagnostics 永远不能改变业务 catch 路径。
		}
	}

	/** 仅 starter 平台 Error Boundary 使用，可附带 React component stack。 */
	reportBoundaryError(error: unknown, componentStack: unknown): void {
		try {
			this.enqueue(
				"manual",
				error,
				{},
				null,
				typeof componentStack === "string"
					? truncateDiagnosticText(
						componentStack,
						NOUMI_DIAGNOSTICS_COMPONENT_STACK_MAX_BYTES,
					)
					: null,
			);
		} catch {
			// fallback UI 不能因为诊断失败再次崩溃。
		}
	}

	/** 收集未捕获 runtime ErrorEvent。 */
	captureRuntimeError(input: {
		error: unknown;
		message?: unknown;
		filename?: unknown;
		lineno?: unknown;
		colno?: unknown;
	}): void {
		try {
			const sourceUrl = sanitizeDiagnosticUrl(
				input.filename,
				this.dependencies.locationHref(),
			);
			if (
				typeof input.filename === "string" &&
				EXTENSION_SCHEME.test(input.filename) &&
				!sourceUrl
			) return;
			const fallback =
				input.error === undefined && typeof input.message === "string"
					? input.message
					: input.error;
			this.enqueue("runtime_error", fallback, {}, {
				url: sourceUrl,
				line: normalizePosition(input.lineno),
				column: normalizePosition(input.colno),
			}, null);
		} catch {
			// 原始错误仍由浏览器显示；observer 自身保持静默。
		}
	}

	/** 收集未处理 Promise rejection。 */
	captureUnhandledRejection(reason: unknown): void {
		try {
			this.enqueue("unhandled_rejection", reason, {}, null, null);
		} catch {
			// rejection 处理不调用 preventDefault，也不制造新的 rejection。
		}
	}

	/** 收集 script/link/img 等资源加载错误。 */
	captureResourceError(target: NoumiResourceErrorTarget): void {
		try {
			const locationHref = this.dependencies.locationHref();
			const resource = normalizeResource(target, locationHref);
			const rawUrl = typeof target.currentSrc === "string" && target.currentSrc
				? target.currentSrc
				: typeof target.src === "string" && target.src
					? target.src
					: typeof target.href === "string"
						? target.href
						: null;
			if (typeof rawUrl === "string" && EXTENSION_SCHEME.test(rawUrl)) return;
			this.enqueue(
				"resource_error",
				`Failed to load ${resource?.element ?? "resource"}`,
				{},
				{ url: resource?.url ?? null, line: null, column: null },
				null,
				resource,
			);
		} catch {
			// 资源加载错误仍由浏览器原生处理。
		}
	}

	/** 仅测试/页面隐藏时使用的显式 flush；不会抛出 postMessage 错误。 */
	flush(): void {
		try {
			this.flushInternal();
		} catch {
			// best-effort transport。
		}
	}

	/** 当前有界队列状态，仅测试 Runtime 背压，不暴露到公开 Bridge。 */
	readStateForTest(): { queued: number; droppedCount: number } {
		return { queued: this.queue.length, droppedCount: this.droppedCount };
	}

	/** 规范化并加入有界队列。 */
	private enqueue(
		kind: NoumiClientDiagnosticKind,
		error: unknown,
		options: InternalReportOptions,
		source: NoumiClientDiagnosticEventV1["source"] | null,
		componentStack: string | null,
		resource: NoumiClientDiagnosticEventV1["resource"] = null,
	): void {
		if (this.reporting) return;
		this.reporting = true;
		try {
			if (this.queue.length >= NOUMI_DIAGNOSTICS_QUEUE_MAX) {
				this.droppedCount += 1;
				return;
			}
			const normalized = normalizeDiagnosticError(error);
			const normalizedOptions = normalizeOptions(options);
			const locationHref = this.dependencies.locationHref();
			const event: NoumiClientDiagnosticEventV1 = {
				schemaVersion: NOUMI_DIAGNOSTICS_SCHEMA_VERSION,
				clientEventId: this.dependencies.randomId(),
				kind,
				observedAt: this.dependencies.now().toISOString(),
				name: normalized.name,
				message: normalized.message,
				stack: normalized.stack,
				source: source ?? { url: null, line: null, column: null },
				resource,
				componentStack,
				route: currentRoute(locationHref),
				component: normalizedOptions.component,
				operation: normalizedOptions.operation,
				tags: normalizedOptions.tags,
			};
			if (byteLength(JSON.stringify(event)) > NOUMI_DIAGNOSTICS_EVENT_MAX_BYTES) {
				this.droppedCount += 1;
				return;
			}
			this.queue.push(Object.freeze(event));
			this.scheduleFlush(
				this.hasFlushed
					? NOUMI_DIAGNOSTICS_FOLLOWUP_FLUSH_MS
					: NOUMI_DIAGNOSTICS_INITIAL_FLUSH_MS,
			);
		} finally {
			this.reporting = false;
		}
	}

	/** 同一时刻只保留一个 flush timer。 */
	private scheduleFlush(delayMs: number): void {
		if (this.timer !== null) return;
		this.timer = this.dependencies.schedule(() => {
			this.timer = null;
			this.flush();
		}, delayMs);
	}

	/** 组装不超过事件数和批字节上限的单向消息。 */
	private flushInternal(): void {
		if (!this.activeChannelId) return;
		if (this.timer !== null) {
			this.dependencies.cancel(this.timer);
			this.timer = null;
		}
		while (this.queue.length > 0 || this.droppedCount > 0) {
			const events: NoumiClientDiagnosticEventV1[] = [];
			const batchId = this.dependencies.randomId();
			const droppedCount = this.droppedCount;
			for (
				let index = 0;
				index < NOUMI_DIAGNOSTICS_BATCH_EVENT_MAX && this.queue.length > 0;
				index += 1
			) {
				const candidate = this.queue[0]!;
				const message: NoumiDiagnosticsBatchMessageV1 = {
					type: NOUMI_DIAGNOSTICS_MESSAGE,
					version: NOUMI_DIAGNOSTICS_SCHEMA_VERSION,
					channelId: this.activeChannelId,
					batchId,
					events: [...events, candidate],
					droppedCount,
				};
				if (
					events.length > 0 &&
					byteLength(JSON.stringify(message)) > NOUMI_DIAGNOSTICS_BATCH_MAX_BYTES
				) break;
				events.push(candidate);
				this.queue.shift();
			}
			if (events.length === 0 && droppedCount === 0) break;
			const message: NoumiDiagnosticsBatchMessageV1 = {
				type: NOUMI_DIAGNOSTICS_MESSAGE,
				version: NOUMI_DIAGNOSTICS_SCHEMA_VERSION,
				channelId: this.activeChannelId,
				batchId,
				events,
				droppedCount,
			};
			if (byteLength(JSON.stringify(message)) > NOUMI_DIAGNOSTICS_BATCH_MAX_BYTES) {
				this.droppedCount += events.length;
				continue;
			}
			this.dependencies.postBatch(message);
			this.droppedCount = 0;
			this.hasFlushed = true;
		}
	}
}
