/** Noumi DB v1 的虚拟 origin；SDK 不会直接对它发起网络请求。 */
export const NOUMI_DB_VIRTUAL_ORIGIN = "https://db.noumi.invalid";

/** Noumi DB wire 版本。 */
export type NoumiDbProtocolVersion = 1;

/** 数据库协议允许的标量。 */
export type NoumiDbScalar = string | number | boolean | null;

/** 数据库协议允许的 JSON 值。 */
export type NoumiDbJson =
	| NoumiDbScalar
	| NoumiDbJson[]
	| { [key: string]: NoumiDbJson };

/** 默认数据库行形状。 */
export type NoumiDbRow = Record<string, NoumiDbJson>;

/** 当前 Browser Runtime/provider 数据库能力快照。 */
export type NoumiDbCapabilities = {
	dbProtocolVersion: 1;
	structuredCrud: boolean;
	sqlQuery: boolean;
	sqlExecute: boolean;
	operationRecovery: boolean;
};

/** 稳定数据库错误。 */
export type NoumiDbError = {
	code: string;
	message: string;
	requestId: string;
	retryable: boolean;
	details?: string;
	hint?: string;
};

/** 成功 response envelope。 */
export type NoumiDbSuccess<T> = {
	version: NoumiDbProtocolVersion;
	ok: true;
	data: T;
	error: null;
	count: number | null;
	operationId: string | null;
};

/** 失败 response envelope。 */
export type NoumiDbFailure = {
	version: NoumiDbProtocolVersion;
	ok: false;
	data: null;
	error: NoumiDbError;
	count: null;
	operationId: string | null;
};

/** 所有合法数据库结果。 */
export type NoumiDbResult<T> = NoumiDbSuccess<T> | NoumiDbFailure;

/** SDK transport failure；合法 HTTP 数据错误不使用该类型。 */
export type NoumiDbTransportError = Error & {
	code: "NOUMI_DB_TRANSPORT";
	requestId: string | null;
	operationId: string | null;
	outcome: "not-sent" | "unknown";
};

/** Builder 可接受的 projection。 */
export type NoumiDbColumns = "*" | string;

/** 排序选项。 */
export type NoumiOrderOptions = {
	ascending?: boolean;
};

/** Upsert conflict 选项。 */
export type NoumiUpsertOptions = {
	onConflict: readonly string[];
	ignoreDuplicates?: boolean;
};

/** Builder 执行选项。 */
export type NoumiExecuteOptions = {
	signal?: AbortSignal;
};

/** SQL query 选项。 */
export type NoumiSqlQueryOptions = {
	signal?: AbortSignal;
};

/** SQL mutation 选项。 */
export type NoumiSqlExecuteOptions = {
	allowFullTable?: boolean;
	signal?: AbortSignal;
};

/** SDK transport seam；Browser Runtime 在这里转入 Bridge。 */
export type NoumiDbTransport = (
	request: Request,
	options?: NoumiExecuteOptions,
) => Promise<Response>;

/** Fluent filter 公共方法。 */
export interface NoumiFilterMethods<Self> {
	eq(column: string, value: NoumiDbScalar): Self;
	neq(column: string, value: NoumiDbScalar): Self;
	gt(column: string, value: Exclude<NoumiDbScalar, null>): Self;
	gte(column: string, value: Exclude<NoumiDbScalar, null>): Self;
	lt(column: string, value: Exclude<NoumiDbScalar, null>): Self;
	lte(column: string, value: Exclude<NoumiDbScalar, null>): Self;
	in(
		column: string,
		values: readonly Exclude<NoumiDbScalar, null>[],
	): Self;
	is(column: string, value: null): Self;
	isNot(column: string, value: null): Self;
}

/** Select builder。 */
export interface NoumiSelectBuilder<Row extends object>
	extends
		PromiseLike<NoumiDbResult<Row[]>>,
		NoumiFilterMethods<NoumiSelectBuilder<Row>> {
	order(column: string, options?: NoumiOrderOptions): NoumiSelectBuilder<Row>;
	limit(count: number): NoumiSelectBuilder<Row>;
	range(from: number, to: number): NoumiSelectBuilder<Row>;
	single(): NoumiTerminalBuilder<NoumiDbResult<Row>>;
	maybeSingle(): NoumiTerminalBuilder<NoumiDbResult<Row | null>>;
	execute(options?: NoumiExecuteOptions): Promise<NoumiDbResult<Row[]>>;
}

/** 已完成 chaining 的 terminal builder。 */
export interface NoumiTerminalBuilder<Result> extends PromiseLike<Result> {
	execute(options?: NoumiExecuteOptions): Promise<Result>;
}

/** Insert/upsert builder。 */
export interface NoumiInsertBuilder<Row extends object>
	extends PromiseLike<NoumiDbResult<null>> {
	select(columns?: NoumiDbColumns): NoumiReturningBuilder<Row>;
	execute(options?: NoumiExecuteOptions): Promise<NoumiDbResult<null>>;
}

