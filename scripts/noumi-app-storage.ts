/** App Storage wire protocol 固定版本。 */
const APP_STORAGE_PROTOCOL_VERSION = 1 as const;

/** transfer response 中的公开对象 metadata。 */
const APP_STORAGE_OBJECT_HEADER = "x-noumi-app-storage-object";

/** transfer response 中的实际 range。 */
const APP_STORAGE_RANGE_HEADER = "x-noumi-app-storage-range";

/** App Storage bootstrap 能力。 */
export type NoumiFileCapabilities = {
	protocolVersion: 1;
	read: boolean;
	write: boolean;
	maxFileBytes: number;
};

/** App Storage 支持的写入内容。 */
export type NoumiFileInput = string | Blob | ArrayBuffer | Uint8Array;

/** 字节范围。 */
export type NoumiFileRange = {
	offset: number;
	length?: number;
};

/** 下载 URL capability。 */
export type NoumiFileDownloadUrl = {
	url: string;
	expiresAt: string;
	etag: string;
};

/** App Storage 对象公开 metadata。 */
export type NoumiAppStorageObject = {
	path: string;
	size: number;
	etag: string;
	contentType: string;
	uploadedAt: string;
	metadata: Readonly<Record<string, string>>;
};

/** App Storage 对象内容。 */
export type NoumiAppStorageFile = NoumiAppStorageObject & {
	body: Blob;
	range: {
		offset: number;
		length: number;
		totalSize: number;
	} | null;
};

/** put 选项。 */
export type NoumiAppStoragePutOptions = {
	contentType?: string;
	metadata?: Readonly<Record<string, string>>;
	ifMatch?: string;
	ifNoneMatch?: boolean;
	signal?: AbortSignal;
};

/** get 选项。 */
export type NoumiAppStorageGetOptions = {
	range?: NoumiFileRange;
	ifMatch?: string;
	signal?: AbortSignal;
};

/** list 选项。 */
export type NoumiAppStorageListOptions = {
	prefix?: string;
	cursor?: string;
	limit?: number;
	groupByDirectory?: boolean;
	signal?: AbortSignal;
};

/** list 分页结果。 */
export type NoumiAppStorageListPage = {
	objects: NoumiAppStorageObject[];
	directories: string[];
	cursor: string | null;
};

/** copy 选项。 */
export type NoumiAppStorageCopyOptions = {
	sourceIfMatch?: string;
	overwrite?: boolean;
	signal?: AbortSignal;
};

/** 下载 URL 选项。 */
export type NoumiFileDownloadUrlOptions = {
	disposition?: "inline" | "attachment";
	fileName?: string;
	signal?: AbortSignal;
};

/** 只承载取消信号的通用请求选项。 */
export type NoumiAppStorageRequestOptions = {
	signal?: AbortSignal;
};

/** 网络、Bridge 或响应协议失败；合法业务错误不使用该类型。 */
export type NoumiFileTransportError = Error & {
	code: "NOUMI_FILE_TRANSPORT";
	requestId: string | null;
	outcome: "not-sent" | "unknown";
};

/** App Storage SDK。 */
export interface NoumiAppStorage {
	readonly capabilities: Readonly<NoumiFileCapabilities>;
	put(
		path: string,
		data: NoumiFileInput,
		options?: NoumiAppStoragePutOptions,
	): Promise<NoumiAppStorageObject>;
	get(
		path: string,
		options?: NoumiAppStorageGetOptions,
	): Promise<NoumiAppStorageFile>;
	head(
		path: string,
		options?: NoumiAppStorageRequestOptions,
	): Promise<NoumiAppStorageObject | null>;
	list(
		options?: NoumiAppStorageListOptions,
	): Promise<NoumiAppStorageListPage>;
	delete(
		path: string,
		options?: NoumiAppStorageRequestOptions,
	): Promise<{ deleted: boolean }>;
	copy(
		sourcePath: string,
		destinationPath: string,
		options?: NoumiAppStorageCopyOptions,
	): Promise<NoumiAppStorageObject>;
	createDownloadUrl(
		path: string,
		options?: NoumiFileDownloadUrlOptions,
	): Promise<NoumiFileDownloadUrl>;
}

