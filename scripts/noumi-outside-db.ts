/** 外部数据库 Browser/Gateway 协议版本。 */
export const NOUMI_OUTSIDE_DB_PROTOCOL_VERSION = 1 as const;

/** SDK 与平台共用的资源边界。 */
export const NOUMI_OUTSIDE_DB_LIMITS = Object.freeze({
	maxSqlBytes: 512 * 1024,
	maxBindings: 1_000,
	minTimeoutMs: 100,
	maxTimeoutMs: 60_000,
	defaultTimeoutMs: 15_000,
});

/** 外部数据库可用性快照；真正权限和 grant 仍由服务端逐请求复核。 */
export type NoumiOutsideDbCapabilities = {
	protocolVersion: typeof NOUMI_OUTSIDE_DB_PROTOCOL_VERSION;
	available: boolean;
	driver: "POSTGRESQL";
};

/** 可作为单个 JSON binding 传输的值。 */
export type NoumiOutsideDbJson =
	| null
	| boolean
	| number
	| string
	| NoumiOutsideDbJson[]
	| { [key: string]: NoumiOutsideDbJson };

/** 保留精度和二进制语义的稳定值。 */
export type NoumiOutsideDbTaggedValue =
	| { $noumiType: "bigint"; value: string }
	| { $noumiType: "decimal"; value: string }
	| { $noumiType: "bytes"; value: string }
	| { $noumiType: "date"; value: string }
	| { $noumiType: "json"; value: NoumiOutsideDbJson };

/** `.sql()` 可接受的单个 binding。 */
export type NoumiOutsideDbInputValue =
	| null
	| boolean
	| number
	| string
	| bigint
	| Date
	| Uint8Array
	| NoumiOutsideDbJson[]
	| { [key: string]: NoumiOutsideDbJson }
	| NoumiOutsideDbTaggedValue;

/** 外部数据库返回值。 */
export type NoumiOutsideDbValue =
	| NoumiOutsideDbJson
	| Exclude<NoumiOutsideDbTaggedValue, { $noumiType: "json" }>;

/** 默认外部数据库行形状。 */
export type NoumiOutsideDbRow = Record<string, NoumiOutsideDbValue>;

/** 一条 statement 的规范化结果。 */
export type NoumiOutsideDbStatementResult<
	Row extends NoumiOutsideDbRow = NoumiOutsideDbRow,
> = {
	command: string | null;
	rowCount: number | null;
	rows: Row[];
};

/** 单次 SQL 调用选项。 */
export type NoumiOutsideDbSqlOptions = {
	/** 100ms 到 60s；默认 15s。 */
	timeoutMs?: number;
	/** 客户端停止等待并发送 best-effort cancel。 */
	signal?: AbortSignal;
};

/** 外部数据库成功结果。 */
export type NoumiOutsideDbSuccess<
	Row extends NoumiOutsideDbRow = NoumiOutsideDbRow,
> = {
	version: typeof NOUMI_OUTSIDE_DB_PROTOCOL_VERSION;
	ok: true;
	data: {
		results: NoumiOutsideDbStatementResult<Row>[];
	};
	error: null;
	executionId: string;
};

/** 外部数据库失败结果。 */
export type NoumiOutsideDbFailure = {
	version: typeof NOUMI_OUTSIDE_DB_PROTOCOL_VERSION;
	ok: false;
	data: null;
	error: {
		code: string;
		message: string;
		requestId: string;
		retryable: boolean;
		outcome?: "not-sent" | "unknown";
	};
	executionId: string | null;
};

/** `.sql()` 的可判别结果。 */
export type NoumiOutsideDbResult<
	Row extends NoumiOutsideDbRow = NoumiOutsideDbRow,
> = NoumiOutsideDbSuccess<Row> | NoumiOutsideDbFailure;

/** 单条用户私有外部数据库引用。 */
export interface NoumiOutsideDatabase {
	/**
	 * 在目标数据库原生语义下执行完整 SQL。
	 * 单次调用固定一条物理连接；跨调用 transaction 不受支持。
	 */
	sql<Row extends NoumiOutsideDbRow = NoumiOutsideDbRow>(
		sqlText: string,
		bindings?: readonly NoumiOutsideDbInputValue[],
		options?: NoumiOutsideDbSqlOptions,
	): Promise<NoumiOutsideDbResult<Row>>;
}

