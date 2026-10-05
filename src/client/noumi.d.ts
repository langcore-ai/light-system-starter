/**
 * NoumiBridge 自包含公共类型契约。
 * 必须保持单文件、无 import，并由 noumi-global-contract.typecheck.ts 校验 Runtime 对齐。
 */

/**
 * 轻系统公开类型统一收口在 Noumi 命名空间，避免短类型名污染业务全局作用域。
 */
declare namespace Noumi {

// Database
type DbProtocolVersion = 1;
type DbScalar = string | number | boolean | null;
type DbJson =
	| DbScalar
	| DbJson[]
	| { [key: string]: DbJson };
type DbRow = Record<string, DbJson>;
type DbCapabilities = {
	dbProtocolVersion: 1;
	structuredCrud: boolean;
	sqlQuery: boolean;
	sqlExecute: boolean;
	sqlTransaction: boolean;
	operationRecovery: boolean;
};
type DbError = {
	code: string;
	message: string;
	requestId: string;
	retryable: boolean;
	details?: string;
	hint?: string;
};
type DbSuccess<T> = {
	version: DbProtocolVersion;
	ok: true;
	data: T;
	error: null;
	count: number | null;
	operationId: string | null;
};
type DbFailure = {
	version: DbProtocolVersion;
	ok: false;
	data: null;
	error: DbError;
	count: null;
	operationId: string | null;
};
type DbResult<T> = DbSuccess<T> | DbFailure;
type DbColumns = "*" | string;
type OrderOptions = { ascending?: boolean };
type UpsertOptions = {
	onConflict: readonly string[];
	ignoreDuplicates?: boolean;
};
type ExecuteOptions = { signal?: AbortSignal };
type SqlQueryOptions = ExecuteOptions;
type SqlExecuteOptions = {
	allowFullTable?: boolean;
	signal?: AbortSignal;
};

/** 引用同一事务内先前步骤的一行标量结果；不传递 SQL 片段。 */
type SqlResultReference = { $result: { step: number; row: number; column: string } };

/** 每项仍是一条参数化 SQL，query 可以读取本事务前序写入。 */
type SqlTransactionStatement = {
	intent: "query" | "execute";
	statement: string;
	bindings?: readonly (DbScalar | SqlResultReference)[];
	allowFullTable?: boolean;
};

/** 按输入顺序返回结果；没有 RETURNING 的成功写入 data 为 null。 */
type SqlTransactionStepResult = { data: DbRow[] | null; count: number };

/** operationId 供同一请求整体重试；不得更换语句或调用者。 */
type SqlTransactionOptions = { signal?: AbortSignal; operationId?: string };

/** Fluent 查询的公共过滤方法。 */
interface FilterMethods<Self> {
	eq(column: string, value: DbScalar): Self;
	neq(column: string, value: DbScalar): Self;
	gt(column: string, value: Exclude<DbScalar, null>): Self;
	gte(column: string, value: Exclude<DbScalar, null>): Self;
	lt(column: string, value: Exclude<DbScalar, null>): Self;
	lte(column: string, value: Exclude<DbScalar, null>): Self;
	in(column: string, values: readonly Exclude<DbScalar, null>[]): Self;
	is(column: string, value: null): Self;
	isNot(column: string, value: null): Self;
}

interface SelectBuilder<Row extends object>
	extends
		PromiseLike<DbResult<Row[]>>,
		FilterMethods<SelectBuilder<Row>> {
	order(column: string, options?: OrderOptions): SelectBuilder<Row>;
	limit(count: number): SelectBuilder<Row>;
	range(from: number, to: number): SelectBuilder<Row>;
	single(): TerminalBuilder<DbResult<Row>>;
	maybeSingle(): TerminalBuilder<DbResult<Row | null>>;
	execute(options?: ExecuteOptions): Promise<DbResult<Row[]>>;
}

interface TerminalBuilder<Result> extends PromiseLike<Result> {
	execute(options?: ExecuteOptions): Promise<Result>;
}

interface InsertBuilder<Row extends object>
	extends PromiseLike<DbResult<null>> {
	select(columns?: DbColumns): ReturningBuilder<Row>;
	execute(options?: ExecuteOptions): Promise<DbResult<null>>;
}

/** update/delete 必须先添加过滤条件或显式调用 all()。 */
interface MutationGuardBuilder<Row extends object>
	extends FilterMethods<GuardedMutationBuilder<Row>> {
	readonly then?: never;
	all(): AllMutationBuilder<Row>;
}

interface GuardedMutationBuilder<Row extends object>
	extends
		PromiseLike<DbResult<null>>,
		FilterMethods<GuardedMutationBuilder<Row>> {
	select(columns?: DbColumns): ReturningBuilder<Row>;
	execute(options?: ExecuteOptions): Promise<DbResult<null>>;
}

interface AllMutationBuilder<Row extends object>
	extends PromiseLike<DbResult<null>> {
	select(columns?: DbColumns): ReturningBuilder<Row>;
	execute(options?: ExecuteOptions): Promise<DbResult<null>>;
}

interface ReturningBuilder<Row extends object>
	extends PromiseLike<DbResult<Row[]>> {
	single(): TerminalBuilder<DbResult<Row>>;
	maybeSingle(): TerminalBuilder<DbResult<Row | null>>;
	execute(options?: ExecuteOptions): Promise<DbResult<Row[]>>;
}

interface TableRef<Row extends object> {
	select(columns?: DbColumns): SelectBuilder<Row>;
	insert(row: Partial<Row> | readonly Partial<Row>[]): InsertBuilder<Row>;
	update(patch: Partial<Row>): MutationGuardBuilder<Row>;
	upsert(
		row: Partial<Row> | readonly Partial<Row>[],
		options: UpsertOptions,
	): InsertBuilder<Row>;
	delete(): MutationGuardBuilder<Row>;
}

interface Sql {
	transaction(statements: readonly SqlTransactionStatement[], options?: SqlTransactionOptions): Promise<DbResult<SqlTransactionStepResult[]>>;
	query<Row extends object = DbRow>(
		statement: string,
		bindings?: readonly DbScalar[],
		options?: SqlQueryOptions,
	): Promise<DbResult<Row[]>>;
	execute<Row extends object = DbRow>(
		statement: string,
		bindings?: readonly DbScalar[],
		options?: SqlExecuteOptions,
	): Promise<DbResult<Row[] | null>>;
}

type DbOperationStatus = "pending" | "succeeded" | "failed";
type DbOperationResult<T> = {
	operationId: string;
	status: DbOperationStatus;
	result: DbResult<T> | null;
	retryAfterMs: number | null;
};

interface DbOperations {
	get<T = unknown>(
		operationId: string,
	): Promise<DbResult<DbOperationResult<T>>>;
}

interface Database {
	from<Row extends object = DbRow>(table: string): TableRef<Row>;
	readonly capabilities: DbCapabilities;
	readonly sql: Sql;
	readonly operations: DbOperations;
}

// App Storage
type FileCapabilities = {
	protocolVersion: 1;
	read: boolean;
	write: boolean;
	maxFileBytes: number;
};
type FileInput = string | Blob | ArrayBuffer | Uint8Array;
type FileRange = { offset: number; length?: number };
type FileDownloadUrl = {
	url: string;
	expiresAt: string;
	etag: string;
};
type AppStorageObject = {
	path: string;
	size: number;
	etag: string;
	contentType: string;
	uploadedAt: string;
	metadata: Readonly<Record<string, string>>;
};
type AppStorageFile = AppStorageObject & {
	body: Blob;
	range: { offset: number; length: number; totalSize: number } | null;
};
type AppStoragePutOptions = {
	contentType?: string;
	metadata?: Readonly<Record<string, string>>;
	ifMatch?: string;
	ifNoneMatch?: boolean;
	signal?: AbortSignal;
};
type AppStorageGetOptions = {
	range?: FileRange;
	ifMatch?: string;
	signal?: AbortSignal;
};
type AppStorageListOptions = {
	prefix?: string;
	cursor?: string;
	limit?: number;
	groupByDirectory?: boolean;
	signal?: AbortSignal;
};
type AppStorageListPage = {
	objects: AppStorageObject[];
	directories: string[];
	cursor: string | null;
};
type AppStorageCopyOptions = {
	sourceIfMatch?: string;
	overwrite?: boolean;
	signal?: AbortSignal;
};
type FileDownloadUrlOptions = {
	disposition?: "inline" | "attachment";
	fileName?: string;
	signal?: AbortSignal;
};
type AppStorageRequestOptions = ExecuteOptions;
type FileTransportError = Error & {
	code: "NOUMI_FILE_TRANSPORT";
	requestId: string | null;
	outcome: "not-sent" | "unknown";
};

/** 当前轻系统独享、跨 deployment 保留的对象存储。 */
interface AppStorage {
	readonly capabilities: Readonly<FileCapabilities>;
	put(
		path: string,
		data: FileInput,
		options?: AppStoragePutOptions,
	): Promise<AppStorageObject>;
	get(
		path: string,
		options?: AppStorageGetOptions,
	): Promise<AppStorageFile>;
	head(
		path: string,
		options?: AppStorageRequestOptions,
	): Promise<AppStorageObject | null>;
	list(options?: AppStorageListOptions): Promise<AppStorageListPage>;
	delete(
		path: string,
		options?: AppStorageRequestOptions,
	): Promise<{ deleted: boolean }>;
	copy(
		sourcePath: string,
		destinationPath: string,
		options?: AppStorageCopyOptions,
	): Promise<AppStorageObject>;
	createDownloadUrl(
		path: string,
		options?: FileDownloadUrlOptions,
	): Promise<FileDownloadUrl>;
}

// Workspace Files
type WorkspaceEntry = {
	id: string;
	path: string;
	name: string;
	type: "file" | "directory";
	size: number | null;
	etag: string | null;
	contentType: string | null;
	modifiedAt: string;
};
type WorkspaceFile = {
	entry: WorkspaceEntry & { type: "file"; etag: string };
	body: Blob;
	range: { offset: number; length: number; totalSize: number } | null;
};
type WorkspaceTextFile = {
	entry: WorkspaceEntry & { type: "file"; etag: string };
	text: string;
};
type WorkspaceReadOptions = {
	range?: FileRange;
	ifMatch?: string;
	expectedNodeId?: string;
	signal?: AbortSignal;
};
type WorkspaceTextReadOptions = Omit<
	WorkspaceReadOptions,
	"range"
>;
type WorkspaceListOptions = {
	cursor?: string;
	limit?: number;
	signal?: AbortSignal;
};
type WorkspaceListPage = {
	entries: WorkspaceEntry[];
	cursor: string | null;
};
type WorkspaceWriteOptions = {
	contentType?: string;
	overwrite?: boolean;
	ifMatch?: string;
	expectedNodeId?: string;
	signal?: AbortSignal;
};
type WorkspaceCreateDirectoryOptions = {
	recursive?: boolean;
	signal?: AbortSignal;
};
type WorkspaceMoveOptions = {
	overwrite?: boolean;
	sourceIfMatch?: string;
	expectedSourceNodeId?: string;
	signal?: AbortSignal;
};
type WorkspaceCopyOptions = WorkspaceMoveOptions;
type WorkspaceRemoveOptions = {
	recursive?: boolean;
	ifMatch?: string;
	expectedNodeId?: string;
	signal?: AbortSignal;
};
type WorkspaceRemoveResult = {
	path: string;
	removedNodeCount: number;
};
type WorkspaceDownloadUrlOptions = FileDownloadUrlOptions & {
	ifMatch?: string;
	expectedNodeId?: string;
};
type WorkspaceRequestOptions = ExecuteOptions;

/** 当前 Project 的协作 Workspace 文件能力。 */
interface WorkspaceFiles {
	readonly capabilities: Readonly<FileCapabilities>;
	stat(
		path: string,
		options?: WorkspaceRequestOptions,
	): Promise<WorkspaceEntry | null>;
	listDirectory(
		path?: string,
		options?: WorkspaceListOptions,
	): Promise<WorkspaceListPage>;
	readFile(
		path: string,
		options?: WorkspaceReadOptions,
	): Promise<WorkspaceFile>;
	readTextFile(
		path: string,
		options?: WorkspaceTextReadOptions,
	): Promise<WorkspaceTextFile>;
	writeFile(
		path: string,
		data: FileInput,
		options?: WorkspaceWriteOptions,
	): Promise<WorkspaceEntry>;
	createDirectory(
		path: string,
		options?: WorkspaceCreateDirectoryOptions,
	): Promise<WorkspaceEntry>;
	move(
		sourcePath: string,
		destinationPath: string,
		options?: WorkspaceMoveOptions,
	): Promise<WorkspaceEntry>;
	copy(
		sourcePath: string,
		destinationPath: string,
		options?: WorkspaceCopyOptions,
	): Promise<WorkspaceEntry>;
	remove(
		path: string,
		options?: WorkspaceRemoveOptions,
	): Promise<WorkspaceRemoveResult>;
	createDownloadUrl(
		path: string,
		options?: WorkspaceDownloadUrlOptions,
	): Promise<FileDownloadUrl>;
}

// Outside Database
type OutsideDbCapabilities = {
	protocolVersion: 1;
	available: boolean;
	driver: "POSTGRESQL";
};
type OutsideDbJson =
	| null
	| boolean
	| number
	| string
	| OutsideDbJson[]
	| { [key: string]: OutsideDbJson };
type OutsideDbTaggedValue =
	| { $noumiType: "bigint"; value: string }
	| { $noumiType: "decimal"; value: string }
	| { $noumiType: "bytes"; value: string }
	| { $noumiType: "date"; value: string }
	| { $noumiType: "json"; value: OutsideDbJson };
type OutsideDbInputValue =
	| null
	| boolean
	| number
	| string
	| bigint
	| Date
	| Uint8Array
	| OutsideDbJson[]
	| { [key: string]: OutsideDbJson }
	| OutsideDbTaggedValue;
type OutsideDbValue =
	| OutsideDbJson
	| Exclude<OutsideDbTaggedValue, { $noumiType: "json" }>;
type OutsideDbRow = Record<string, OutsideDbValue>;
type OutsideDbStatementResult<
	T extends OutsideDbRow = OutsideDbRow,
> = {
	command: string | null;
	rowCount: number | null;
	rows: T[];
};
type OutsideDbSqlOptions = {
	/** 100ms 到 60s；默认 15s。 */
	timeoutMs?: number;
	/** 仅停止等待并发送 best-effort cancel。 */
	signal?: AbortSignal;
};
type OutsideDbSuccess<
	T extends OutsideDbRow = OutsideDbRow,
> = {
	version: 1;
	ok: true;
	data: { results: OutsideDbStatementResult<T>[] };
	error: null;
	executionId: string;
};
type OutsideDbFailure = {
	version: 1;
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
type OutsideDbResult<
	T extends OutsideDbRow = OutsideDbRow,
> = OutsideDbSuccess<T> | OutsideDbFailure;

interface OutsideDatabase {
	/** 单次调用使用一条连接；跨调用 transaction 不受支持。 */
	sql<T extends OutsideDbRow = OutsideDbRow>(
		sqlText: string,
		bindings?: readonly OutsideDbInputValue[],
		options?: OutsideDbSqlOptions,
	): Promise<OutsideDbResult<T>>;
}

interface OutsideDbFactory {
	(slug: string): OutsideDatabase;
	readonly capabilities: OutsideDbCapabilities;
}

type OutsideDbTransportError = Error & {
	readonly requestId: string | null;
	readonly outcome: "not-sent" | "unknown";
};

/** 项目管理员管理的不可变 Secret 名称；仅服务端解析，轮换在下一次请求生效，无需发布。 */
type HttpSecretReference = { $secret: string; prefix?: string };
type HttpValue = string | HttpSecretReference;
/** JSON 可递归包含 Secret 引用；不支持任意模板插值。 */
type HttpJson = null | boolean | number | string | HttpSecretReference | HttpJson[] | { [key: string]: HttpJson };
/** 五种正文形式互斥；省略所有正文适用于 GET/HEAD。 */
/** 二进制文件随 multipart 上传；fields 支持既有 Secret 引用。 */
type HttpMultipart = {
  fields?: Record<string, HttpValue>;
  files: Array<{ name: string; filename: string; contentType?: string; data: Blob | Uint8Array | ArrayBuffer }>;
};
type HttpBody =
  | { body?: string; json?: never; form?: never; text?: never; multipart?: never }
  | { body?: never; json: HttpJson; form?: never; text?: never; multipart?: never }
  | { body?: never; json?: never; form: Record<string, HttpValue>; text?: never; multipart?: never }
  | { body?: never; json?: never; form?: never; text: HttpValue[]; multipart?: never }
  | { body?: never; json?: never; form?: never; text?: never; multipart: HttpMultipart };
/** 后端代理公网 HTTP(S)；Secret 仅服务端解析并发往公网 HTTPS，不继承平台 Cookie。 */
type HttpRequest = {
  url: string;
  method?: "GET" | "HEAD" | "POST" | "PUT" | "PATCH" | "DELETE" | "OPTIONS";
  headers?: Record<string, HttpValue>;
  query?: Record<string, HttpValue>;
  /** 追加到固定 URL path，各段独立编码；URL 不得包含 query。 */
  pathSegments?: HttpValue[];
  /** 默认 30000，允许 100–30000 毫秒。 */
  timeoutMs?: number;
} & HttpBody;
/** 平台 HTTP 错误；catch 后按 code/outcome 等属性收窄，unknown 不得自动重试。 */
type HttpError = Error & {
  readonly code: string;
  readonly secretName?: string;
  readonly requiredPermission?: "project-admin";
  readonly outcome: "not-sent" | "unknown";
};
/** 外部响应；4xx/5xx 原样返回，传输错误 reject 且不能假定未产生副作用。 */
type HttpResponse = {
  status: number;
  statusText: string;
  headers: Array<[string, string]>;
  /** 响应正文按 UTF-8 解码；JSON 可使用 JSON.parse(body)。 */
  body: string;
  /** 解码 HTTP 传输压缩后的正文 base64，供二进制内容使用。 */
  bodyBase64: string;
};

// Bridge
interface MemberInfo {
	email: string;
	displayName: string | null;
}

/** 主平台在业务 bundle 执行前注入的可信 iframe Bridge。 */
interface Bridge {
	app: { name: string };
	createByMember: MemberInfo;
	/** 公开匿名访问时为空。 */
	currentMember: (MemberInfo & { /** 当前Core稳定成员ID。 */ id: string }) | null;
  /** 宿主许可后返回有界照片/录音；取消、关页或超时关闭设备。 */
  media: {
    recordAudio(options?: { maxDurationMs?: number }): Promise<Blob>;
    takePhoto(options?: { facingMode?: "user" | "environment" }): Promise<Blob>;
    cancel(): Promise<void>;
  };
  /** 当前应用hash路由；打开外部资源必须由宿主用户确认。 */
  navigation: {
    getRoute(): Promise<{ hash: string }>;
    setHash(hash: string, options?: { replace?: boolean }): Promise<{ hash: string }>;
    openExternal(url: string): Promise<void>;
  };
	diagnostics: Diagnostics;
	/** 与主前端隔离、按当前轻系统分区的异步浏览器存储。 */
	localStorage: {
    /** 同一IndexedDB事务按提交后净额核算；ifMatch不满足时返回NOUMI_STORAGE_CONFLICT。最多128个set/remove/ifMatch键。 */
    replaceItems(input: { set: Record<string, string>; remove?: string[]; ifMatch?: Record<string, string | null> }): Promise<void>;
		setItem(key: string, value: string): Promise<void>;
		getItem(key: string): Promise<string | null>;
		removeItem(key: string): Promise<void>;
		clear(): Promise<void>;
		length(): Promise<number>;
		keys(): Promise<string[]>;
		has(key: string): Promise<boolean>;
	};
	/** 通过可信外壳和平台后端发起外部请求，不自动重试或跟随重定向。 */
	readonly http: { request(input: HttpRequest): Promise<HttpResponse> };
	readonly appStorage: AppStorage;
	readonly workspaceFiles: WorkspaceFiles;
	readonly outsideDb: OutsideDbFactory;
	db: Database;
}

/** 上报已捕获异常；调用不等待网络且不抛出上报错误。 */
interface Diagnostics {
	reportError(error: unknown, options?: ReportErrorOptions): void;
}

interface ReportErrorOptions {
	component?: string;
	operation?: string;
	tags?: Readonly<Record<string, string | number | boolean | null>>;
}

}

interface Window {
	NoumiBridge: Noumi.Bridge;
	/** starter Error Boundary 内部入口，不属于 NoumiBridge API。 */
	__NOUMI_REPORT_REACT_ERROR__(
		error: unknown,
		componentStack: unknown,
	): void;
	__LIGHT_SYSTEM_REACT_SPA_READY__?: boolean;
}
