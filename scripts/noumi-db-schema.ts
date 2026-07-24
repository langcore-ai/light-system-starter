import { Database } from "bun:sqlite";
import { open, readFile, readdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

/** Manifest identifier grammar。 */
const IDENTIFIER = /^[a-z][a-z0-9_]{0,62}$/;

/** Migration 文件名 grammar。 */
const MIGRATION_FILE =
	/^([0-9]{14})_([a-z][a-z0-9_]{0,62})\.sql$/;

/** 精确字段校验，避免 manifest 拼写错误被本地工具静默忽略。 */
function hasExactKeys(value: object, expectedKeys: readonly string[]): boolean {
	const actual = Object.keys(value).sort();
	const expected = [...expectedKeys].sort();
	return actual.length === expected.length &&
		actual.every((key, index) => key === expected[index]);
}

/** 确定性 JSON，必须与平台 schemaVersion 算法保持一致。 */
function canonicalJson(value: unknown): string {
	if (value === null || typeof value !== "object") return JSON.stringify(value);
	if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
	const record = value as Record<string, unknown>;
	return `{${Object.keys(record).sort().map((key) =>
		`${JSON.stringify(key)}:${canonicalJson(record[key])}`
	).join(",")}}`;
}

/** 计算 UTF-8 SHA-256。 */
async function sha256(value: string): Promise<string> {
	const digest = await crypto.subtle.digest(
		"SHA-256",
		new TextEncoder().encode(value),
	);
	return [...new Uint8Array(digest)]
		.map((byte) => byte.toString(16).padStart(2, "0"))
		.join("");
}

/** 校验并返回 manifest。 */
function parseManifest(value: unknown) {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		throw new Error("noumi.db.json must contain an object");
	}
	const manifest = value as Record<string, unknown>;
	if (
		!hasExactKeys(value, [
			"version",
			"dialect",
			"migrationsDir",
			"schemaVersion",
			"tables",
		]) ||
		manifest.version !== 1 ||
		manifest.dialect !== "sqlite" ||
		manifest.migrationsDir !== "db/migrations" ||
		typeof manifest.schemaVersion !== "string" ||
		!/^sha256:[0-9a-f]{64}$/.test(manifest.schemaVersion) ||
		!manifest.tables ||
		typeof manifest.tables !== "object" ||
		Array.isArray(manifest.tables)
	) {
		throw new Error("noumi.db.json has an invalid v1 shape");
	}
	for (const [tableName, rawTable] of Object.entries(manifest.tables)) {
		if (
			!IDENTIFIER.test(tableName) ||
			!rawTable ||
			typeof rawTable !== "object" ||
			Array.isArray(rawTable) ||
			!hasExactKeys(rawTable, [
				"fluentReadable",
				"fluentWritable",
				"sqlReadable",
				"sqlWritable",
				"columns",
			])
		) {
			throw new Error(`invalid table policy: ${tableName}`);
		}
		const table = rawTable as Record<string, unknown>;
		if (
			typeof table.fluentReadable !== "boolean" ||
			typeof table.fluentWritable !== "boolean" ||
			typeof table.sqlReadable !== "boolean" ||
			typeof table.sqlWritable !== "boolean" ||
			!table.columns ||
			typeof table.columns !== "object" ||
			Array.isArray(table.columns) ||
			Object.keys(table.columns).length === 0
		) {
			throw new Error(`invalid table policy: ${tableName}`);
		}
		for (const [columnName, rawColumn] of Object.entries(table.columns)) {
			if (
				!IDENTIFIER.test(columnName) ||
				!rawColumn ||
				typeof rawColumn !== "object" ||
				Array.isArray(rawColumn) ||
				!hasExactKeys(rawColumn, ["logicalType", "readable", "writable"])
			) {
				throw new Error(`invalid column policy: ${tableName}.${columnName}`);
			}
			const column = rawColumn as Record<string, unknown>;
			if (
				!["text", "integer", "real", "boolean", "json"].includes(
					String(column.logicalType),
				) ||
				typeof column.readable !== "boolean" ||
				typeof column.writable !== "boolean"
			) {
				throw new Error(`invalid column policy: ${tableName}.${columnName}`);
			}
		}
	}
	return manifest as {
		version: 1;
		dialect: "sqlite";
		migrationsDir: "db/migrations";
		schemaVersion: string;
		tables: Record<string, {
			fluentReadable: boolean;
			fluentWritable: boolean;
			sqlReadable: boolean;
			sqlWritable: boolean;
			columns: Record<string, {
				logicalType: "text" | "integer" | "real" | "boolean" | "json";
				readable: boolean;
				writable: boolean;
			}>;
		}>;
	};
}

