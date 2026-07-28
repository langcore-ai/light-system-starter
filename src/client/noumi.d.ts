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
import type {
	NoumiAppStorage as NoumiAppStorageSdk,
	NoumiAppStorageCopyOptions as NoumiAppStorageCopyOptionsSdk,
	NoumiAppStorageFile as NoumiAppStorageFileSdk,
	NoumiAppStorageGetOptions as NoumiAppStorageGetOptionsSdk,
	NoumiAppStorageListOptions as NoumiAppStorageListOptionsSdk,
	NoumiAppStorageListPage as NoumiAppStorageListPageSdk,
	NoumiAppStorageObject as NoumiAppStorageObjectSdk,
	NoumiAppStoragePutOptions as NoumiAppStoragePutOptionsSdk,
	NoumiAppStorageRequestOptions as NoumiAppStorageRequestOptionsSdk,
	NoumiFileCapabilities as NoumiFileCapabilitiesSdk,
	NoumiFileDownloadUrl as NoumiFileDownloadUrlSdk,
	NoumiFileDownloadUrlOptions as NoumiFileDownloadUrlOptionsSdk,
	NoumiFileInput as NoumiFileInputSdk,
	NoumiFileRange as NoumiFileRangeSdk,
	NoumiFileTransportError as NoumiFileTransportErrorSdk,
} from "../../scripts/noumi-app-storage";
import type {
	NoumiWorkspaceCopyOptions as NoumiWorkspaceCopyOptionsSdk,
	NoumiWorkspaceCreateDirectoryOptions as NoumiWorkspaceCreateDirectoryOptionsSdk,
	NoumiWorkspaceDownloadUrlOptions as NoumiWorkspaceDownloadUrlOptionsSdk,
	NoumiWorkspaceEntry as NoumiWorkspaceEntrySdk,
	NoumiWorkspaceFile as NoumiWorkspaceFileSdk,
	NoumiWorkspaceFiles as NoumiWorkspaceFilesSdk,
	NoumiWorkspaceListOptions as NoumiWorkspaceListOptionsSdk,
	NoumiWorkspaceListPage as NoumiWorkspaceListPageSdk,
	NoumiWorkspaceMoveOptions as NoumiWorkspaceMoveOptionsSdk,
	NoumiWorkspaceReadOptions as NoumiWorkspaceReadOptionsSdk,
	NoumiWorkspaceRemoveOptions as NoumiWorkspaceRemoveOptionsSdk,
	NoumiWorkspaceRemoveResult as NoumiWorkspaceRemoveResultSdk,
	NoumiWorkspaceRequestOptions as NoumiWorkspaceRequestOptionsSdk,
	NoumiWorkspaceTextFile as NoumiWorkspaceTextFileSdk,
	NoumiWorkspaceTextReadOptions as NoumiWorkspaceTextReadOptionsSdk,
	NoumiWorkspaceWriteOptions as NoumiWorkspaceWriteOptionsSdk,
} from "../../scripts/noumi-workspace-files";

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
	/** App Storage 支持的文件输入。 */
	type NoumiFileInput = NoumiFileInputSdk;
	/** App Storage 字节范围。 */
	type NoumiFileRange = NoumiFileRangeSdk;
	/** 当前成员可观测的文件能力。 */
	type NoumiFileCapabilities = NoumiFileCapabilitiesSdk;
	/** 短期文件下载 URL。 */
	type NoumiFileDownloadUrl = NoumiFileDownloadUrlSdk;
	/** 下载 URL 选项。 */
	type NoumiFileDownloadUrlOptions = NoumiFileDownloadUrlOptionsSdk;
	/** App Storage 对象 metadata。 */
	type NoumiAppStorageObject = NoumiAppStorageObjectSdk;
	/** 带 Blob 内容的 App Storage 文件。 */
	type NoumiAppStorageFile = NoumiAppStorageFileSdk;
	/** App Storage put 选项。 */
	type NoumiAppStoragePutOptions = NoumiAppStoragePutOptionsSdk;
	/** App Storage get 选项。 */
	type NoumiAppStorageGetOptions = NoumiAppStorageGetOptionsSdk;
	/** App Storage list 选项。 */
	type NoumiAppStorageListOptions = NoumiAppStorageListOptionsSdk;
	/** App Storage list 分页结果。 */
	type NoumiAppStorageListPage = NoumiAppStorageListPageSdk;
	/** App Storage copy 选项。 */
	type NoumiAppStorageCopyOptions = NoumiAppStorageCopyOptionsSdk;
	/** 只承载 AbortSignal 的 App Storage 通用选项。 */
	type NoumiAppStorageRequestOptions = NoumiAppStorageRequestOptionsSdk;
	/** Bridge、网络或响应协议失败。 */
	type NoumiFileTransportError = NoumiFileTransportErrorSdk;
	/** 当前轻系统独享的跨 deployment 对象存储。 */
	type NoumiAppStorage = NoumiAppStorageSdk;
	/** Workspace 公开节点。 */
	type NoumiWorkspaceEntry = NoumiWorkspaceEntrySdk;
	/** Workspace 二进制文件读取结果。 */
	type NoumiWorkspaceFile = NoumiWorkspaceFileSdk;
	/** Workspace UTF-8 文本读取结果。 */
	type NoumiWorkspaceTextFile = NoumiWorkspaceTextFileSdk;
	/** Workspace 文件读取选项。 */
	type NoumiWorkspaceReadOptions = NoumiWorkspaceReadOptionsSdk;
	/** Workspace 文本读取选项。 */
	type NoumiWorkspaceTextReadOptions = NoumiWorkspaceTextReadOptionsSdk;
	/** Workspace 目录分页选项。 */
	type NoumiWorkspaceListOptions = NoumiWorkspaceListOptionsSdk;
	/** Workspace 目录分页结果。 */
	type NoumiWorkspaceListPage = NoumiWorkspaceListPageSdk;
	/** Workspace 文件写入选项。 */
	type NoumiWorkspaceWriteOptions = NoumiWorkspaceWriteOptionsSdk;
	/** Workspace 目录创建选项。 */
	type NoumiWorkspaceCreateDirectoryOptions =
		NoumiWorkspaceCreateDirectoryOptionsSdk;
	/** Workspace move 选项。 */
	type NoumiWorkspaceMoveOptions = NoumiWorkspaceMoveOptionsSdk;
	/** Workspace copy 选项。 */
	type NoumiWorkspaceCopyOptions = NoumiWorkspaceCopyOptionsSdk;
	/** Workspace remove 选项。 */
	type NoumiWorkspaceRemoveOptions = NoumiWorkspaceRemoveOptionsSdk;
	/** Workspace remove 结果。 */
	type NoumiWorkspaceRemoveResult = NoumiWorkspaceRemoveResultSdk;
	/** Workspace 下载 URL 选项。 */
	type NoumiWorkspaceDownloadUrlOptions =
		NoumiWorkspaceDownloadUrlOptionsSdk;
	/** Workspace 通用请求选项。 */
	type NoumiWorkspaceRequestOptions = NoumiWorkspaceRequestOptionsSdk;
	/** 当前轻系统所属 Project 的 Workspace 文件 SDK。 */
	type NoumiWorkspaceFiles = NoumiWorkspaceFilesSdk;

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
		/** 当前页面的 best-effort 客户端错误诊断能力。 */
		diagnostics: NoumiDiagnostics;
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
		/** 按不可变 LightSystem.id 隔离、跨 deployment 保留的对象存储。 */
		readonly appStorage: NoumiAppStorage;
		/** 代表当前成员操作当前轻系统所属 Project 的 Workspace 文件。 */
		readonly workspaceFiles: NoumiWorkspaceFiles;
		/** 当前轻系统独享 SQLite 的受控 fluent/SQL 数据 API。 */
		db: NoumiDatabase;
	}

	/** 主动报告已被业务代码捕获的异常；该调用不等待网络且永不抛出上报错误。 */
	interface NoumiDiagnostics {
		reportError(error: unknown, options?: NoumiReportErrorOptions): void;
	}

	/** 主动上报的稳定、低基数诊断标签。 */
	interface NoumiReportErrorOptions {
		component?: string;
		operation?: string;
		tags?: Readonly<Record<string, string | number | boolean | null>>;
	}

	interface Window {
		/**
		 * 业务 bundle 执行前已完成初始化。
		 * 身份验证仍由主系统 Cookie/Session 负责，这里只包含显式只读上下文和受控能力。
		 */
		NoumiBridge: NoumiBridge;
		/** starter Error Boundary 专用内部入口，不属于公共 NoumiBridge API。 */
		__NOUMI_REPORT_REACT_ERROR__(
			error: unknown,
			componentStack: unknown,
		): void;
		__LIGHT_SYSTEM_REACT_SPA_READY__?: boolean;
	}
}