/** control transport；可信父外壳负责把请求映射到固定同源 route。 */
export type NoumiAppStorageControlTransport = (
	payload: {
		version: 1;
		operation: string;
		input: Record<string, unknown>;
	},
	options?: NoumiAppStorageRequestOptions,
) => Promise<Response>;

/** 公开 App Storage 业务错误。 */
export class NoumiAppStorageError extends Error {
	/** 稳定错误码。 */
	readonly code: string;
	/** 服务端 request ID。 */
	readonly requestId: string;
	/** 是否允许在确认结果后重试。 */
	readonly retryable: boolean;
	/** 条件冲突时的当前 etag。 */
	readonly currentEtag?: string;

	constructor(input: {
		code: string;
		message: string;
		requestId: string;
		retryable: boolean;
		currentEtag?: string;
	}) {
		super(input.message);
		this.name = "NoumiAppStorageError";
		this.code = input.code;
		this.requestId = input.requestId;
		this.retryable = input.retryable;
		this.currentEtag = input.currentEtag;
	}
}

/** 判断错误是否已经是 App Storage transport error。 */
function isTransportError(error: unknown): error is NoumiFileTransportError {
	return error instanceof Error &&
		(error as Partial<NoumiFileTransportError>).code ===
			"NOUMI_FILE_TRANSPORT";
}

/** 创建 transport error，并保留 Bridge 已知的 request ID 和 outcome。 */
function transportError(
	cause: unknown,
	fallbackOutcome: "not-sent" | "unknown",
): NoumiFileTransportError {
	if (isTransportError(cause)) return cause;
	const source = cause instanceof Error
		? cause as Error & {
			requestId?: unknown;
			outcome?: unknown;
		}
		: null;
	const error = new Error(
		cause instanceof Error
			? cause.message
			: "Noumi App Storage transport failed",
		{ cause },
	) as NoumiFileTransportError;
	error.name = "NoumiFileTransportError";
	error.code = "NOUMI_FILE_TRANSPORT";
	error.requestId = typeof source?.requestId === "string"
		? source.requestId
		: null;
	error.outcome = source?.outcome === "not-sent" ||
			source?.outcome === "unknown"
		? source.outcome
		: fallbackOutcome;
	return error;
}

/** 创建服务端响应协议错误。 */
function invalidTransportResponse(message: string): NoumiFileTransportError {
	return transportError(new Error(message), "unknown");
}

/** 为 response/transfer 阶段的 transport error 补回创建票据的 request ID。 */
function attachTransportRequestId(
	error: unknown,
	requestId: string,
): unknown {
	if (isTransportError(error) && error.requestId === null) {
		error.requestId = requestId;
	}
	return error;
}

/** 为 response/transfer 阶段的 transport error 补回 request ID 后抛出。 */
function throwWithTransportRequestId(
	error: unknown,
	requestId: string,
): never {
	throw attachTransportRequestId(error, requestId);
}

/** 判断普通 record。 */
function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** 冻结公开 metadata，避免调用方误以为修改返回值会更新 provider。 */
function freezeMetadata(
	value: Record<string, string>,
): Readonly<Record<string, string>> {
	return Object.freeze({ ...value });
}

/** 校验并冻结公开对象 metadata。 */
function parseObject(value: unknown): NoumiAppStorageObject {
	if (
		!isRecord(value) ||
		typeof value.path !== "string" ||
		!Number.isSafeInteger(value.size) ||
		Number(value.size) < 0 ||
		typeof value.etag !== "string" ||
		typeof value.contentType !== "string" ||
		typeof value.uploadedAt !== "string" ||
		!isRecord(value.metadata)
	) {
		throw invalidTransportResponse(
			"Noumi App Storage object response is invalid",
		);
	}
	const metadata: Record<string, string> = {};
	for (const [key, entry] of Object.entries(value.metadata)) {
		if (typeof entry !== "string") {
			throw invalidTransportResponse(
				"Noumi App Storage object metadata is invalid",
			);
		}
		metadata[key] = entry;
	}
	return Object.freeze({
		path: value.path,
		size: Number(value.size),
		etag: value.etag,
		contentType: value.contentType,
		uploadedAt: value.uploadedAt,
		metadata: freezeMetadata(metadata),
	});
}

