import type {
	NoumiDatabase as NoumiDatabaseSdk,
	NoumiDbCapabilities as NoumiDbCapabilitiesSdk,
	NoumiDbError as NoumiDbErrorSdk,
	NoumiDbFailure as NoumiDbFailureSdk,
	NoumiDbJson as NoumiDbJsonSdk,
	NoumiDbResult as NoumiDbResultSdk,
	NoumiDbRow as NoumiDbRowSdk,
	NoumiDbScalar as NoumiDbScalarSdk,
	NoumiDbSuccess as NoumiDbSuccessSdk,
} from "../../scripts/noumi-db-sdk";

declare global {
	/** Noumi DB 支持的标量。 */
	type NoumiDbScalar = NoumiDbScalarSdk;
	/** Noumi DB 支持的 JSON。 */
	type NoumiDbJson = NoumiDbJsonSdk;
	/** 默认数据库行形状。 */
	type NoumiDbRow = NoumiDbRowSdk;
	/** 当前 Browser Runtime/provider 数据库能力。 */
	type NoumiDbCapabilities = NoumiDbCapabilitiesSdk;
	/** 稳定数据库错误。 */
	type NoumiDbError = NoumiDbErrorSdk;
	/** 成功数据库结果。 */
	type NoumiDbSuccess<T> = NoumiDbSuccessSdk<T>;
	/** 失败数据库结果。 */
	type NoumiDbFailure = NoumiDbFailureSdk;
	/** 可通过 ok 判别的数据库结果。 */
	type NoumiDbResult<T> = NoumiDbResultSdk<T>;
	/** 当前轻系统的共享数据库 SDK。 */
	type NoumiDatabase = NoumiDatabaseSdk;

	/** 轻系统可见的成员信息。 */
	interface NoumiMember {
		/** 成员邮箱。 */
		email: string;
		/** 成员展示名。 */
		displayName: string | null;
	}

	/** 主平台通过可信 iframe Bridge 注入的轻系统能力。 */
	interface NoumiBridge {
		/** 当前轻系统信息。 */
		app: {
			/** 轻系统展示名称。 */
			name: string;
		};
		/** 创建当前轻系统的成员。 */
		createByMember: NoumiMember;
		/** 当前登录成员；公开匿名访问时为空。 */
		currentMember: NoumiMember | null;
		/** 与主前端 localStorage 隔离、按当前轻系统分区的异步浏览器存储。 */
		localStorage: {
			/** 写入字符串值。 */
			setItem(key: string, value: string): Promise<void>;
			/** 读取字符串值；键不存在时返回 null。 */
			getItem(key: string): Promise<string | null>;
			/** 删除一个键。 */
			removeItem(key: string): Promise<void>;
			/** 仅清空当前轻系统的全部键。 */
			clear(): Promise<void>;
			/** 返回当前轻系统的键数量。 */
			length(): Promise<number>;
			/** 返回当前轻系统的全部键。 */
			keys(): Promise<string[]>;
			/** 判断当前轻系统是否存在指定键。 */
			has(key: string): Promise<boolean>;
		};
		/** 当前轻系统独享 SQLite 的受控 fluent/SQL 数据 API。 */
		db: NoumiDatabase;
	}

	interface Window {
		/**
		 * 业务 bundle 执行前已完成初始化。
		 * 身份验证仍由主系统 Cookie/Session 负责，这里只包含显式只读上下文和受控能力。
		 */
		NoumiBridge: NoumiBridge;
	}
}