/** `NoumiBridge.outsideDb` 的可调用入口。 */
export interface NoumiOutsideDbFactory {
	(slug: string): NoumiOutsideDatabase;
	readonly capabilities: NoumiOutsideDbCapabilities;
}

/** Bridge transport 使用的结构化 HTTP 响应。 */
export type NoumiOutsideDbTransportResponse = {
	status: number;
	headers: Array<[string, string]>;
	body: string;
};

/** iframe 到可信父外壳的最小 transport。 */
export type NoumiOutsideDbTransport = (
	request: {
		version: typeof NOUMI_OUTSIDE_DB_PROTOCOL_VERSION;
		slug: string;
		sql: string;
		bindings: Array<
			null | boolean | number | string | NoumiOutsideDbTaggedValue
		>;
		options: { timeoutMs: number };
	},
	options?: { signal?: AbortSignal; timeoutMs: number },
) => Promise<NoumiOutsideDbTransportResponse>;

/** Bridge/网络/响应协议故障；SQL 是否已发送通过 outcome 表达。 */
export class NoumiOutsideDbTransportError extends Error {
	readonly requestId: string | null;
	readonly outcome: "not-sent" | "unknown";

	constructor(
		message: string,
		options?: {
			requestId?: string | null;
			outcome?: "not-sent" | "unknown";
			cause?: unknown;
		},
	) {
		super(message, { cause: options?.cause });
		this.name = "NoumiOutsideDbTransportError";
		this.requestId = options?.requestId ?? null;
		this.outcome = options?.outcome ?? "unknown";
	}
}

const encoder = new TextEncoder();
const SLUG_PATTERN = /^[a-z][a-z0-9-]{0,62}$/u;

/** 判断普通 object。 */
function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** 规范化连接 slug；它只在当前用户和 Project 中唯一。 */
export function normalizeNoumiOutsideDbSlug(value: unknown): string {
	if (typeof value !== "string") {
		throw new TypeError("External database slug must be a string");
	}
	const slug = value.trim().toLowerCase();
	if (!SLUG_PATTERN.test(slug)) {
		throw new TypeError(
			"External database slug must start with a letter and contain only lowercase letters, numbers, or hyphens",
		);
	}
	return slug;
}

/** 递归验证可传输 JSON。 */
function normalizeJson(value: unknown, depth = 0): NoumiOutsideDbJson {
	if (depth > 32) throw new TypeError("External database JSON binding is too deep");
	if (
		value === null ||
		typeof value === "boolean" ||
		typeof value === "string"
	) {
		return value;
	}
	if (typeof value === "number") {
		if (!Number.isFinite(value)) {
			throw new TypeError("External database numeric binding must be finite");
		}
		return value;
	}
	if (Array.isArray(value)) {
		return value.map((item) => normalizeJson(item, depth + 1));
	}
	if (isRecord(value)) {
		return Object.fromEntries(
			Object.entries(value).map(([key, item]) => [
				key,
				normalizeJson(item, depth + 1),
			]),
		);
	}
	throw new TypeError("External database JSON binding is invalid");
}

/** 浏览器兼容的 base64 编码。 */
function encodeBytes(value: Uint8Array): string {
	let binary = "";
	for (const byte of value) binary += String.fromCharCode(byte);
	return btoa(binary);
}