/** 检查本地 SQLite declared affinity 与公开 logical type 是否兼容。 */
function assertLogicalTypeAffinity(
	tableName: string,
	columnName: string,
	declaredType: string,
	logicalType: "text" | "integer" | "real" | "boolean" | "json",
): void {
	const type = declaredType.toUpperCase();
	const compatible = logicalType === "integer" || logicalType === "boolean"
		? type.includes("INT")
		: logicalType === "real"
			? ["REAL", "FLOA", "DOUB", "NUM", "DEC"].some((part) =>
				type.includes(part)
			)
			: ["CHAR", "CLOB", "TEXT", "JSON", ""].some((part) =>
				part === "" ? type === "" : type.includes(part)
			);
	if (!compatible) {
		throw new Error(
			`logical type conflicts with SQLite affinity: ${tableName}.${columnName}`,
		);
	}
}

/** 对已经验证的 SQLite identifier 加引号。 */
function quote(identifier: string): string {
	if (!IDENTIFIER.test(identifier)) throw new Error(`invalid identifier: ${identifier}`);
	return `"${identifier}"`;
}

/** 读取源码、重放空库并生成与平台一致的 registry/hash。 */
async function generate(rootInput: string) {
	const root = resolve(rootInput);
	const manifestPath = resolve(root, "noumi.db.json");
	const manifest = parseManifest(JSON.parse(await readFile(manifestPath, "utf8")));
	const entries = (await readdir(resolve(root, manifest.migrationsDir), {
		withFileTypes: true,
	})).sort((left, right) => left.name.localeCompare(right.name));
	if (entries.length > 64) throw new Error("database contains too many migrations");
	const migrations: Array<{ id: string; checksum: string }> = [];
	const database = new Database(":memory:", { strict: true });
	try {
		database.exec("PRAGMA foreign_keys = ON");
		let previousId = "";
		let migrationBytes = 0;
		for (const entry of entries) {
			const match = entry.isFile() ? MIGRATION_FILE.exec(entry.name) : null;
			if (!match || match[1]! <= previousId) {
				throw new Error(`invalid or unordered migration: ${entry.name}`);
			}
			previousId = match[1]!;
			const rawSql = await readFile(
				resolve(root, manifest.migrationsDir, entry.name),
				"utf8",
			);
			if (!rawSql || rawSql.includes("\r") || rawSql.includes("\0")) {
				throw new Error(`migration must use non-empty LF UTF-8: ${entry.name}`);
			}
			const sql = rawSql.endsWith("\n") ? rawSql : `${rawSql}\n`;
			const bytes = new TextEncoder().encode(sql).byteLength;
			if (bytes > 256 * 1024) {
				throw new Error(`migration is too large: ${entry.name}`);
			}
			migrationBytes += bytes;
			if (migrationBytes > 1024 * 1024) {
				throw new Error("database migrations exceed total byte limit");
			}
			database.exec(sql);
			migrations.push({ id: previousId, checksum: await sha256(sql) });
		}
		if (database.query("PRAGMA integrity_check").values()[0]?.[0] !== "ok") {
			throw new Error("SQLite integrity check failed");
		}
		if (database.query("PRAGMA foreign_key_check").values().length !== 0) {
			throw new Error("SQLite foreign key check failed");
		}

		const tables: Record<string, unknown> = {};
		for (const tableName of Object.keys(manifest.tables).sort()) {
			if (!IDENTIFIER.test(tableName)) throw new Error(`invalid table: ${tableName}`);
			const policy = manifest.tables[tableName]!;
			const physical = database.query<{
				name: string;
				type: string;
				notnull: number;
				pk: number;
				hidden: number;
			}, []>(`PRAGMA table_xinfo(${quote(tableName)})`).all();
			if (physical.length === 0) throw new Error(`missing table: ${tableName}`);
			const byName = new Map(physical.map((column) => [column.name, column]));
			const columns = Object.keys(policy.columns).sort().map((columnName) => {
				const column = byName.get(columnName);
				const declared = policy.columns[columnName]!;
				if (!column || !IDENTIFIER.test(columnName)) {
					throw new Error(`missing column: ${tableName}.${columnName}`);
				}
				assertLogicalTypeAffinity(
					tableName,
					columnName,
					column.type,
					declared.logicalType,
				);
				if (column.hidden !== 0 && declared.writable) {
					throw new Error(`generated column cannot be writable: ${tableName}.${columnName}`);
				}
				return {
					name: columnName,
					logicalType: declared.logicalType,
					nullable: column.notnull === 0 && column.pk === 0,
					readable: declared.readable,
					writable: declared.writable,
					generated: column.hidden !== 0,
				};
			});
			const exposed = new Set(columns.map((column) => column.name));
			const primaryKey = physical.filter((column) => column.pk > 0)
				.sort((left, right) => left.pk - right.pk)
				.map((column) => column.name);
			if (
				primaryKey.length === 0 ||
				primaryKey.some((column) => !exposed.has(column))
			) {
				throw new Error(`table requires an exposed primary key: ${tableName}`);
			}
			const uniqueKeys = database.query<{
				name: string;
				origin: string;
				partial: number;
				unique: number;
			}, []>(`PRAGMA index_list(${quote(tableName)})`).all()
				.filter((index) =>
					index.unique === 1 && index.origin !== "pk" && index.partial === 0
				)
				.map((index) =>
					database.query<{ name: string; seqno: number }, []>(
						`PRAGMA index_info("${index.name.replaceAll("\"", "\"\"")}")`,
					).all().sort((left, right) => left.seqno - right.seqno)
						.map((column) => column.name)
				)
				.filter((key) => key.every((column) => exposed.has(column)))
				.sort((left, right) => left.join("\0").localeCompare(right.join("\0")));
			tables[tableName] = {
				name: tableName,
				columns,
				primaryKey,
				uniqueKeys,
				fluentReadable: policy.fluentReadable,
				fluentWritable: policy.fluentWritable,
				sqlReadable: policy.sqlReadable,
				sqlWritable: policy.sqlWritable,
			};
		}
		const schemaVersion = `sha256:${await sha256(canonicalJson({
			manifestVersion: manifest.version,
			migrations,
			tables,
		}))}`;
		return {
			manifest,
			manifestPath,
			schema: {
				tables,
				version: schemaVersion,
				migrationRevision: migrations.at(-1)?.id ?? null,
			},
		};
	} finally {
		database.close();
	}
}

