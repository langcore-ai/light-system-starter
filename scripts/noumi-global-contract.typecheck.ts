import type {
	NoumiDatabase as RuntimeDatabase,
	NoumiDbCapabilities as RuntimeDbCapabilities,
	NoumiDbError as RuntimeDbError,
	NoumiDbFailure as RuntimeDbFailure,
	NoumiDbJson as RuntimeDbJson,
	NoumiDbOperationResult as RuntimeDbOperationResult,
	NoumiDbOperations as RuntimeDbOperations,
	NoumiDbResult as RuntimeDbResult,
	NoumiDbRow as RuntimeDbRow,
	NoumiDbScalar as RuntimeDbScalar,
	NoumiDbSuccess as RuntimeDbSuccess,
} from "./noumi-db-sdk";
import type {
	NoumiAppStorage as RuntimeAppStorage,
	NoumiAppStorageCopyOptions as RuntimeAppStorageCopyOptions,
	NoumiAppStorageFile as RuntimeAppStorageFile,
	NoumiAppStorageGetOptions as RuntimeAppStorageGetOptions,
	NoumiAppStorageListOptions as RuntimeAppStorageListOptions,
	NoumiAppStorageListPage as RuntimeAppStorageListPage,
	NoumiAppStorageObject as RuntimeAppStorageObject,
	NoumiAppStoragePutOptions as RuntimeAppStoragePutOptions,
	NoumiAppStorageRequestOptions as RuntimeAppStorageRequestOptions,
	NoumiFileCapabilities as RuntimeFileCapabilities,
	NoumiFileDownloadUrl as RuntimeFileDownloadUrl,
	NoumiFileDownloadUrlOptions as RuntimeFileDownloadUrlOptions,
	NoumiFileInput as RuntimeFileInput,
	NoumiFileRange as RuntimeFileRange,
	NoumiFileTransportError as RuntimeFileTransportError,
} from "./noumi-app-storage";
import type {
	NoumiWorkspaceCopyOptions as RuntimeWorkspaceCopyOptions,
	NoumiWorkspaceCreateDirectoryOptions as RuntimeWorkspaceCreateDirectoryOptions,
	NoumiWorkspaceDownloadUrlOptions as RuntimeWorkspaceDownloadUrlOptions,
	NoumiWorkspaceEntry as RuntimeWorkspaceEntry,
	NoumiWorkspaceFile as RuntimeWorkspaceFile,
	NoumiWorkspaceFiles as RuntimeWorkspaceFiles,
	NoumiWorkspaceListOptions as RuntimeWorkspaceListOptions,
	NoumiWorkspaceListPage as RuntimeWorkspaceListPage,
	NoumiWorkspaceMoveOptions as RuntimeWorkspaceMoveOptions,
	NoumiWorkspaceReadOptions as RuntimeWorkspaceReadOptions,
	NoumiWorkspaceRemoveOptions as RuntimeWorkspaceRemoveOptions,
	NoumiWorkspaceRemoveResult as RuntimeWorkspaceRemoveResult,
	NoumiWorkspaceRequestOptions as RuntimeWorkspaceRequestOptions,
	NoumiWorkspaceTextFile as RuntimeWorkspaceTextFile,
	NoumiWorkspaceTextReadOptions as RuntimeWorkspaceTextReadOptions,
	NoumiWorkspaceWriteOptions as RuntimeWorkspaceWriteOptions,
} from "./noumi-workspace-files";
import type {
	NoumiOutsideDatabase as RuntimeOutsideDatabase,
	NoumiOutsideDbCapabilities as RuntimeOutsideDbCapabilities,
	NoumiOutsideDbFactory as RuntimeOutsideDbFactory,
	NoumiOutsideDbFailure as RuntimeOutsideDbFailure,
	NoumiOutsideDbInputValue as RuntimeOutsideDbInputValue,
	NoumiOutsideDbJson as RuntimeOutsideDbJson,
	NoumiOutsideDbResult as RuntimeOutsideDbResult,
	NoumiOutsideDbRow as RuntimeOutsideDbRow,
	NoumiOutsideDbSqlOptions as RuntimeOutsideDbSqlOptions,
	NoumiOutsideDbStatementResult as RuntimeOutsideDbStatementResult,
	NoumiOutsideDbSuccess as RuntimeOutsideDbSuccess,
	NoumiOutsideDbTaggedValue as RuntimeOutsideDbTaggedValue,
	NoumiOutsideDbTransportError as RuntimeOutsideDbTransportError,
	NoumiOutsideDbValue as RuntimeOutsideDbValue,
} from "./noumi-outside-db";

