import type {
	NoumiFileCapabilities,
	NoumiFileDownloadUrl,
	NoumiFileDownloadUrlOptions,
	NoumiFileInput,
	NoumiFileRange,
	NoumiFileTransportError,
} from "./noumi-app-storage";

/** Workspace Files wire protocol 固定版本。 */
const WORKSPACE_FILES_PROTOCOL_VERSION = 1 as const;

/** transfer response 中的公开 Workspace entry。 */
const WORKSPACE_FILES_ENTRY_HEADER = "x-noumi-workspace-entry";

/** transfer response 中的实际 range。 */
const WORKSPACE_FILES_RANGE_HEADER = "x-noumi-workspace-range";

/** Workspace 中的公开文件或目录。 */
export type NoumiWorkspaceEntry = {
	id: string;
	path: string;
	name: string;
	type: "file" | "directory";
	size: number | null;
	etag: string | null;
	contentType: string | null;
	modifiedAt: string;
};

/** Workspace 二进制文件内容。 */
export type NoumiWorkspaceFile = {
	entry: NoumiWorkspaceEntry & { type: "file"; etag: string };
	body: Blob;
	range: {
		offset: number;
		length: number;
		totalSize: number;
	} | null;
};

/** Workspace UTF-8 文本内容。 */
export type NoumiWorkspaceTextFile = {
	entry: NoumiWorkspaceEntry & { type: "file"; etag: string };
	text: string;
};

/** Workspace 文件读取选项。 */
export type NoumiWorkspaceReadOptions = {
	range?: NoumiFileRange;
	ifMatch?: string;
	expectedNodeId?: string;
	signal?: AbortSignal;
};

/** Workspace UTF-8 文本读取选项。 */
export type NoumiWorkspaceTextReadOptions =
	Omit<NoumiWorkspaceReadOptions, "range">;

/** Workspace 目录分页选项。 */
export type NoumiWorkspaceListOptions = {
	cursor?: string;
	limit?: number;
	signal?: AbortSignal;
};

/** Workspace 目录分页结果。 */
export type NoumiWorkspaceListPage = {
	entries: NoumiWorkspaceEntry[];
	cursor: string | null;
};

/** Workspace 完整文件写入选项。 */
export type NoumiWorkspaceWriteOptions = {
	contentType?: string;
	overwrite?: boolean;
	ifMatch?: string;
	expectedNodeId?: string;
	signal?: AbortSignal;
};

/** Workspace 目录创建选项。 */
export type NoumiWorkspaceCreateDirectoryOptions = {
	recursive?: boolean;
	signal?: AbortSignal;
};

/** Workspace move 选项。 */
export type NoumiWorkspaceMoveOptions = {
	overwrite?: boolean;
	sourceIfMatch?: string;
	expectedSourceNodeId?: string;
	signal?: AbortSignal;
};

/** Workspace copy 选项。 */
export type NoumiWorkspaceCopyOptions = NoumiWorkspaceMoveOptions;

/** Workspace remove 选项。 */
export type NoumiWorkspaceRemoveOptions = {
	recursive?: boolean;
	ifMatch?: string;
	expectedNodeId?: string;
	signal?: AbortSignal;
};

/** Workspace remove 结果。 */
export type NoumiWorkspaceRemoveResult = {
	path: string;
	removedNodeCount: number;
};

/** Workspace 下载 URL 选项。 */
export type NoumiWorkspaceDownloadUrlOptions =
	NoumiFileDownloadUrlOptions & {
		ifMatch?: string;
		expectedNodeId?: string;
	};

/** 只承载 AbortSignal 的 Workspace 请求选项。 */
export type NoumiWorkspaceRequestOptions = {
	signal?: AbortSignal;
};

/** Workspace Files SDK。 */
export interface NoumiWorkspaceFiles {
	readonly capabilities: Readonly<NoumiFileCapabilities>;
	stat(
		path: string,
		options?: NoumiWorkspaceRequestOptions,
	): Promise<NoumiWorkspaceEntry | null>;
	listDirectory(
		path?: string,
		options?: NoumiWorkspaceListOptions,
	): Promise<NoumiWorkspaceListPage>;
	readFile(
		path: string,
		options?: NoumiWorkspaceReadOptions,
	): Promise<NoumiWorkspaceFile>;
	readTextFile(
		path: string,
		options?: NoumiWorkspaceTextReadOptions,
	): Promise<NoumiWorkspaceTextFile>;
	writeFile(
		path: string,
		data: NoumiFileInput,
		options?: NoumiWorkspaceWriteOptions,
	): Promise<NoumiWorkspaceEntry>;
	createDirectory(
		path: string,
		options?: NoumiWorkspaceCreateDirectoryOptions,
	): Promise<NoumiWorkspaceEntry>;
	move(
		sourcePath: string,
		destinationPath: string,
		options?: NoumiWorkspaceMoveOptions,
	): Promise<NoumiWorkspaceEntry>;
	copy(
		sourcePath: string,
		destinationPath: string,
		options?: NoumiWorkspaceCopyOptions,
	): Promise<NoumiWorkspaceEntry>;
	remove(
		path: string,
		options?: NoumiWorkspaceRemoveOptions,
	): Promise<NoumiWorkspaceRemoveResult>;
	createDownloadUrl(
		path: string,
		options?: NoumiWorkspaceDownloadUrlOptions,
	): Promise<NoumiFileDownloadUrl>;
}