/** 未完成安全 guard 的 update/delete builder。 */
export interface NoumiMutationGuardBuilder<Row extends object> {
	readonly then?: never;
	eq(column: string, value: NoumiDbScalar): NoumiGuardedMutationBuilder<Row>;
	neq(column: string, value: NoumiDbScalar): NoumiGuardedMutationBuilder<Row>;
	gt(
		column: string,
		value: Exclude<NoumiDbScalar, null>,
	): NoumiGuardedMutationBuilder<Row>;
	gte(
		column: string,
		value: Exclude<NoumiDbScalar, null>,
	): NoumiGuardedMutationBuilder<Row>;
	lt(
		column: string,
		value: Exclude<NoumiDbScalar, null>,
	): NoumiGuardedMutationBuilder<Row>;
	lte(
		column: string,
		value: Exclude<NoumiDbScalar, null>,
	): NoumiGuardedMutationBuilder<Row>;
	in(
		column: string,
		values: readonly Exclude<NoumiDbScalar, null>[],
	): NoumiGuardedMutationBuilder<Row>;
	is(column: string, value: null): NoumiGuardedMutationBuilder<Row>;
	isNot(column: string, value: null): NoumiGuardedMutationBuilder<Row>;
	all(): NoumiAllMutationBuilder<Row>;
}

/** 已有 filter guard 的 mutation builder。 */
export interface NoumiGuardedMutationBuilder<Row extends object>
	extends
		PromiseLike<NoumiDbResult<null>>,
		NoumiFilterMethods<NoumiGuardedMutationBuilder<Row>> {
	select(columns?: NoumiDbColumns): NoumiReturningBuilder<Row>;
	execute(options?: NoumiExecuteOptions): Promise<NoumiDbResult<null>>;
}

/** 显式 full-table mutation builder。 */
export interface NoumiAllMutationBuilder<Row extends object>
	extends PromiseLike<NoumiDbResult<null>> {
	select(columns?: NoumiDbColumns): NoumiReturningBuilder<Row>;
	execute(options?: NoumiExecuteOptions): Promise<NoumiDbResult<null>>;
}

/** 带 RETURNING 的 mutation builder。 */
export interface NoumiReturningBuilder<Row extends object>
	extends PromiseLike<NoumiDbResult<Row[]>> {
	single(): NoumiTerminalBuilder<NoumiDbResult<Row>>;
	maybeSingle(): NoumiTerminalBuilder<NoumiDbResult<Row | null>>;
	execute(options?: NoumiExecuteOptions): Promise<NoumiDbResult<Row[]>>;
}

/** 单表 API 入口。 */
export interface NoumiTableRef<Row extends object> {
	select(columns?: NoumiDbColumns): NoumiSelectBuilder<Row>;
	insert(row: Partial<Row> | readonly Partial<Row>[]): NoumiInsertBuilder<Row>;
	update(patch: Partial<Row>): NoumiMutationGuardBuilder<Row>;
	upsert(
		row: Partial<Row> | readonly Partial<Row>[],
		options: NoumiUpsertOptions,
	): NoumiInsertBuilder<Row>;
	delete(): NoumiMutationGuardBuilder<Row>;
}

/** SQL API。 */
export interface NoumiSql {
	query<Row extends object = NoumiDbRow>(
		statement: string,
		bindings?: readonly NoumiDbScalar[],
		options?: NoumiSqlQueryOptions,
	): Promise<NoumiDbResult<Row[]>>;
	execute<Row extends object = NoumiDbRow>(
		statement: string,
		bindings?: readonly NoumiDbScalar[],
		options?: NoumiSqlExecuteOptions,
	): Promise<NoumiDbResult<Row[] | null>>;
}

/** Operation 状态。 */
export type NoumiDbOperationStatus = "pending" | "succeeded" | "failed";

/** Operation recovery payload。 */
export type NoumiDbOperationResult<T> = {
	operationId: string;
	status: NoumiDbOperationStatus;
	result: NoumiDbResult<T> | null;
	retryAfterMs: number | null;
};

/** Operation recovery API。 */
export interface NoumiDbOperations {
	get<T = unknown>(
		operationId: string,
	): Promise<NoumiDbResult<NoumiDbOperationResult<T>>>;
}

/** 公开数据库 SDK。 */
export interface NoumiDatabase {
	from<Row extends object = NoumiDbRow>(table: string): NoumiTableRef<Row>;
	readonly capabilities: NoumiDbCapabilities;
	readonly sql: NoumiSql;
	readonly operations: NoumiDbOperations;
}

/** 内部 fluent operation。 */
type FluentOperation = "select" | "insert" | "upsert" | "update" | "delete";

/** 内部 filter。 */
type FluentFilter = {
	column: string;
	operator: "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "in" | "is" | "is_not";
	value: NoumiDbScalar | Exclude<NoumiDbScalar, null>[];
};

/** 不可变 fluent builder 状态。 */
type FluentState = {
	table: string;
	operation: FluentOperation;
	columns?: string;
	body?: NoumiDbJson;
	filters: readonly FluentFilter[];
	orders: readonly { column: string; ascending: boolean }[];
	limit?: number;
	offset?: number;
	cardinality?: "one" | "zero-or-one";
	all?: true;
	onConflict?: readonly string[];
	resolution?: "merge" | "ignore";
};

/** SDK client-side stable error。 */
type NoumiDbClientError = Error & {
	code: string;
};

/** Identifier contract。 */
const IDENTIFIER_PATTERN = /^[a-z][a-z0-9_]{0,62}$/;

/** UUID contract；接受 RFC 4122 variant 的任意版本。 */
const UUID_PATTERN =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** 单条 SQL 最大 UTF-8 字节数。 */
const MAX_SQL_BYTES = 64 * 1024;