/** 严格解码无 padding base64url JSON header。 */
function decodeHeaderJson(value: string | null): unknown {
	if (!value || !/^[A-Za-z0-9_-]+$/.test(value)) {
		throw invalidTransportResponse(
			"Noumi App Storage transfer metadata is missing",
		);
	}
	try {
		const padded = value.replace(/-/g, "+").replace(/_/g, "/")
			.padEnd(Math.ceil(value.length / 4) * 4, "=");
		const binary = atob(padded);
		const bytes = Uint8Array.from(
			binary,
			(character) => character.charCodeAt(0),
		);
		return JSON.parse(
			new TextDecoder("utf-8", {
				fatal: true,
				ignoreBOM: false,
			}).decode(bytes),
		) as unknown;
	} catch (error) {
		throw transportError(error, "unknown");
	}
}

/** 从统一 failure envelope 抛出稳定业务错误。 */
async function throwResponseError(response: Response): Promise<never> {
	let parsed: unknown;
	try {
		parsed = await response.json();
	} catch (error) {
		throw transportError(error, "unknown");
	}
	const error = isRecord(parsed) && isRecord(parsed.error)
		? parsed.error
		: null;
	if (
		!error ||
		typeof error.code !== "string" ||
		typeof error.message !== "string" ||
		typeof error.requestId !== "string" ||
		typeof error.retryable !== "boolean"
	) {
		throw invalidTransportResponse(
			"Noumi App Storage error response is invalid",
		);
	}
	throw new NoumiAppStorageError({
		code: error.code,
		message: error.message,
		requestId: error.requestId,
		retryable: error.retryable,
		...(typeof error.currentEtag === "string"
			? { currentEtag: error.currentEtag }
			: {}),
	});
}

/** 调用 control route 并返回 data。 */
async function requestControl(
	transport: NoumiAppStorageControlTransport,
	operation: string,
	input: Record<string, unknown>,
	signal?: AbortSignal,
): Promise<{ data: unknown; requestId: string }> {
	if (signal?.aborted) {
		throw transportError(
			signal.reason ?? new DOMException("Aborted", "AbortError"),
			"not-sent",
		);
	}
	let response: Response;
	try {
		response = await transport({
			version: APP_STORAGE_PROTOCOL_VERSION,
			operation,
			input,
		}, { signal });
	} catch (error) {
		throw transportError(error, "unknown");
	}
	if (!response.ok) return throwResponseError(response);
	let parsed: unknown;
	try {
		parsed = await response.json();
	} catch (error) {
		throw transportError(error, "unknown");
	}
	if (
		!isRecord(parsed) ||
		parsed.version !== 1 ||
		parsed.ok !== true ||
		parsed.error !== null ||
		typeof parsed.requestId !== "string" ||
		!("data" in parsed)
	) {
		throw invalidTransportResponse(
			"Noumi App Storage control response is invalid",
		);
	}
	return { data: parsed.data, requestId: parsed.requestId };
}

/** 解析短期 transfer 票据信息。 */
function parseTransfer(value: unknown): {
	url: string;
	expiresAt: string;
} {
	if (
		!isRecord(value) ||
		typeof value.url !== "string" ||
		typeof value.expiresAt !== "string"
	) {
		throw invalidTransportResponse(
			"Noumi App Storage transfer response is invalid",
		);
	}
	let url: URL;
	try {
		url = new URL(value.url);
	} catch (error) {
		throw transportError(error, "unknown");
	}
	if (url.protocol !== "https:" && url.protocol !== "http:") {
		throw invalidTransportResponse(
			"Noumi App Storage transfer URL is invalid",
		);
	}
	return { url: url.href, expiresAt: value.expiresAt };
}