/** control transport；可信父外壳负责映射到固定同源 route。 */
export type NoumiWorkspaceFilesControlTransport = (
	payload: {
		version: 1;
		operation: string;
		input: Record<string, unknown>;
	},
	options?: NoumiWorkspaceRequestOptions,
) => Promise<Response>;

/** Workspace Files 稳定业务错误。 */
export class NoumiWorkspaceFilesError extends Error {
	readonly code: string;
	readonly requestId: string;
	readonly retryable: boolean;
	readonly currentEtag?: string;

	constructor(input: {
		code: string;
		message: string;
		requestId: string;
		retryable: boolean;
		currentEtag?: string;
	}) {
		super(input.message);
		this.name = "NoumiWorkspaceFilesError";
		this.code = input.code;
		this.requestId = input.requestId;
		this.retryable = input.retryable;
		this.currentEtag = input.currentEtag;
	}
}

/** 判断普通 record。 */
function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** 判断错误是否已经是共享文件 transport error。 */
function isTransportError(error: unknown): error is NoumiFileTransportError {
	return error instanceof Error &&
		(error as Partial<NoumiFileTransportError>).code ===
			"NOUMI_FILE_TRANSPORT";
}

/** 创建共享 transport error，并保留 Bridge request ID/outcome。 */
function transportError(
	cause: unknown,
	fallbackOutcome: "not-sent" | "unknown",
): NoumiFileTransportError {
	if (isTransportError(cause)) return cause;
	const source = cause instanceof Error
		? cause as Error & { requestId?: unknown; outcome?: unknown }
		: null;
	const error = new Error(
		cause instanceof Error
			? cause.message
			: "Noumi Workspace Files transport failed",
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

/** 创建响应协议错误。 */
function invalidTransportResponse(message: string): NoumiFileTransportError {
	return transportError(new Error(message), "unknown");
}

/** 为 transfer 阶段错误补回创建 ticket 的 request ID。 */
function attachTransportRequestId(
	error: unknown,
	requestId: string,
): unknown {
	if (isTransportError(error) && error.requestId === null) {
		error.requestId = requestId;
	}
	return error;
}

/** 补回 request ID 后抛出 transport 错误。 */
function throwWithTransportRequestId(
	error: unknown,
	requestId: string,
): never {
	throw attachTransportRequestId(error, requestId);
}

/** 校验并冻结公开 Workspace entry。 */
function parseEntry(value: unknown): NoumiWorkspaceEntry {
	if (
		!isRecord(value) ||
		typeof value.id !== "string" ||
		typeof value.path !== "string" ||
		typeof value.name !== "string" ||
		(value.type !== "file" && value.type !== "directory") ||
		(value.size !== null &&
			(!Number.isSafeInteger(value.size) || Number(value.size) < 0)) ||
		(value.etag !== null && typeof value.etag !== "string") ||
		(value.contentType !== null &&
			typeof value.contentType !== "string") ||
		typeof value.modifiedAt !== "string"
	) {
		throw invalidTransportResponse(
			"Noumi Workspace entry response is invalid",
		);
	}
	if (
		(value.type === "directory" &&
			(value.size !== null ||
				value.etag !== null ||
				value.contentType !== null)) ||
		(value.type === "file" && value.size === null)
	) {
		throw invalidTransportResponse(
			"Noumi Workspace entry shape is invalid",
		);
	}
	return Object.freeze({
		id: value.id,
		path: value.path,
		name: value.name,
		type: value.type,
		size: value.size === null ? null : Number(value.size),
		etag: value.etag,
		contentType: value.contentType,
		modifiedAt: value.modifiedAt,
	});
}

/** 文件读取结果要求非空 etag。 */
function parseFileEntry(
	value: unknown,
): NoumiWorkspaceEntry & { type: "file"; etag: string } {
	const entry = parseEntry(value);
	if (entry.type !== "file" || !entry.etag) {
		throw invalidTransportResponse(
			"Noumi Workspace file entry response is invalid",
		);
	}
	return entry as NoumiWorkspaceEntry & {
		type: "file";
		etag: string;
	};
}

/** 严格解码无 padding base64url JSON header。 */
function decodeHeaderJson(value: string | null): unknown {
	if (!value || !/^[A-Za-z0-9_-]+$/.test(value)) {
		throw invalidTransportResponse(
			"Noumi Workspace transfer metadata is missing",
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
			"Noumi Workspace error response is invalid",
		);
	}
	throw new NoumiWorkspaceFilesError({
		code: error.code,
		message: error.message,
		requestId: error.requestId,
		retryable: error.retryable,
		...(typeof error.currentEtag === "string"
			? { currentEtag: error.currentEtag }
			: {}),
	});
}

/** 调用 control route 并返回 data/request ID。 */
async function requestControl(
	transport: NoumiWorkspaceFilesControlTransport,
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
			version: WORKSPACE_FILES_PROTOCOL_VERSION,
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
			"Noumi Workspace control response is invalid",
		);
	}
	return { data: parsed.data, requestId: parsed.requestId };
}