/** 把公开 binding 编码为 JSON-safe wire 值。 */
export function encodeNoumiOutsideDbBinding(
	value: NoumiOutsideDbInputValue,
): null | boolean | number | string | NoumiOutsideDbTaggedValue {
	if (
		value === null ||
		typeof value === "boolean" ||
		typeof value === "string"
	) {
		return value;
	}
	if (typeof value === "number") {
		if (!Number.isFinite(value)) {
			throw new TypeError("External database numeric binding must be finite");
		}
		return value;
	}
	if (typeof value === "bigint") {
		return { $noumiType: "bigint", value: value.toString() };
	}
	if (value instanceof Date) {
		if (Number.isNaN(value.getTime())) {
			throw new TypeError("External database date binding is invalid");
		}
		return { $noumiType: "date", value: value.toISOString() };
	}
	if (value instanceof Uint8Array) {
		return { $noumiType: "bytes", value: encodeBytes(value) };
	}
	if (isRecord(value) && typeof value.$noumiType === "string") {
		if (
			value.$noumiType === "bigint" &&
			typeof value.value === "string" &&
			/^-?(?:0|[1-9]\d*)$/u.test(value.value)
		) {
			return { $noumiType: "bigint", value: value.value };
		}
		if (
			value.$noumiType === "decimal" &&
			typeof value.value === "string" &&
			/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/u.test(value.value)
		) {
			return { $noumiType: "decimal", value: value.value };
		}
		if (
			value.$noumiType === "bytes" &&
			typeof value.value === "string"
		) {
			return { $noumiType: "bytes", value: value.value };
		}
		if (
			value.$noumiType === "date" &&
			typeof value.value === "string" &&
			!Number.isNaN(Date.parse(value.value))
		) {
			return { $noumiType: "date", value: value.value };
		}
		if (value.$noumiType === "json") {
			return { $noumiType: "json", value: normalizeJson(value.value) };
		}
		throw new TypeError("External database tagged binding is invalid");
	}
	return { $noumiType: "json", value: normalizeJson(value) };
}

/** 校验结果中的稳定值。 */
function isResultValue(value: unknown, depth = 0): boolean {
	if (depth > 32) return false;
	if (
		value === null ||
		typeof value === "boolean" ||
		typeof value === "string" ||
		(typeof value === "number" && Number.isFinite(value))
	) {
		return true;
	}
	if (Array.isArray(value)) {
		return value.every((item) => isResultValue(item, depth + 1));
	}
	if (!isRecord(value)) return false;
	if (typeof value.$noumiType === "string") {
		return ["bigint", "decimal", "bytes", "date"].includes(value.$noumiType) &&
			typeof value.value === "string";
	}
	return Object.values(value).every((item) => isResultValue(item, depth + 1));
}

/** 校验 Gateway success/failure envelope。 */
function parseResult<Row extends NoumiOutsideDbRow>(
	value: unknown,
): NoumiOutsideDbResult<Row> {
	if (!isRecord(value) || value.version !== NOUMI_OUTSIDE_DB_PROTOCOL_VERSION) {
		throw new NoumiOutsideDbTransportError(
			"External database response protocol is invalid",
		);
	}
	if (value.ok === false) {
		if (
			value.data !== null ||
			!isRecord(value.error) ||
			typeof value.error.code !== "string" ||
			typeof value.error.message !== "string" ||
			typeof value.error.requestId !== "string" ||
			typeof value.error.retryable !== "boolean" ||
			(value.error.outcome !== undefined &&
				value.error.outcome !== "not-sent" &&
				value.error.outcome !== "unknown") ||
			(value.executionId !== null &&
				typeof value.executionId !== "string")
		) {
			throw new NoumiOutsideDbTransportError(
				"External database failure response is invalid",
			);
		}
		return value as unknown as NoumiOutsideDbFailure;
	}
	if (
		value.ok !== true ||
		value.error !== null ||
		typeof value.executionId !== "string" ||
		!isRecord(value.data) ||
		!Array.isArray(value.data.results)
	) {
		throw new NoumiOutsideDbTransportError(
			"External database success response is invalid",
		);
	}
	for (const result of value.data.results) {
		if (
			!isRecord(result) ||
			(result.command !== null && typeof result.command !== "string") ||
			(result.rowCount !== null &&
				(!Number.isSafeInteger(result.rowCount) ||
					Number(result.rowCount) < 0)) ||
			!Array.isArray(result.rows) ||
			!result.rows.every((row) =>
				isRecord(row) &&
				Object.values(row).every((item) => isResultValue(item))
			)
		) {
			throw new NoumiOutsideDbTransportError(
				"External database result rows are invalid",
			);
		}
	}
	return value as unknown as NoumiOutsideDbSuccess<Row>;
}