/** 单次 SQL 最大 binding 数。 */
const MAX_SQL_BINDINGS = 100;

/** 单个 fluent Request 的结构预算。 */
const FLUENT_LIMITS = {
	bodyBytes: 256 * 1024,
	columns: 64,
	filters: 32,
	inValues: 100,
	mutationRows: 100,
	orders: 8,
	urlBytes: 16 * 1024,
} as const;

/** 未显式传入 bootstrap 时使用的 fail-closed capability。 */
const UNAVAILABLE_CAPABILITIES: Readonly<NoumiDbCapabilities> = Object.freeze({
	dbProtocolVersion: 1,
	structuredCrud: false,
	sqlQuery: false,
	sqlExecute: false,
	operationRecovery: false,
});

/** 创建带稳定 code 的 client error。 */
function clientError(code: string, message: string): NoumiDbClientError {
	const error = new Error(message) as NoumiDbClientError;
	error.name = "NoumiDbClientError";
	error.code = code;
	return error;
}

/** 校验应用 identifier。 */
function assertIdentifier(value: string, label: string): void {
	if (
		typeof value !== "string" ||
		!IDENTIFIER_PATTERN.test(value) ||
		value.startsWith("sqlite_") ||
		value.startsWith("__noumi_")
	) {
		throw clientError("NOUMI_DB_INVALID_REQUEST", `${label} is invalid`);
	}
}

/** 校验并规范化 projection。 */
function normalizeColumns(columns: NoumiDbColumns = "*"): string {
	if (columns === "*") return columns;
	if (typeof columns !== "string") {
		throw clientError("NOUMI_DB_INVALID_REQUEST", "select columns are invalid");
	}
	const parsed = columns.split(",");
	if (
		parsed.length === 0 ||
		parsed.length > FLUENT_LIMITS.columns ||
		parsed.some((column) => !column) ||
		new Set(parsed).size !== parsed.length
	) {
		throw clientError("NOUMI_DB_INVALID_REQUEST", "select columns are invalid");
	}
	for (const column of parsed) assertIdentifier(column, "column");
	return parsed.join(",");
}

/** 规范化一个 JSON-safe 值，并按词典序排列 object key。 */
function canonicalizeJson(value: unknown, stack = new Set<object>()): NoumiDbJson {
	if (value === null || typeof value === "string" || typeof value === "boolean") {
		return value;
	}
	if (typeof value === "number") {
		if (!Number.isFinite(value) || !Number.isSafeInteger(value) && Number.isInteger(value)) {
			throw clientError("NOUMI_DB_INVALID_VALUE", "number must be finite and safe");
		}
		return value;
	}
	if (typeof value !== "object" || value instanceof Date) {
		throw clientError("NOUMI_DB_INVALID_VALUE", "value must be JSON-safe");
	}
	if (stack.has(value)) {
		throw clientError("NOUMI_DB_INVALID_VALUE", "value must not contain cycles");
	}
	stack.add(value);
	try {
		if (Array.isArray(value)) {
			return value.map((item) => canonicalizeJson(item, stack));
		}
		const prototype = Object.getPrototypeOf(value);
		if (prototype !== Object.prototype && prototype !== null) {
			throw clientError("NOUMI_DB_INVALID_VALUE", "value must be a plain object");
		}
		const result: Record<string, NoumiDbJson> = {};
		for (const key of Object.keys(value).sort()) {
			result[key] = canonicalizeJson(
				(value as Record<string, unknown>)[key],
				stack,
			);
		}
		return result;
	} finally {
		stack.delete(value);
	}
}

/** 校验 filter scalar。 */
function normalizeScalar(value: unknown): NoumiDbScalar {
	const normalized = canonicalizeJson(value);
	if (
		Array.isArray(normalized) ||
		typeof normalized === "object" && normalized !== null
	) {
		throw clientError("NOUMI_DB_INVALID_VALUE", "filter value must be a scalar");
	}
	return normalized;
}

/** 校验 mutation body 及 batch column shape。 */
function normalizeMutationBody(value: unknown, allowArray: boolean): NoumiDbJson {
	const normalized = canonicalizeJson(value);
	const rows = Array.isArray(normalized) ? normalized : [normalized];
	if (Array.isArray(normalized) && !allowArray) {
		throw clientError("NOUMI_DB_INVALID_VALUE", "update body must be an object");
	}
	if (rows.length === 0) {
		throw clientError("NOUMI_DB_INVALID_VALUE", "mutation body must not be empty");
	}
	if (rows.length > FLUENT_LIMITS.mutationRows) {
		throw clientError(
			"NOUMI_DB_LIMIT_EXCEEDED",
			"mutation rows exceed the limit",
		);
	}
	const objects = rows.map((row) => {
		if (typeof row !== "object" || row === null || Array.isArray(row)) {
			throw clientError("NOUMI_DB_INVALID_VALUE", "mutation row must be an object");
		}
		if (Object.keys(row).length === 0) {
			throw clientError("NOUMI_DB_INVALID_VALUE", "mutation row must not be empty");
		}
		for (const column of Object.keys(row)) assertIdentifier(column, "column");
		return row;
	});
	const expectedColumns = Object.keys(objects[0]!).join("\0");
	if (objects.some((row) => Object.keys(row).join("\0") !== expectedColumns)) {
		throw clientError(
			"NOUMI_DB_INVALID_VALUE",
			"batch mutation rows must use the same columns",
		);
	}
	return normalized;
}