/** 发起二进制 transfer，并区分尚未发送与结果未知。 */
async function requestTransfer(
	transferFetch: typeof fetch,
	url: string,
	init: RequestInit,
	signal?: AbortSignal,
): Promise<Response> {
	if (signal?.aborted) {
		throw transportError(
			signal.reason ?? new DOMException("Aborted", "AbortError"),
			"not-sent",
		);
	}
	try {
		return await transferFetch(url, { ...init, signal });
	} catch (error) {
		throw transportError(error, "unknown");
	}
}

/** mutation recovery 的内部成功标记。 */
type MutationRecoveryAttempt =
	| { recovered: true; data: unknown }
	| { recovered: false };

/**
 * unknown outcome 只查询同一 request ID 的持久化结果。
 * 查询失败时保留原始错误，不使用新 request ID 重放 mutation。
 */
async function recoverUnknownMutation(
	transport: NoumiAppStorageControlTransport,
	error: unknown,
	mutation: "put" | "copy" | "delete",
	path: string,
): Promise<MutationRecoveryAttempt> {
	const requestId = isTransportError(error) && error.outcome === "unknown"
		? error.requestId
		: error instanceof NoumiAppStorageError &&
				error.retryable &&
				error.requestId !== "local"
			? error.requestId
			: null;
	if (!requestId) return { recovered: false };
	try {
		const recovered = await requestControl(
			transport,
			"recoverMutation",
			{
				targetRequestId: requestId,
				mutation,
				path,
			},
		);
		return { recovered: true, data: recovered.data };
	} catch {
		return { recovered: false };
	}
}

/** 完整读取 transfer body；流中断同样属于 unknown transport outcome。 */
async function readTransferBlob(response: Response): Promise<Blob> {
	try {
		return await response.blob();
	} catch (error) {
		throw transportError(error, "unknown");
	}
}

/** 把公共输入归一化为 Blob；文件字节不会进入 Bridge JSON。 */
function createUploadBody(
	data: NoumiFileInput,
	contentType: string | undefined,
): { body: Blob; contentType: string } {
	if (typeof data === "string") {
		const resolvedType = contentType ?? "text/plain; charset=utf-8";
		return { body: new Blob([data], { type: resolvedType }), contentType: resolvedType };
	}
	if (data instanceof Blob) {
		const resolvedType = contentType || data.type || "application/octet-stream";
		return {
			body: data.type === resolvedType
				? data
				: new Blob([data], { type: resolvedType }),
			contentType: resolvedType,
		};
	}
	if (data instanceof ArrayBuffer) {
		const resolvedType = contentType ?? "application/octet-stream";
		return {
			body: new Blob([data.slice(0)], { type: resolvedType }),
			contentType: resolvedType,
		};
	}
	if (data instanceof Uint8Array) {
		const resolvedType = contentType ?? "application/octet-stream";
		const bytes = data.slice();
		return {
			body: new Blob([bytes.buffer], { type: resolvedType }),
			contentType: resolvedType,
		};
	}
	throw new TypeError(
		"Noumi App Storage data must be a string, Blob, ArrayBuffer, or Uint8Array",
	);
}

/** 校验 bootstrap capability。 */
function freezeCapabilities(
	value: NoumiFileCapabilities,
): Readonly<NoumiFileCapabilities> {
	if (
		value.protocolVersion !== 1 ||
		typeof value.read !== "boolean" ||
		typeof value.write !== "boolean" ||
		!Number.isSafeInteger(value.maxFileBytes) ||
		value.maxFileBytes < 1
	) {
		throw new Error("Noumi App Storage capabilities are invalid");
	}
	return Object.freeze({ ...value });
}

/**
 * 创建 App Storage SDK。
 * control 只传公开参数；put/get bytes 使用 credentials=omit 的 ticket data plane。
 */