/** 解析短期 transfer ticket。 */
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
			"Noumi Workspace transfer response is invalid",
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
			"Noumi Workspace transfer URL is invalid",
		);
	}
	return { url: url.href, expiresAt: value.expiresAt };
}

/** 发起二进制 transfer。 */
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

/** 把公共输入归一化为 Blob；文件 bytes 不进入 Bridge JSON。 */
function createUploadBody(
	data: NoumiFileInput,
	contentType: string | undefined,
): { body: Blob; contentType: string } {
	if (typeof data === "string") {
		const resolvedType = contentType ?? "text/plain; charset=utf-8";
		return {
			body: new Blob([data], { type: resolvedType }),
			contentType: resolvedType,
		};
	}
	if (data instanceof Blob) {
		const resolvedType =
			contentType || data.type || "application/octet-stream";
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
		"Noumi Workspace data must be a string, Blob, ArrayBuffer, or Uint8Array",
	);
}

/** 完整读取 transfer body；流中断属于 unknown outcome。 */
async function readTransferBlob(response: Response): Promise<Blob> {
	try {
		return await response.blob();
	} catch (error) {
		throw transportError(error, "unknown");
	}
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
		throw new Error("Noumi Workspace capabilities are invalid");
	}
	return Object.freeze({ ...value });
}

/** mutation recovery 的内部成功标记。 */
type MutationRecoveryAttempt =
	| { recovered: true; data: unknown }
	| { recovered: false };

/** unknown outcome 只查询同一 request ID，不重放 mutation。 */
async function recoverUnknownMutation(
	transport: NoumiWorkspaceFilesControlTransport,
	error: unknown,
	mutation:
		| "write"
		| "createDirectory"
		| "move"
		| "copy"
		| "remove",
	path: string,
	targetPath: string | null,
): Promise<MutationRecoveryAttempt> {
	const requestId = isTransportError(error) && error.outcome === "unknown"
		? error.requestId
		: error instanceof NoumiWorkspaceFilesError &&
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
				targetPath,
			},
		);
		return { recovered: true, data: recovered.data };
	} catch {
		return { recovered: false };
	}
}

/** 执行 control mutation，并在结果未知时只恢复原 request ID。 */
async function requestMutation(
	transport: NoumiWorkspaceFilesControlTransport,
	operation: "createDirectory" | "move" | "copy" | "remove",
	input: Record<string, unknown>,
	path: string,
	targetPath: string | null,
	signal?: AbortSignal,
): Promise<{ data: unknown; requestId: string }> {
	try {
		return await requestControl(transport, operation, input, signal);
	} catch (error) {
		const recovered = signal?.aborted
			? { recovered: false } as const
			: await recoverUnknownMutation(
				transport,
				error,
				operation,
				path,
				targetPath,
			);
		if (!recovered.recovered) throw error;
		const requestId = isTransportError(error) && error.requestId
			? error.requestId
			: error instanceof NoumiWorkspaceFilesError
				? error.requestId
				: "unknown";
		return { data: recovered.data, requestId };
	}
}