/** 把 filter value 转为 wire literal。 */
function serializeFilterValue(filter: FluentFilter): string {
	return JSON.stringify(filter.value);
}

/** 根据 immutable state 构造 canonical virtual Request。 */
function createFluentRequest(state: FluentState, operationId: string | null): Request {
	if (
		state.filters.length > FLUENT_LIMITS.filters ||
		state.orders.length > FLUENT_LIMITS.orders
	) {
		throw clientError("NOUMI_DB_LIMIT_EXCEEDED", "fluent request exceeds the limit");
	}
	const url = new URL(
		`/v1/tables/${encodeURIComponent(state.table)}`,
		NOUMI_DB_VIRTUAL_ORIGIN,
	);
	if (state.columns !== undefined) url.searchParams.append("select", state.columns);
	for (const filter of state.filters) {
		url.searchParams.append(
			`where.${filter.column}`,
			`${filter.operator}.${serializeFilterValue(filter)}`,
		);
	}
	for (const order of state.orders) {
		url.searchParams.append(
			"order",
			`${order.column}.${order.ascending ? "asc" : "desc"}`,
		);
	}
	if (state.limit !== undefined) url.searchParams.append("limit", String(state.limit));
	if (state.offset !== undefined) url.searchParams.append("offset", String(state.offset));
	if (state.cardinality !== undefined) {
		url.searchParams.append("cardinality", state.cardinality);
	}
	if (state.all) url.searchParams.append("all", "true");
	if (state.onConflict) {
		url.searchParams.append("on_conflict", state.onConflict.join(","));
		url.searchParams.append("resolution", state.resolution ?? "merge");
	}
	const method = state.operation === "select"
		? "GET"
		: state.operation === "insert" || state.operation === "upsert"
			? "POST"
			: state.operation === "update"
				? "PATCH"
				: "DELETE";
	const headers = new Headers({ accept: "application/json" });
	const body = state.body === undefined ? undefined : JSON.stringify(state.body);
	if (
		new TextEncoder().encode(url.href).byteLength > FLUENT_LIMITS.urlBytes ||
		body !== undefined &&
			new TextEncoder().encode(body).byteLength > FLUENT_LIMITS.bodyBytes
	) {
		throw clientError("NOUMI_DB_LIMIT_EXCEEDED", "fluent request exceeds the limit");
	}
	if (body !== undefined) headers.set("content-type", "application/json");
	if (operationId) headers.set("x-noumi-db-operation-id", operationId);
	return new Request(url, { body, headers, method });
}

/** 创建 transport error，并保留 mutation outcome。 */
function transportError(
	cause: unknown,
	operationId: string | null,
	outcome: "not-sent" | "unknown",
): NoumiDbTransportError {
	const error = new Error(
		cause instanceof Error ? cause.message : "Noumi database transport failed",
		{ cause },
	) as NoumiDbTransportError;
	error.name = "NoumiDbTransportError";
	error.code = "NOUMI_DB_TRANSPORT";
	error.requestId = null;
	error.operationId = operationId;
	error.outcome = outcome;
	return error;
}

/** 严格解析 v1 response envelope。 */
async function readResult<T>(response: Response): Promise<NoumiDbResult<T>> {
	let value: unknown;
	try {
		value = await response.json();
	} catch (error) {
		throw transportError(error, null, "unknown");
	}
	if (typeof value !== "object" || value === null || Array.isArray(value)) {
		throw transportError(new Error("Noumi database response is invalid"), null, "unknown");
	}
	const record = value as Record<string, unknown>;
	if (
		record.version !== 1 ||
		typeof record.ok !== "boolean" ||
		!("data" in record) ||
		!("error" in record) ||
		!("count" in record) ||
		!("operationId" in record)
	) {
		throw transportError(new Error("Noumi database response is invalid"), null, "unknown");
	}
	if (record.operationId !== null && typeof record.operationId !== "string") {
		throw transportError(new Error("Noumi database response is invalid"), null, "unknown");
	}
	if (record.ok) {
		if (
			record.error !== null ||
			record.count !== null && (
				typeof record.count !== "number" ||
				!Number.isSafeInteger(record.count) ||
				record.count < 0
			)
		) {
			throw transportError(new Error("Noumi database response is invalid"), null, "unknown");
		}
		return value as NoumiDbSuccess<T>;
	}
	const error = record.error;
	if (
		record.data !== null ||
		record.count !== null ||
		typeof error !== "object" ||
		error === null ||
		Array.isArray(error)
	) {
		throw transportError(new Error("Noumi database response is invalid"), null, "unknown");
	}
	const failure = error as Record<string, unknown>;
	if (
		typeof failure.code !== "string" ||
		typeof failure.message !== "string" ||
		typeof failure.requestId !== "string" ||
		typeof failure.retryable !== "boolean"
	) {
		throw transportError(new Error("Noumi database response is invalid"), null, "unknown");
	}
	return value as NoumiDbFailure;
}

