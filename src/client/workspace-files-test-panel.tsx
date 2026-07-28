import { useCallback, useEffect, useState } from "react";
import {
	Copy,
	Download,
	FileText,
	FileUp,
	FolderOpen,
	FolderPlus,
	MoveRight,
	RefreshCw,
	Trash2,
} from "lucide-react";
import { Button } from "./components/ui/button";
import { Card } from "./components/ui/card";

/** 返回 Workspace path 的父目录；根目录下文件返回空字符串。 */
function parentDirectory(path: string): string {
	const separator = path.lastIndexOf("/");
	return separator < 0 ? "" : path.slice(0, separator);
}

/** starter fixture 的可见 Workspace Files 人工验收区域。 */
export function WorkspaceFilesTestPanel() {
	const [path, setPath] = useState("workspace-manual/hello.txt");
	const [text, setText] = useState(
		"Hello from NoumiBridge.workspaceFiles",
	);
	const [entries, setEntries] = useState<NoumiWorkspaceEntry[]>([]);
	const [message, setMessage] = useState("尚未执行 Workspace Files 操作");
	const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);
	const capabilities = window.NoumiBridge.workspaceFiles.capabilities;

	/** 列出当前 path 的父目录，方便观察同目录 move/copy 结果。 */
	const refresh = useCallback(async (
		options: { announce?: boolean } = {},
	) => {
		if (!capabilities.read) {
			setMessage("当前成员没有 Workspace Files read 权限");
			return;
		}
		const directory = parentDirectory(path);
		try {
			const page =
				await window.NoumiBridge.workspaceFiles.listDirectory(
					directory,
					{ limit: 100 },
				);
			setEntries(page.entries);
			if (options.announce !== false) {
				setMessage(
					`已列出 ${directory || "Workspace 根目录"} 的 ${page.entries.length} 个节点`,
				);
			}
		} catch (error) {
			setMessage(
				error instanceof Error
					? error.message
					: "Workspace Files list 失败",
			);
		}
	}, [capabilities.read, path]);

	useEffect(() => {
		void refresh();
	}, [refresh]);

	/** 串行执行一次人工操作，并在成功后刷新父目录。 */
	async function mutate(action: () => Promise<void>) {
		setBusy(true);
		setDownloadUrl(null);
		try {
			await action();
			// mutation 自己的结果比后台刷新提示更有用，因此刷新列表但保留结果消息。
			await refresh({ announce: false });
		} catch (error) {
			setMessage(
				error instanceof Error
					? error.message
					: "Workspace Files 操作失败",
			);
		} finally {
			setBusy(false);
		}
	}

	/** 递归创建当前 path 的父目录。 */
	function createParentDirectory() {
		const directory = parentDirectory(path);
		if (!directory) {
			setMessage("当前文件位于 Workspace 根目录，无需创建父目录");
			return;
		}
		void mutate(async () => {
			const existing =
				await window.NoumiBridge.workspaceFiles.stat(directory);
			if (existing?.type === "file") {
				throw new Error("父 path 已存在且不是目录");
			}
			const created = existing ??
				await window.NoumiBridge.workspaceFiles.createDirectory(
					directory,
					{ recursive: true },
				);
			setMessage(
				existing
					? `目录 ${created.path} 已存在`
					: `已创建目录 ${created.path}`,
			);
		});
	}

	/** 新建文件或用 stat 返回的 node/etag 做一次并发安全覆盖。 */
	function writeCurrent() {
		void mutate(async () => {
			const directory = parentDirectory(path);
			if (directory) {
				const parent =
					await window.NoumiBridge.workspaceFiles.stat(directory);
				if (parent?.type === "file") {
					throw new Error("父 path 已存在且不是目录");
				}
				if (!parent) {
					await window.NoumiBridge.workspaceFiles.createDirectory(
						directory,
						{ recursive: true },
					);
				}
			}
			const current =
				await window.NoumiBridge.workspaceFiles.stat(path);
			if (current?.type === "directory") {
				throw new Error("当前 path 是目录，不能写入文本");
			}
			const written =
				await window.NoumiBridge.workspaceFiles.writeFile(
					path,
					text,
					current?.etag
						? {
							contentType: "text/plain; charset=utf-8",
							overwrite: true,
							ifMatch: current.etag,
							expectedNodeId: current.id,
						}
						: {
							contentType: "text/plain; charset=utf-8",
							overwrite: Boolean(current),
						},
				);
			setMessage(
				`已写入 ${written.path}（${written.size ?? 0} bytes）`,
			);
		});
	}

	/** 严格按 UTF-8 读取当前文件。 */
	async function readCurrent() {
		setBusy(true);
		setDownloadUrl(null);
		try {
			const result =
				await window.NoumiBridge.workspaceFiles.readTextFile(path);
			setText(result.text);
			setMessage(
				`已读取 ${result.entry.path}（node ${result.entry.id}）`,
			);
		} catch (error) {
			setMessage(
				error instanceof Error
					? error.message
					: "Workspace Files read 失败",
			);
		} finally {
			setBusy(false);
		}
	}

	/** 移动当前节点，并把表单切换到新 path。 */
	function moveCurrent() {
		void mutate(async () => {
			const current = await window.NoumiBridge.workspaceFiles.stat(path);
			if (!current) throw new Error("当前 Workspace path 不存在");
			const destinationPath = `${path}.moved`;
			const moved = await window.NoumiBridge.workspaceFiles.move(
				path,
				destinationPath,
				current.etag
					? {
						overwrite: true,
						sourceIfMatch: current.etag,
						expectedSourceNodeId: current.id,
					}
					: { overwrite: true },
			);
			setPath(moved.path);
			setMessage(`已移动到 ${moved.path}`);
		});
	}

	/** 复制当前节点到显式新 path。 */
	function copyCurrent() {
		void mutate(async () => {
			const current = await window.NoumiBridge.workspaceFiles.stat(path);
			if (!current) throw new Error("当前 Workspace path 不存在");
			const copied = await window.NoumiBridge.workspaceFiles.copy(
				path,
				`${path}.copy`,
				current.etag
					? {
						overwrite: true,
						sourceIfMatch: current.etag,
						expectedSourceNodeId: current.id,
					}
					: { overwrite: true },
			);
			setMessage(`已复制到 ${copied.path}`);
		});
	}

	/** 创建绑定当前 node/etag 的一次性短期下载 URL。 */
	async function createDownload() {
		setBusy(true);
		try {
			const current = await window.NoumiBridge.workspaceFiles.stat(path);
			if (!current || current.type !== "file" || !current.etag) {
				throw new Error("当前 Workspace path 不是可下载文件");
			}
			const download =
				await window.NoumiBridge.workspaceFiles.createDownloadUrl(
					path,
					{
						disposition: "attachment",
						ifMatch: current.etag,
						expectedNodeId: current.id,
					},
				);
			setDownloadUrl(download.url);
			setMessage(`下载 URL 有效至 ${download.expiresAt}`);
		} catch (error) {
			setMessage(
				error instanceof Error
					? error.message
					: "创建 Workspace 下载 URL 失败",
			);
		} finally {
			setBusy(false);
		}
	}

	/** 删除当前节点；目录使用递归语义，Gateway 会复核整棵子树权限。 */
	function removeCurrent() {
		void mutate(async () => {
			const current = await window.NoumiBridge.workspaceFiles.stat(path);
			if (!current) {
				setMessage(`${path} 原本不存在`);
				return;
			}
			const result = await window.NoumiBridge.workspaceFiles.remove(
				path,
				{
					recursive: current.type === "directory",
					...(current.etag
						? {
							ifMatch: current.etag,
							expectedNodeId: current.id,
						}
						: {}),
				},
			);
			setMessage(
				`已删除 ${result.path}（${result.removedNodeCount} 个节点）`,
			);
		});
	}

	return (
		<Card className="space-y-4 p-5">
			<div className="flex items-start gap-3">
				<div className="rounded-lg bg-primary/10 p-2 text-primary">
					<FileText className="size-5" />
				</div>
				<div className="min-w-0">
					<h2 className="font-semibold">Workspace Files 测试</h2>
					<p className="mt-1 text-sm leading-6 text-muted-foreground">
						操作当前轻系统所属 Project 的协作文件；v1
						不配置轻系统专属权限，只沿用当前成员正常的 Workspace
						访问边界，文件内容继续进入 VFS 历史。
					</p>
				</div>
			</div>

			<div className="grid gap-3">
				<label className="grid gap-1 text-sm">
					<span className="font-medium">Workspace path</span>
					<input
						className="min-w-0 rounded-md border bg-background px-3 py-2 outline-none ring-ring focus:ring-2"
						onChange={(event) => setPath(event.target.value)}
						value={path}
					/>
				</label>
				<label className="grid gap-1 text-sm">
					<span className="font-medium">UTF-8 文本内容</span>
					<textarea
						className="min-h-24 resize-y rounded-md border bg-background px-3 py-2 outline-none ring-ring focus:ring-2"
						onChange={(event) => setText(event.target.value)}
						value={text}
					/>
				</label>
			</div>

			<div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
				<Button
					disabled={busy || !capabilities.write || !path}
					onClick={createParentDirectory}
					type="button"
					variant="secondary"
				>
					<FolderPlus data-icon="inline-start" />创建父目录
				</Button>
				<Button
					disabled={busy || !capabilities.write || !path}
					onClick={writeCurrent}
					type="button"
				>
					<FileUp data-icon="inline-start" />安全写入
				</Button>
				<Button
					disabled={busy || !capabilities.read || !path}
					onClick={() => void readCurrent()}
					type="button"
					variant="secondary"
				>
					<FolderOpen data-icon="inline-start" />读取文本
				</Button>
				<Button
					disabled={busy || !capabilities.read}
					onClick={() => void refresh()}
					type="button"
					variant="secondary"
				>
					<RefreshCw data-icon="inline-start" />列出父目录
				</Button>
				<Button
					disabled={busy || !capabilities.write || !path}
					onClick={moveCurrent}
					type="button"
					variant="secondary"
				>
					<MoveRight data-icon="inline-start" />移动
				</Button>
				<Button
					disabled={busy || !capabilities.write || !path}
					onClick={copyCurrent}
					type="button"
					variant="secondary"
				>
					<Copy data-icon="inline-start" />复制
				</Button>
				<Button
					disabled={busy || !capabilities.read || !path}
					onClick={() => void createDownload()}
					type="button"
					variant="secondary"
				>
					<Download data-icon="inline-start" />下载 URL
				</Button>
				<Button
					disabled={busy || !capabilities.write || !path}
					onClick={removeCurrent}
					type="button"
					variant="destructive"
				>
					<Trash2 data-icon="inline-start" />删除
				</Button>
			</div>

			<div className="rounded-lg border bg-muted/40 p-3">
				<p aria-live="polite" className="text-xs text-muted-foreground">
					{message}
				</p>
				{downloadUrl && (
					<a
						className="mt-2 inline-flex text-sm font-medium text-primary underline-offset-4 hover:underline"
						download
						href={downloadUrl}
						rel="noreferrer"
					>
						下载 Workspace 文件
					</a>
				)}
				<ul className="mt-3 grid gap-1 text-xs">
					{entries.map((entry) => (
						<li
							className="flex min-w-0 justify-between gap-3"
							key={entry.id}
						>
							<button
								className="min-w-0 truncate text-left font-medium text-primary"
								onClick={() => setPath(entry.path)}
								type="button"
							>
								{entry.path}
							</button>
							<span className="shrink-0 text-muted-foreground">
								{entry.type === "directory"
									? "目录"
									: `${entry.size ?? 0} bytes`}
							</span>
						</li>
					))}
				</ul>
			</div>
		</Card>
	);
}