export function createNoumiAppStorage(
	transport: NoumiAppStorageControlTransport,
	capabilitiesInput: NoumiFileCapabilities,
	transferFetch: typeof fetch = fetch,
): NoumiAppStorage {
	const capabilities = freezeCapabilities(capabilitiesInput);
	return Object.freeze({
		capabilities,
		async put(
			path: string,
			data: NoumiFileInput,
			options: NoumiAppStoragePutOptions = {},
		): Promise<NoumiAppStorageObject> {
			const upload = createUploadBody(data, options.contentType);
			if (upload.body.size > capabilities.maxFileBytes) {
				throw new NoumiAppStorageError({
					code: "NOUMI_APP_STORAGE_LIMIT_EXCEEDED",
					message: "App Storage file exceeds the byte limit",
					requestId: "local",
					retryable: false,
				});
			}
			const control = await requestControl(
				transport,
				"preparePut",
				{
					path,
					size: upload.body.size,
					contentType: upload.contentType,
					metadata: options.metadata ?? {},
					ifMatch: options.ifMatch ?? null,
					ifNoneMatch: options.ifNoneMatch === true,
				},
				options.signal,
			);
			try {
				const transfer = parseTransfer(control.data);
				const response = await requestTransfer(transferFetch, transfer.url, {
					method: "PUT",
					headers: { "content-type": upload.contentType },
					body: upload.body,
					cache: "no-store",
					credentials: "omit",
					redirect: "error",
				}, options.signal);
				if (!response.ok) return throwResponseError(response);
				let parsed: unknown;
				try {
					parsed = await response.json();
				} catch (error) {
					throw transportError(error, "unknown");
				}
				if (
					!isRecord(parsed) ||
					parsed.version !== 1 ||
					parsed.ok !== true
				) {
					throw invalidTransportResponse(
						"Noumi App Storage upload response is invalid",
					);
				}
				return parseObject(parsed.data);
			} catch (error) {
				const failure = attachTransportRequestId(
					error,
					control.requestId,
				);
				const recovered = await recoverUnknownMutation(
					transport,
					failure,
					"put",
					path,
				);
				if (recovered.recovered) {
					try {
						return parseObject(recovered.data);
					} catch {
						// malformed recovery 不能覆盖原始 unknown-outcome 错误。
					}
				}
				throw failure;
			}
		},
		async get(
			path: string,
			options: NoumiAppStorageGetOptions = {},
		): Promise<NoumiAppStorageFile> {
			const control = await requestControl(
				transport,
				"prepareGet",
				{
					path,
					range: options.range ?? null,
					ifMatch: options.ifMatch ?? null,
				},
				options.signal,
			);
			try {
				const transfer = parseTransfer(control.data);
				const response = await requestTransfer(transferFetch, transfer.url, {
					method: "GET",
					cache: "no-store",
					credentials: "omit",
					redirect: "error",
				}, options.signal);
				if (!response.ok) return throwResponseError(response);
				const object = parseObject(
					decodeHeaderJson(response.headers.get(APP_STORAGE_OBJECT_HEADER)),
				);
				const rangeHeader = response.headers.get(APP_STORAGE_RANGE_HEADER);
				const range = rangeHeader ? decodeHeaderJson(rangeHeader) : null;
				if (
					range !== null &&
					(!isRecord(range) ||
						!Number.isSafeInteger(range.offset) ||
						!Number.isSafeInteger(range.length) ||
						!Number.isSafeInteger(range.totalSize))
				) {
					throw invalidTransportResponse(
						"Noumi App Storage range response is invalid",
					);
				}
				return Object.freeze({
					...object,
					body: await readTransferBlob(response),
					range: range === null
						? null
						: {
							offset: Number(range.offset),
							length: Number(range.length),
							totalSize: Number(range.totalSize),
						},
				});
			} catch (error) {
				return throwWithTransportRequestId(error, control.requestId);
			}
		},
		async head(
			path: string,
			options: NoumiAppStorageRequestOptions = {},
		): Promise<NoumiAppStorageObject | null> {
			const { data, requestId } = await requestControl(
				transport,
				"head",
				{ path },
				options.signal,
			);
			try {
				return data === null ? null : parseObject(data);
			} catch (error) {
				return throwWithTransportRequestId(error, requestId);
			}
		},
		async list(
			options: NoumiAppStorageListOptions = {},
		): Promise<NoumiAppStorageListPage> {
			const { data, requestId } = await requestControl(transport, "list", {
				prefix: options.prefix ?? "",
				cursor: options.cursor ?? null,
				limit: options.limit,
				groupByDirectory: options.groupByDirectory === true,
			}, options.signal);
			try {
				if (
					!isRecord(data) ||
					!Array.isArray(data.objects) ||
					!Array.isArray(data.directories) ||
					!data.directories.every((entry) => typeof entry === "string") ||
					(data.cursor !== null && typeof data.cursor !== "string")
				) {
					throw invalidTransportResponse(
						"Noumi App Storage list response is invalid",
					);
				}
				return Object.freeze({
					objects: data.objects.map(parseObject),
					directories: [...data.directories],
					cursor: data.cursor,
				});
			} catch (error) {
				return throwWithTransportRequestId(error, requestId);
			}
		},
		async delete(
			path: string,
			options: NoumiAppStorageRequestOptions = {},
		): Promise<{ deleted: boolean }> {
			let data: unknown;
			let requestId: string;
			let originalFailure: unknown;
			try {
				const control = await requestControl(
					transport,
					"delete",
					{ path },
					options.signal,
				);
				data = control.data;
				requestId = control.requestId;
			} catch (error) {
				const recovered = options.signal?.aborted
					? { recovered: false } as const
					: await recoverUnknownMutation(
						transport,
						error,
						"delete",
						path,
					);
				if (!recovered.recovered) throw error;
				data = recovered.data;
				originalFailure = error;
				requestId = isTransportError(error) && error.requestId
					? error.requestId
					: "recovered";
			}
			try {
				if (!isRecord(data) || typeof data.deleted !== "boolean") {
					throw invalidTransportResponse(
						"Noumi App Storage delete response is invalid",
					);
				}
				return Object.freeze({ deleted: data.deleted });
			} catch (error) {
				if (originalFailure !== undefined) throw originalFailure;
				return throwWithTransportRequestId(error, requestId);
			}
		},
		async copy(
			sourcePath: string,
			destinationPath: string,
			options: NoumiAppStorageCopyOptions = {},
		): Promise<NoumiAppStorageObject> {
			let data: unknown;
			let requestId: string;
			let originalFailure: unknown;
			try {
				const control = await requestControl(transport, "copy", {
					sourcePath,
					destinationPath,
					sourceIfMatch: options.sourceIfMatch ?? null,
					overwrite: options.overwrite === true,
				}, options.signal);
				data = control.data;
				requestId = control.requestId;
			} catch (error) {
				const recovered = options.signal?.aborted
					? { recovered: false } as const
					: await recoverUnknownMutation(
						transport,
						error,
						"copy",
						destinationPath,
					);
				if (!recovered.recovered) throw error;
				data = recovered.data;
				originalFailure = error;
				requestId = isTransportError(error) && error.requestId
					? error.requestId
					: "recovered";
			}
			try {
				return parseObject(data);
			} catch (error) {
				if (originalFailure !== undefined) throw originalFailure;
				return throwWithTransportRequestId(error, requestId);
			}
		},
		async createDownloadUrl(
			path: string,
			options: NoumiFileDownloadUrlOptions = {},
		): Promise<NoumiFileDownloadUrl> {
			const { data, requestId } = await requestControl(
				transport,
				"createDownloadUrl",
				{
					path,
					disposition: options.disposition ?? "attachment",
					fileName: options.fileName ?? null,
				},
				options.signal,
			);
			try {
				const transfer = parseTransfer(data);
				if (!isRecord(data) || typeof data.etag !== "string") {
					throw invalidTransportResponse(
						"Noumi App Storage download URL response is invalid",
					);
				}
				return Object.freeze({ ...transfer, etag: data.etag });
			} catch (error) {
				return throwWithTransportRequestId(error, requestId);
			}
		},
	});
}