/** 创建 Noumi Workspace Files SDK。 */
export function createNoumiWorkspaceFiles(
	transport: NoumiWorkspaceFilesControlTransport,
	capabilitiesInput: NoumiFileCapabilities,
	transferFetch: typeof fetch = fetch,
): NoumiWorkspaceFiles {
	const capabilities = freezeCapabilities(capabilitiesInput);
	const readFile = async (
		path: string,
		options: NoumiWorkspaceReadOptions = {},
	): Promise<NoumiWorkspaceFile> => {
		const control = await requestControl(
			transport,
			"prepareRead",
			{
				path,
				range: options.range ?? null,
				ifMatch: options.ifMatch ?? null,
				expectedNodeId: options.expectedNodeId ?? null,
			},
			options.signal,
		);
		try {
			const transfer = parseTransfer(control.data);
			const response = await requestTransfer(
				transferFetch,
				transfer.url,
				{
					method: "GET",
					cache: "no-store",
					credentials: "omit",
					redirect: "error",
				},
				options.signal,
			);
			if (!response.ok) return throwResponseError(response);
			const entry = parseFileEntry(
				decodeHeaderJson(
					response.headers.get(WORKSPACE_FILES_ENTRY_HEADER),
				),
			);
			const encodedRange =
				response.headers.get(WORKSPACE_FILES_RANGE_HEADER);
			const parsedRange = encodedRange
				? decodeHeaderJson(encodedRange)
				: null;
			if (
				parsedRange !== null &&
				(!isRecord(parsedRange) ||
					!Number.isSafeInteger(parsedRange.offset) ||
					!Number.isSafeInteger(parsedRange.length) ||
					!Number.isSafeInteger(parsedRange.totalSize))
			) {
				throw invalidTransportResponse(
					"Noumi Workspace range response is invalid",
				);
			}
			return Object.freeze({
				entry,
				body: await readTransferBlob(response),
				range: parsedRange === null
					? null
					: {
						offset: Number(parsedRange.offset),
						length: Number(parsedRange.length),
						totalSize: Number(parsedRange.totalSize),
					},
			});
		} catch (error) {
			return throwWithTransportRequestId(error, control.requestId);
		}
	};
	return Object.freeze({
		capabilities,
		async stat(
			path: string,
			options: NoumiWorkspaceRequestOptions = {},
		): Promise<NoumiWorkspaceEntry | null> {
			const { data, requestId } = await requestControl(
				transport,
				"stat",
				{ path },
				options.signal,
			);
			try {
				return data === null ? null : parseEntry(data);
			} catch (error) {
				return throwWithTransportRequestId(error, requestId);
			}
		},
		async listDirectory(
			path = "",
			options: NoumiWorkspaceListOptions = {},
		): Promise<NoumiWorkspaceListPage> {
			const { data, requestId } = await requestControl(
				transport,
				"listDirectory",
				{
					path,
					cursor: options.cursor ?? null,
					limit: options.limit,
				},
				options.signal,
			);
			try {
				if (
					!isRecord(data) ||
					!Array.isArray(data.entries) ||
					(data.cursor !== null &&
						typeof data.cursor !== "string")
				) {
					throw invalidTransportResponse(
						"Noumi Workspace list response is invalid",
					);
				}
				return Object.freeze({
					entries: data.entries.map(parseEntry),
					cursor: data.cursor,
				});
			} catch (error) {
				return throwWithTransportRequestId(error, requestId);
			}
		},
		readFile,
		async readTextFile(
			path: string,
			options: NoumiWorkspaceTextReadOptions = {},
		): Promise<NoumiWorkspaceTextFile> {
			const file = await readFile(path, options);
			try {
				const text = new TextDecoder("utf-8", {
					fatal: true,
					ignoreBOM: false,
				}).decode(await file.body.arrayBuffer());
				return Object.freeze({ entry: file.entry, text });
			} catch (error) {
				throw new NoumiWorkspaceFilesError({
					code: "NOUMI_WORKSPACE_INVALID_REQUEST",
					message: "Workspace file is not valid UTF-8 text",
					requestId: "local",
					retryable: false,
				});
			}
		},
		async writeFile(
			path: string,
			data: NoumiFileInput,
			options: NoumiWorkspaceWriteOptions = {},
		): Promise<NoumiWorkspaceEntry> {
			const upload = createUploadBody(data, options.contentType);
			if (upload.body.size > capabilities.maxFileBytes) {
				throw new NoumiWorkspaceFilesError({
					code: "NOUMI_WORKSPACE_LIMIT_EXCEEDED",
					message: "Workspace file exceeds the byte limit",
					requestId: "local",
					retryable: false,
				});
			}
			const control = await requestControl(
				transport,
				"prepareWrite",
				{
					path,
					size: upload.body.size,
					contentType: upload.contentType,
					overwrite: options.overwrite === true,
					ifMatch: options.ifMatch ?? null,
					expectedNodeId: options.expectedNodeId ?? null,
				},
				options.signal,
			);
			try {
				const transfer = parseTransfer(control.data);
				const response = await requestTransfer(
					transferFetch,
					transfer.url,
					{
						method: "PUT",
						headers: { "content-type": upload.contentType },
						body: upload.body,
						cache: "no-store",
						credentials: "omit",
						redirect: "error",
					},
					options.signal,
				);
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
						"Noumi Workspace upload response is invalid",
					);
				}
				return parseEntry(parsed.data);
			} catch (error) {
				const failure = attachTransportRequestId(
					error,
					control.requestId,
				);
				const recovered = await recoverUnknownMutation(
					transport,
					failure,
					"write",
					path,
					null,
				);
				if (recovered.recovered) {
					try {
						return parseEntry(recovered.data);
					} catch {
						// 畸形恢复响应不能覆盖原始 unknown-outcome 错误。
					}
				}
				throw failure;
			}
		},
		async createDirectory(
			path: string,
			options: NoumiWorkspaceCreateDirectoryOptions = {},
		): Promise<NoumiWorkspaceEntry> {
			const { data, requestId } = await requestMutation(
				transport,
				"createDirectory",
				{ path, recursive: options.recursive === true },
				path,
				null,
				options.signal,
			);
			try {
				return parseEntry(data);
			} catch (error) {
				return throwWithTransportRequestId(error, requestId);
			}
		},
		async move(
			sourcePath: string,
			destinationPath: string,
			options: NoumiWorkspaceMoveOptions = {},
		): Promise<NoumiWorkspaceEntry> {
			const { data, requestId } = await requestMutation(
				transport,
				"move",
				{
					sourcePath,
					destinationPath,
					overwrite: options.overwrite === true,
					sourceIfMatch: options.sourceIfMatch ?? null,
					expectedSourceNodeId:
						options.expectedSourceNodeId ?? null,
				},
				sourcePath,
				destinationPath,
				options.signal,
			);
			try {
				return parseEntry(data);
			} catch (error) {
				return throwWithTransportRequestId(error, requestId);
			}
		},
		async copy(
			sourcePath: string,
			destinationPath: string,
			options: NoumiWorkspaceCopyOptions = {},
		): Promise<NoumiWorkspaceEntry> {
			const { data, requestId } = await requestMutation(
				transport,
				"copy",
				{
					sourcePath,
					destinationPath,
					overwrite: options.overwrite === true,
					sourceIfMatch: options.sourceIfMatch ?? null,
					expectedSourceNodeId:
						options.expectedSourceNodeId ?? null,
				},
				sourcePath,
				destinationPath,
				options.signal,
			);
			try {
				return parseEntry(data);
			} catch (error) {
				return throwWithTransportRequestId(error, requestId);
			}
		},
		async remove(
			path: string,
			options: NoumiWorkspaceRemoveOptions = {},
		): Promise<NoumiWorkspaceRemoveResult> {
			const { data, requestId } = await requestMutation(
				transport,
				"remove",
				{
					path,
					recursive: options.recursive === true,
					ifMatch: options.ifMatch ?? null,
					expectedNodeId: options.expectedNodeId ?? null,
				},
				path,
				null,
				options.signal,
			);
			try {
				if (
					!isRecord(data) ||
					typeof data.path !== "string" ||
					!Number.isSafeInteger(data.removedNodeCount) ||
					Number(data.removedNodeCount) < 1
				) {
					throw invalidTransportResponse(
						"Noumi Workspace remove response is invalid",
					);
				}
				return Object.freeze({
					path: data.path,
					removedNodeCount: Number(data.removedNodeCount),
				});
			} catch (error) {
				return throwWithTransportRequestId(error, requestId);
			}
		},
		async createDownloadUrl(
			path: string,
			options: NoumiWorkspaceDownloadUrlOptions = {},
		): Promise<NoumiFileDownloadUrl> {
			const { data, requestId } = await requestControl(
				transport,
				"createDownloadUrl",
				{
					path,
					disposition: options.disposition ?? "attachment",
					fileName: options.fileName ?? null,
					ifMatch: options.ifMatch ?? null,
					expectedNodeId: options.expectedNodeId ?? null,
				},
				options.signal,
			);
			try {
				const transfer = parseTransfer(data);
				if (!isRecord(data) || typeof data.etag !== "string") {
					throw invalidTransportResponse(
						"Noumi Workspace download URL response is invalid",
					);
				}
				return Object.freeze({
					url: transfer.url,
					expiresAt: transfer.expiresAt,
					etag: data.etag,
				});
			} catch (error) {
				return throwWithTransportRequestId(error, requestId);
			}
		},
	});
}