/** UTC 14 位 migration ID。 */
function migrationId(): string {
	return new Date().toISOString().replaceAll(/\D/g, "").slice(0, 14);
}

/** CLI 入口。 */
async function main() {
	const [command, ...args] = process.argv.slice(2);
	if (command === "migration:new") {
		const slug = args[0];
		if (!slug || !/^[a-z][a-z0-9_]{0,62}$/.test(slug)) {
			throw new Error("usage: db:migration:new <snake_case_slug>");
		}
		const filePath = resolve("db/migrations", `${migrationId()}_${slug}.sql`);
		const file = await open(filePath, "wx");
		try {
			await file.writeFile("-- Noumi DB forward migration\n");
		} finally {
			await file.close();
		}
		console.log(filePath);
		return;
	}
	const generated = await generate(".");
	if (command === "schema:write") {
		await writeFile(generated.manifestPath, `${JSON.stringify({
			...generated.manifest,
			schemaVersion: generated.schema.version,
		}, null, 2)}\n`);
	} else if (command !== "validate") {
		throw new Error("usage: noumi-db-schema.ts <schema:write|validate|migration:new>");
	}
	if (
		command === "validate" &&
		generated.manifest.schemaVersion !== generated.schema.version
	) {
		throw new Error(`schemaVersion mismatch; run bun run db:schema:write`);
	}
	console.log(JSON.stringify(generated.schema, null, 2));
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