/** 执行一个已经完成 client validation 的 Request。 */
async function executeRequest<T>(
	transport: NoumiDbTransport,
	request: Request,
	options: NoumiExecuteOptions | undefined,
	operationId: string | null,
): Promise<NoumiDbResult<T>> {
	if (options?.signal?.aborted) {
		throw transportError(options.signal.reason, operationId, "not-sent");
	}
	let response: Response;
	try {
		response = await transport(request, options);
	} catch (error) {
		throw transportError(error, operationId, "unknown");
	}
	try {
		return await readResult<T>(response);
	} catch (error) {
		if (
			error instanceof Error &&
			(error as Partial<NoumiDbTransportError>).code === "NOUMI_DB_TRANSPORT"
		) {
			(error as NoumiDbTransportError).operationId = operationId;
		}
		throw error;
	}
}

/** 通用 memoized PromiseLike builder。 */
abstract class ExecutableBuilder<Result> implements PromiseLike<Result> {
	private promise: Promise<Result> | null = null;

	abstract createPromise(options?: NoumiExecuteOptions): Promise<Result>;

	/** 同一个 builder 的第一次执行拥有唯一 Promise。 */
	execute(options?: NoumiExecuteOptions): Promise<Result> {
		this.promise ??= this.createPromise(options);
		return this.promise;
	}

	then<TResult1 = Result, TResult2 = never>(
		onfulfilled?: ((value: Result) => TResult1 | PromiseLike<TResult1>) | null,
		onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
	): PromiseLike<TResult1 | TResult2> {
		return this.execute().then(onfulfilled, onrejected);
	}
}

/** Fluent builder 的通用 execution。 */
class FluentExecutable<Result> extends ExecutableBuilder<Result> {
	constructor(
		protected readonly transport: NoumiDbTransport,
		protected readonly state: FluentState,
		private readonly mutation: boolean,
	) {
		super();
	}

	async createPromise(options?: NoumiExecuteOptions): Promise<Result> {
		const operationId = this.mutation ? crypto.randomUUID() : null;
		return await executeRequest(
			this.transport,
			createFluentRequest(this.state, operationId),
			options,
			operationId,
		) as Result;
	}
}

/** 返回一个带新 filter 的 immutable state。 */
function appendFilter(
	state: FluentState,
	column: string,
	operator: FluentFilter["operator"],
	value: unknown,
): FluentState {
	assertIdentifier(column, "column");
	if ((operator === "eq" || operator === "neq") && value === null) {
		throw clientError(
			"NOUMI_DB_INVALID_FILTER",
			operator === "eq"
				? "eq(column, null) is invalid; use is(column, null)"
				: "neq(column, null) is invalid; use isNot(column, null)",
		);
	}
	let normalized: NoumiDbScalar | Exclude<NoumiDbScalar, null>[];
	if (operator === "in") {
		if (!Array.isArray(value)) {
			throw clientError("NOUMI_DB_INVALID_FILTER", "in() requires an array");
		}
		if (value.length > FLUENT_LIMITS.inValues) {
			throw clientError("NOUMI_DB_LIMIT_EXCEEDED", "in() values exceed the limit");
		}
		normalized = value.map((item) => {
			const scalar = normalizeScalar(item);
			if (scalar === null) {
				throw clientError(
					"NOUMI_DB_INVALID_FILTER",
					"in() does not accept null; use is(column, null)",
				);
			}
			return scalar;
		});
	} else if (operator === "is" || operator === "is_not") {
		if (value !== null) {
			throw clientError("NOUMI_DB_INVALID_FILTER", `${operator} requires null`);
		}
		normalized = null;
	} else {
		normalized = normalizeScalar(value);
		if (normalized === null && !["eq", "neq"].includes(operator)) {
			throw clientError("NOUMI_DB_INVALID_FILTER", `${operator} does not accept null`);
		}
	}
	return {
		...state,
		filters: [...state.filters, { column, operator, value: normalized }],
	};
}

/** 为 builder 安装同一组 filter 方法。 */
abstract class FilterBuilder<Result, Self> extends FluentExecutable<Result> {
	protected abstract withState(state: FluentState): Self;

	eq(column: string, value: NoumiDbScalar): Self {
		return this.withState(appendFilter(this.state, column, "eq", value));
	}
	neq(column: string, value: NoumiDbScalar): Self {
		return this.withState(appendFilter(this.state, column, "neq", value));
	}
	gt(column: string, value: Exclude<NoumiDbScalar, null>): Self {
		return this.withState(appendFilter(this.state, column, "gt", value));
	}
	gte(column: string, value: Exclude<NoumiDbScalar, null>): Self {
		return this.withState(appendFilter(this.state, column, "gte", value));
	}
	lt(column: string, value: Exclude<NoumiDbScalar, null>): Self {
		return this.withState(appendFilter(this.state, column, "lt", value));
	}
	lte(column: string, value: Exclude<NoumiDbScalar, null>): Self {
		return this.withState(appendFilter(this.state, column, "lte", value));
	}
	in(
		column: string,
		values: readonly Exclude<NoumiDbScalar, null>[],
	): Self {
		return this.withState(appendFilter(this.state, column, "in", values));
	}
	is(column: string, value: null): Self {
		return this.withState(appendFilter(this.state, column, "is", value));
	}
	isNot(column: string, value: null): Self {
		return this.withState(appendFilter(this.state, column, "is_not", value));
	}
}