/** 判断两个公开类型是否双向兼容。 */
type IsEquivalent<Left, Right> = [Left] extends [Right]
	? [Right] extends [Left]
		? true
		: false
	: false;

/** 在编译期拒绝声明文件与 Runtime SDK 发生结构漂移。 */
type AssertEquivalent<Value extends true> = Value;

/** App Storage 全局声明的完整公共结构。 */
type GlobalAppStorageContract = {
	capabilities: FileCapabilities;
	input: FileInput;
	range: FileRange;
	download: FileDownloadUrl;
	downloadOptions: FileDownloadUrlOptions;
	object: AppStorageObject;
	file: AppStorageFile;
	putOptions: AppStoragePutOptions;
	getOptions: AppStorageGetOptions;
	listOptions: AppStorageListOptions;
	listPage: AppStorageListPage;
	copyOptions: AppStorageCopyOptions;
	requestOptions: AppStorageRequestOptions;
	transportError: FileTransportError;
	storage: AppStorage;
};

/** Runtime App Storage SDK 的同一公共结构。 */
type RuntimeAppStorageContract = {
	capabilities: RuntimeFileCapabilities;
	input: RuntimeFileInput;
	range: RuntimeFileRange;
	download: RuntimeFileDownloadUrl;
	downloadOptions: RuntimeFileDownloadUrlOptions;
	object: RuntimeAppStorageObject;
	file: RuntimeAppStorageFile;
	putOptions: RuntimeAppStoragePutOptions;
	getOptions: RuntimeAppStorageGetOptions;
	listOptions: RuntimeAppStorageListOptions;
	listPage: RuntimeAppStorageListPage;
	copyOptions: RuntimeAppStorageCopyOptions;
	requestOptions: RuntimeAppStorageRequestOptions;
	transportError: RuntimeFileTransportError;
	storage: RuntimeAppStorage;
};

/** Workspace Files 全局声明的完整公共结构。 */
type GlobalWorkspaceContract = {
	entry: WorkspaceEntry;
	file: WorkspaceFile;
	textFile: WorkspaceTextFile;
	readOptions: WorkspaceReadOptions;
	textReadOptions: WorkspaceTextReadOptions;
	listOptions: WorkspaceListOptions;
	listPage: WorkspaceListPage;
	writeOptions: WorkspaceWriteOptions;
	createDirectoryOptions: WorkspaceCreateDirectoryOptions;
	moveOptions: WorkspaceMoveOptions;
	copyOptions: WorkspaceCopyOptions;
	removeOptions: WorkspaceRemoveOptions;
	removeResult: WorkspaceRemoveResult;
	downloadOptions: WorkspaceDownloadUrlOptions;
	requestOptions: WorkspaceRequestOptions;
	files: WorkspaceFiles;
};

/** Runtime Workspace Files SDK 的同一公共结构。 */
type RuntimeWorkspaceContract = {
	entry: RuntimeWorkspaceEntry;
	file: RuntimeWorkspaceFile;
	textFile: RuntimeWorkspaceTextFile;
	readOptions: RuntimeWorkspaceReadOptions;
	textReadOptions: RuntimeWorkspaceTextReadOptions;
	listOptions: RuntimeWorkspaceListOptions;
	listPage: RuntimeWorkspaceListPage;
	writeOptions: RuntimeWorkspaceWriteOptions;
	createDirectoryOptions: RuntimeWorkspaceCreateDirectoryOptions;
	moveOptions: RuntimeWorkspaceMoveOptions;
	copyOptions: RuntimeWorkspaceCopyOptions;
	removeOptions: RuntimeWorkspaceRemoveOptions;
	removeResult: RuntimeWorkspaceRemoveResult;
	downloadOptions: RuntimeWorkspaceDownloadUrlOptions;
	requestOptions: RuntimeWorkspaceRequestOptions;
	files: RuntimeWorkspaceFiles;
};