/** 创建只依赖可信 Bridge transport 的外部数据库 SDK。 */
export function createNoumiOutsideDb(
	transport: NoumiOutsideDbTransport,
	capabilities: NoumiOutsideDbCapabilities,
): NoumiOutsideDbFactory {
	const frozenCapabilities = Object.freeze({ ...capabilities });
	const factory = ((rawSlug: string): NoumiOutsideDatabase => {
		const slug = normalizeNoumiOutsideDbSlug(rawSlug);
		return Object.freeze({
			async sql<Row extends NoumiOutsideDbRow = NoumiOutsideDbRow>(
				sqlText: string,
				bindings: readonly NoumiOutsideDbInputValue[] = [],
				options: NoumiOutsideDbSqlOptions = {},
			): Promise<NoumiOutsideDbResult<Row>> {
				if (typeof sqlText !== "string") {
					throw new TypeError("External database SQL must be a string");
				}
				const sqlBytes = encoder.encode(sqlText).byteLength;
				if (sqlBytes < 1 || sqlBytes > NOUMI_OUTSIDE_DB_LIMITS.maxSqlBytes) {
					throw new TypeError(
						"External database SQL exceeds the configured limit",
					);
				}
				if (
					!Array.isArray(bindings) ||
					bindings.length > NOUMI_OUTSIDE_DB_LIMITS.maxBindings
				) {
					throw new TypeError(
						"External database bindings exceed the configured limit",
					);
				}
				const timeoutMs =
					options.timeoutMs ?? NOUMI_OUTSIDE_DB_LIMITS.defaultTimeoutMs;
				if (
					!Number.isSafeInteger(timeoutMs) ||
					timeoutMs < NOUMI_OUTSIDE_DB_LIMITS.minTimeoutMs ||
					timeoutMs > NOUMI_OUTSIDE_DB_LIMITS.maxTimeoutMs
				) {
					throw new TypeError("External database timeout is invalid");
				}
				if (!frozenCapabilities.available) {
					const requestId = crypto.randomUUID();
					return {
						version: NOUMI_OUTSIDE_DB_PROTOCOL_VERSION,
						ok: false,
						data: null,
						error: {
							code: "NOUMI_OUTSIDE_DB_UNAVAILABLE",
							message: "External database service is unavailable",
							requestId,
							retryable: true,
							outcome: "not-sent",
						},
						executionId: null,
					};
				}
				let response: NoumiOutsideDbTransportResponse;
				try {
					response = await transport(
						{
							version: NOUMI_OUTSIDE_DB_PROTOCOL_VERSION,
							slug,
							sql: sqlText,
							bindings: bindings.map(encodeNoumiOutsideDbBinding),
							options: { timeoutMs },
						},
						{
							signal: options.signal,
							timeoutMs,
						},
					);
				} catch (error) {
					if (error instanceof NoumiOutsideDbTransportError) throw error;
					const details = isRecord(error) ? error : {};
					throw new NoumiOutsideDbTransportError(
						error instanceof Error
							? error.message
							: "External database Bridge transport failed",
						{
							requestId: typeof details.requestId === "string"
								? details.requestId
								: null,
							outcome: details.outcome === "not-sent"
								? "not-sent"
								: "unknown",
							cause: error,
						},
					);
				}
				const contentType = response.headers.find(
					([name]) => name.toLowerCase() === "content-type",
				)?.[1];
				if (
					!Number.isInteger(response.status) ||
					response.status < 100 ||
					response.status > 599 ||
					!contentType?.toLowerCase().startsWith("application/json")
				) {
					throw new NoumiOutsideDbTransportError(
						"External database Bridge response is invalid",
					);
				}
				let body: unknown;
				try {
					body = JSON.parse(response.body);
				} catch (error) {
					throw new NoumiOutsideDbTransportError(
						"External database response is not valid JSON",
						{ cause: error },
					);
				}
				return parseResult<Row>(body);
			},
		});
	}) as NoumiOutsideDbFactory;
	Object.defineProperty(factory, "capabilities", {
		value: frozenCapabilities,
		writable: false,
		configurable: false,
		enumerable: true,
	});
	return Object.freeze(factory);
}