/** Select builder implementation。 */
class SelectBuilder<Row extends object>
	extends FilterBuilder<NoumiDbResult<Row[]>, NoumiSelectBuilder<Row>>
	implements NoumiSelectBuilder<Row> {
	constructor(transport: NoumiDbTransport, state: FluentState) {
		super(transport, state, false);
	}

	protected withState(state: FluentState): NoumiSelectBuilder<Row> {
		return new SelectBuilder<Row>(this.transport, state);
	}

	order(column: string, options: NoumiOrderOptions = {}): NoumiSelectBuilder<Row> {
		assertIdentifier(column, "column");
		return this.withState({
			...this.state,
			orders: [
				...this.state.orders,
				{ column, ascending: options.ascending !== false },
			],
		});
	}

	limit(count: number): NoumiSelectBuilder<Row> {
		if (!Number.isSafeInteger(count) || count < 0 || count > 1_000) {
			throw clientError("NOUMI_DB_LIMIT_EXCEEDED", "limit must be between 0 and 1000");
		}
		return this.withState({ ...this.state, limit: count, offset: undefined });
	}

	range(from: number, to: number): NoumiSelectBuilder<Row> {
		if (
			!Number.isSafeInteger(from) ||
			!Number.isSafeInteger(to) ||
			from < 0 ||
			to < from ||
			to - from + 1 > 1_000
		) {
			throw clientError("NOUMI_DB_LIMIT_EXCEEDED", "range is invalid");
		}
		return this.withState({
			...this.state,
			limit: to - from + 1,
			offset: from,
		});
	}

	single(): NoumiTerminalBuilder<NoumiDbResult<Row>> {
		if (this.state.offset !== undefined) {
			throw clientError(
				"NOUMI_DB_INVALID_REQUEST",
				"cardinality cannot be combined with range",
			);
		}
		return new FluentExecutable(this.transport, {
			...this.state,
			cardinality: "one",
			limit: undefined,
		}, false);
	}

	maybeSingle(): NoumiTerminalBuilder<NoumiDbResult<Row | null>> {
		if (this.state.offset !== undefined) {
			throw clientError(
				"NOUMI_DB_INVALID_REQUEST",
				"cardinality cannot be combined with range",
			);
		}
		return new FluentExecutable(this.transport, {
			...this.state,
			cardinality: "zero-or-one",
			limit: undefined,
		}, false);
	}
}

/** Insert/upsert builder implementation。 */
class InsertBuilder<Row extends object>
	extends FluentExecutable<NoumiDbResult<null>>
	implements NoumiInsertBuilder<Row> {
	constructor(transport: NoumiDbTransport, state: FluentState) {
		super(transport, state, true);
	}

	select(columns: NoumiDbColumns = "*"): NoumiReturningBuilder<Row> {
		return new ReturningBuilder<Row>(this.transport, {
			...this.state,
			columns: normalizeColumns(columns),
		});
	}
}

/** Guarded update/delete builder implementation。 */
class GuardedMutationBuilder<Row extends object>
	extends FilterBuilder<
		NoumiDbResult<null>,
		NoumiGuardedMutationBuilder<Row>
	>
	implements NoumiGuardedMutationBuilder<Row> {
	constructor(transport: NoumiDbTransport, state: FluentState) {
		super(transport, state, true);
	}

	protected withState(state: FluentState): NoumiGuardedMutationBuilder<Row> {
		return new GuardedMutationBuilder<Row>(this.transport, state);
	}

	select(columns: NoumiDbColumns = "*"): NoumiReturningBuilder<Row> {
		return new ReturningBuilder<Row>(this.transport, {
			...this.state,
			columns: normalizeColumns(columns),
		});
	}
}

/** Explicit full-table mutation implementation。 */
class AllMutationBuilder<Row extends object>
	extends FluentExecutable<NoumiDbResult<null>>
	implements NoumiAllMutationBuilder<Row> {
	constructor(transport: NoumiDbTransport, state: FluentState) {
		super(transport, state, true);
	}

	select(columns: NoumiDbColumns = "*"): NoumiReturningBuilder<Row> {
		return new ReturningBuilder<Row>(this.transport, {
			...this.state,
			columns: normalizeColumns(columns),
		});
	}
}

/** Mutation returning implementation。 */
class ReturningBuilder<Row extends object>
	extends FluentExecutable<NoumiDbResult<Row[]>>
	implements NoumiReturningBuilder<Row> {
	constructor(transport: NoumiDbTransport, state: FluentState) {
		super(transport, state, true);
	}

	single(): NoumiTerminalBuilder<NoumiDbResult<Row>> {
		return new FluentExecutable(this.transport, {
			...this.state,
			cardinality: "one",
		}, true);
	}

	maybeSingle(): NoumiTerminalBuilder<NoumiDbResult<Row | null>> {
		return new FluentExecutable(this.transport, {
			...this.state,
			cardinality: "zero-or-one",
		}, true);
	}
}