/** 外部数据库全局声明的完整公共结构。 */
type GlobalOutsideDatabaseContract = {
	capabilities: OutsideDbCapabilities;
	json: OutsideDbJson;
	tagged: OutsideDbTaggedValue;
	input: OutsideDbInputValue;
	value: OutsideDbValue;
	row: OutsideDbRow;
	statement: OutsideDbStatementResult<{ id: string }>;
	options: OutsideDbSqlOptions;
	success: OutsideDbSuccess<{ id: string }>;
	failure: OutsideDbFailure;
	result: OutsideDbResult<{ id: string }>;
	database: OutsideDatabase;
	factory: OutsideDbFactory;
	transportError: OutsideDbTransportError;
};

/** Runtime 外部数据库 SDK 的同一公共结构。 */
type RuntimeOutsideDatabaseContract = {
	capabilities: RuntimeOutsideDbCapabilities;
	json: RuntimeOutsideDbJson;
	tagged: RuntimeOutsideDbTaggedValue;
	input: RuntimeOutsideDbInputValue;
	value: RuntimeOutsideDbValue;
	row: RuntimeOutsideDbRow;
	statement: RuntimeOutsideDbStatementResult<{ id: string }>;
	options: RuntimeOutsideDbSqlOptions;
	success: RuntimeOutsideDbSuccess<{ id: string }>;
	failure: RuntimeOutsideDbFailure;
	result: RuntimeOutsideDbResult<{ id: string }>;
	database: RuntimeOutsideDatabase;
	factory: RuntimeOutsideDbFactory;
	transportError: RuntimeOutsideDbTransportError;
};

/** 修改任一 Runtime 公开类型时，以下契约必须继续全部成立。 */
type _DatabaseScalarMatches = AssertEquivalent<
	IsEquivalent<DbScalar, RuntimeDbScalar>
>;
type _DatabaseJsonMatches = AssertEquivalent<
	IsEquivalent<DbJson, RuntimeDbJson>
>;
type _DatabaseRowMatches = AssertEquivalent<
	IsEquivalent<DbRow, RuntimeDbRow>
>;
type _DatabaseCapabilitiesMatch = AssertEquivalent<
	IsEquivalent<DbCapabilities, RuntimeDbCapabilities>
>;
type _DatabaseErrorMatches = AssertEquivalent<
	IsEquivalent<DbError, RuntimeDbError>
>;
type _DatabaseSuccessMatches = AssertEquivalent<
	IsEquivalent<DbSuccess<{ id: string }>, RuntimeDbSuccess<{ id: string }>>
>;
type _DatabaseFailureMatches = AssertEquivalent<
	IsEquivalent<DbFailure, RuntimeDbFailure>
>;
type _DatabaseResultMatches = AssertEquivalent<
	IsEquivalent<DbResult<{ id: string }>, RuntimeDbResult<{ id: string }>>
>;
type _DatabaseSdkWithoutOperationsMatches = AssertEquivalent<
	IsEquivalent<
		Omit<Database, "operations">,
		Omit<RuntimeDatabase, "operations">
	>
>;
type _DatabaseOperationResultMatches = AssertEquivalent<
	IsEquivalent<
		DbOperationResult<{ id: string }>,
		RuntimeDbOperationResult<{ id: string }>
	>
>;
type _DatabaseDefaultOperationGetMatches = AssertEquivalent<
	IsEquivalent<
		ReturnType<DbOperations["get"]>,
		ReturnType<RuntimeDbOperations["get"]>
	>
>;
type _AppStorageContractMatches = AssertEquivalent<
	IsEquivalent<GlobalAppStorageContract, RuntimeAppStorageContract>
>;
type _WorkspaceContractMatches = AssertEquivalent<
	IsEquivalent<GlobalWorkspaceContract, RuntimeWorkspaceContract>
>;
type _OutsideDatabaseContractMatches = AssertEquivalent<
	IsEquivalent<GlobalOutsideDatabaseContract, RuntimeOutsideDatabaseContract>
>;