/** 未完成 guard 的 builder；读取 then 必须 fail-fast。 */
class MutationGuardBuilder<Row extends object>
	implements NoumiMutationGuardBuilder<Row> {
	constructor(
		private readonly transport: NoumiDbTransport,
		private readonly state: FluentState,
	) {}

	get then(): never {
		throw clientError(
			"NOUMI_DB_UNSAFE_MUTATION",
			"update/delete requires at least one filter or explicit all()",
		);
	}

	private withFilter(
		column: string,
		operator: FluentFilter["operator"],
		value: unknown,
	): NoumiGuardedMutationBuilder<Row> {
		return new GuardedMutationBuilder<Row>(
			this.transport,
			appendFilter(this.state, column, operator, value),
		);
	}

	eq(column: string, value: NoumiDbScalar): NoumiGuardedMutationBuilder<Row> {
		return this.withFilter(column, "eq", value);
	}
	neq(column: string, value: NoumiDbScalar): NoumiGuardedMutationBuilder<Row> {
		return this.withFilter(column, "neq", value);
	}
	gt(
		column: string,
		value: Exclude<NoumiDbScalar, null>,
	): NoumiGuardedMutationBuilder<Row> {
		return this.withFilter(column, "gt", value);
	}
	gte(
		column: string,
		value: Exclude<NoumiDbScalar, null>,
	): NoumiGuardedMutationBuilder<Row> {
		return this.withFilter(column, "gte", value);
	}
	lt(
		column: string,
		value: Exclude<NoumiDbScalar, null>,
	): NoumiGuardedMutationBuilder<Row> {
		return this.withFilter(column, "lt", value);
	}
	lte(
		column: string,
		value: Exclude<NoumiDbScalar, null>,
	): NoumiGuardedMutationBuilder<Row> {
		return this.withFilter(column, "lte", value);
	}
	in(
		column: string,
		values: readonly Exclude<NoumiDbScalar, null>[],
	): NoumiGuardedMutationBuilder<Row> {
		return this.withFilter(column, "in", values);
	}
	is(column: string, value: null): NoumiGuardedMutationBuilder<Row> {
		return this.withFilter(column, "is", value);
	}
	isNot(column: string, value: null): NoumiGuardedMutationBuilder<Row> {
		return this.withFilter(column, "is_not", value);
	}
	all(): NoumiAllMutationBuilder<Row> {
		return new AllMutationBuilder<Row>(this.transport, {
			...this.state,
			all: true,
		});
	}
}

/** Table ref implementation。 */
class TableRef<Row extends object> implements NoumiTableRef<Row> {
	constructor(
		private readonly transport: NoumiDbTransport,
		private readonly table: string,
	) {}

	select(columns: NoumiDbColumns = "*"): NoumiSelectBuilder<Row> {
		return new SelectBuilder<Row>(this.transport, {
			table: this.table,
			operation: "select",
			columns: normalizeColumns(columns),
			filters: [],
			orders: [],
		});
	}

	insert(row: Partial<Row> | readonly Partial<Row>[]): NoumiInsertBuilder<Row> {
		return new InsertBuilder<Row>(this.transport, {
			table: this.table,
			operation: "insert",
			body: normalizeMutationBody(row, true),
			filters: [],
			orders: [],
		});
	}

	update(patch: Partial<Row>): NoumiMutationGuardBuilder<Row> {
		return new MutationGuardBuilder<Row>(this.transport, {
			table: this.table,
			operation: "update",
			body: normalizeMutationBody(patch, false),
			filters: [],
			orders: [],
		});
	}

	upsert(
		row: Partial<Row> | readonly Partial<Row>[],
		options: NoumiUpsertOptions,
	): NoumiInsertBuilder<Row> {
		if (
			!options ||
			!Array.isArray(options.onConflict) ||
			options.onConflict.length === 0
		) {
			throw clientError(
				"NOUMI_DB_INVALID_REQUEST",
				"upsert onConflict must not be empty",
			);
		}
		for (const column of options.onConflict) assertIdentifier(column, "conflict column");
		if (new Set(options.onConflict).size !== options.onConflict.length) {
			throw clientError(
				"NOUMI_DB_INVALID_REQUEST",
				"upsert onConflict columns must be unique",
			);
		}
		return new InsertBuilder<Row>(this.transport, {
			table: this.table,
			operation: "upsert",
			body: normalizeMutationBody(row, true),
			filters: [],
			orders: [],
			onConflict: [...options.onConflict],
			resolution: options.ignoreDuplicates ? "ignore" : "merge",
		});
	}

	delete(): NoumiMutationGuardBuilder<Row> {
		return new MutationGuardBuilder<Row>(this.transport, {
			table: this.table,
			operation: "delete",
			filters: [],
			orders: [],
		});
	}
}

/** 扫描 SQL placeholder，同时忽略字符串、quoted identifier 和 comment。 */
function inspectSqlPlaceholders(statement: string): {
	anonymousCount: number;
	hasUnsupported: boolean;
} {
	let anonymousCount = 0;
	let hasUnsupported = false;
	let state: "code" | "single" | "double" | "backtick" | "bracket" | "line" | "block" =
		"code";
	for (let index = 0; index < statement.length; index += 1) {
		const character = statement[index]!;
		const next = statement[index + 1];
		if (state === "single") {
			if (character === "'" && next === "'") index += 1;
			else if (character === "'") state = "code";
			continue;
		}
		if (state === "double") {
			if (character === '"' && next === '"') index += 1;
			else if (character === '"') state = "code";
			continue;
		}
		if (state === "backtick") {
			if (character === "`" && next === "`") index += 1;
			else if (character === "`") state = "code";
			continue;
		}
		if (state === "bracket") {
			if (character === "]") state = "code";
			continue;
		}
		if (state === "line") {
			if (character === "\n" || character === "\r") state = "code";
			continue;
		}
		if (state === "block") {
			if (character === "*" && next === "/") {
				index += 1;
				state = "code";
			}
			continue;
		}
		if (character === "'") state = "single";
		else if (character === '"') state = "double";
		else if (character === "`") state = "backtick";
		else if (character === "[") state = "bracket";
		else if (character === "-" && next === "-") {
			index += 1;
			state = "line";
		} else if (character === "/" && next === "*") {
			index += 1;
			state = "block";
		} else if (character === "?") {
			if (next !== undefined && /[0-9]/.test(next)) hasUnsupported = true;
			else anonymousCount += 1;
		} else if (
			(character === ":" || character === "@" || character === "$") &&
			next !== undefined &&
			/[a-z0-9_]/i.test(next)
		) {
			hasUnsupported = true;
		}
	}
	return { anonymousCount, hasUnsupported };
}

/** 校验 SQL 文本和 bindings。 */
function normalizeSql(
	statement: string,
	bindings: readonly NoumiDbScalar[],
): { statement: string; bindings: NoumiDbScalar[] } {
	if (
		typeof statement !== "string" ||
		statement.trim().length === 0 ||
		statement.includes(";") ||
		statement.includes("\0") ||
		new TextEncoder().encode(statement).byteLength > MAX_SQL_BYTES
	) {
		throw clientError("NOUMI_DB_SQL_INVALID", "SQL statement is invalid");
	}
	if (!Array.isArray(bindings) || bindings.length > MAX_SQL_BINDINGS) {
		throw clientError("NOUMI_DB_LIMIT_EXCEEDED", "SQL bindings exceed the limit");
	}
	const normalizedBindings = bindings.map(normalizeScalar);
	const placeholders = inspectSqlPlaceholders(statement);
	if (placeholders.hasUnsupported) {
		throw clientError(
			"NOUMI_DB_SQL_INVALID",
			"only anonymous positional placeholders are supported",
		);
	}
	if (placeholders.anonymousCount !== normalizedBindings.length) {
		throw clientError(
			"NOUMI_DB_SQL_BINDING_MISMATCH",
			"SQL binding count does not match placeholders",
		);
	}
	return { statement, bindings: normalizedBindings };
}

/** 生成 SQL API Request。 */
function createSqlRequest(
	path: "query" | "execute",
	statement: string,
	bindings: readonly NoumiDbScalar[],
	allowFullTable: boolean,
	operationId: string | null,
): Request {
	const normalized = normalizeSql(statement, bindings);
	const headers = new Headers({
		accept: "application/json",
		"content-type": "application/json",
	});
	if (operationId) headers.set("x-noumi-db-operation-id", operationId);
	return new Request(`${NOUMI_DB_VIRTUAL_ORIGIN}/v1/sql/${path}`, {
		body: JSON.stringify({
			statement: normalized.statement,
			bindings: normalized.bindings,
			allowFullTable,
		}),
		headers,
		method: "POST",
	});
}

/** 创建浏览器公开 Noumi DB SDK。 */
export function createNoumiDatabase(
	transport: NoumiDbTransport,
	capabilities: NoumiDbCapabilities = UNAVAILABLE_CAPABILITIES,
): NoumiDatabase {
	if (typeof transport !== "function") {
		throw new TypeError("Noumi database transport must be a function");
	}
	if (
		capabilities.dbProtocolVersion !== 1 ||
		typeof capabilities.structuredCrud !== "boolean" ||
		typeof capabilities.sqlQuery !== "boolean" ||
		typeof capabilities.sqlExecute !== "boolean" ||
		typeof capabilities.operationRecovery !== "boolean"
	) {
		throw new TypeError("Noumi database capabilities are invalid");
	}
	return Object.freeze({
		capabilities: Object.freeze({ ...capabilities }),
		from<Row extends object = NoumiDbRow>(table: string): NoumiTableRef<Row> {
			assertIdentifier(table, "table");
			return new TableRef<Row>(transport, table);
		},
		sql: Object.freeze({
			async query<Row extends object = NoumiDbRow>(
				statement: string,
				bindings: readonly NoumiDbScalar[] = [],
				options?: NoumiSqlQueryOptions,
			): Promise<NoumiDbResult<Row[]>> {
				const request = createSqlRequest(
					"query",
					statement,
					bindings,
					false,
					null,
				);
				return await executeRequest<Row[]>(transport, request, options, null);
			},
			async execute<Row extends object = NoumiDbRow>(
				statement: string,
				bindings: readonly NoumiDbScalar[] = [],
				options?: NoumiSqlExecuteOptions,
			): Promise<NoumiDbResult<Row[] | null>> {
				const operationId = crypto.randomUUID();
				const request = createSqlRequest(
					"execute",
					statement,
					bindings,
					options?.allowFullTable === true,
					operationId,
				);
				return await executeRequest<Row[] | null>(
					transport,
					request,
					options,
					operationId,
				);
			},
		}) satisfies NoumiSql,
		operations: Object.freeze({
			async get<T = unknown>(
				operationId: string,
			): Promise<NoumiDbResult<NoumiDbOperationResult<T>>> {
				if (!UUID_PATTERN.test(operationId)) {
					throw clientError(
						"NOUMI_DB_INVALID_REQUEST",
						"operationId is invalid",
					);
				}
				const request = new Request(
					`${NOUMI_DB_VIRTUAL_ORIGIN}/v1/operations/${operationId}`,
					{ headers: { accept: "application/json" } },
				);
				return await executeRequest<NoumiDbOperationResult<T>>(
					transport,
					request,
					undefined,
					operationId,
				);
			},
		}) satisfies NoumiDbOperations,
	});
}
