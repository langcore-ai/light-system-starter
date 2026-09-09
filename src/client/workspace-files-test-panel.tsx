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

/** Return the parent directory of a Workspace path; root-level files return an empty string. */
function parentDirectory(path: string): string {
	const separator = path.lastIndexOf("/");
	return separator < 0 ? "" : path.slice(0, separator);
}

/** Visible Workspace Files acceptance fixture. */
export function WorkspaceFilesTestPanel() {
	const [path, setPath] = useState("workspace-manual/hello.txt");
	const [text, setText] = useState(
		"Hello from NoumiBridge.workspaceFiles",
	);
	const [entries, setEntries] = useState<Noumi.WorkspaceEntry[]>([]);
	const [message, setMessage] = useState("No Workspace Files operation run yet");
	const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);
	const capabilities = window.NoumiBridge.workspaceFiles.capabilities;

	/** List the current path's parent directory to inspect same-directory move/copy results. */
	const refresh = useCallback(async (
		options: { announce?: boolean } = {},
	) => {
		if (!capabilities.read) {
			setMessage("The current member lacks Workspace Files read permission");
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
					`Listed ${page.entries.length} node(s) in ${directory || "Workspace root"}`,
				);
			}
		} catch (error) {
			setMessage(
				error instanceof Error
					? error.message
					: "Workspace Files list failed",
			);
		}
	}, [capabilities.read, path]);

	useEffect(() => {
		void refresh();
	}, [refresh]);

	/** Run one fixture operation serially and refresh the parent directory after success. */
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
					: "Workspace Files operation failed",
			);
		} finally {
			setBusy(false);
		}
	}

	/** Recursively create the parent directory of the current path. */
	function createParentDirectory() {
		const directory = parentDirectory(path);
		if (!directory) {
			setMessage("The current file is at the Workspace root; no parent directory is needed");
			return;
		}
		void mutate(async () => {
			const existing =
				await window.NoumiBridge.workspaceFiles.stat(directory);
			if (existing?.type === "file") {
				throw new Error("The parent path exists and is not a directory");
			}
			const created = existing ??
				await window.NoumiBridge.workspaceFiles.createDirectory(
					directory,
					{ recursive: true },
				);
			setMessage(
				existing
					? `Directory ${created.path} already exists`
					: `Created directory ${created.path}`,
			);
		});
	}

	/** Create a file or perform a concurrency-safe overwrite using the stat node/etag. */
	function writeCurrent() {
		void mutate(async () => {
			const directory = parentDirectory(path);
			if (directory) {
				const parent =
					await window.NoumiBridge.workspaceFiles.stat(directory);
				if (parent?.type === "file") {
					throw new Error("The parent path exists and is not a directory");
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
				throw new Error("The current path is a directory and cannot receive text");
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
				`Wrote ${written.path} (${written.size ?? 0} bytes)`,
			);
		});
	}

	/** Read the current file strictly as UTF-8. */
	async function readCurrent() {
		setBusy(true);
		setDownloadUrl(null);
		try {
			const result =
				await window.NoumiBridge.workspaceFiles.readTextFile(path);
			setText(result.text);
			setMessage(
				`Read ${result.entry.path} (node ${result.entry.id})`,
			);
		} catch (error) {
			setMessage(
				error instanceof Error
					? error.message
					: "Workspace Files read failed",
			);
		} finally {
			setBusy(false);
		}
	}

	/** Move the current node and switch the form to the new path. */
	function moveCurrent() {
		void mutate(async () => {
			const current = await window.NoumiBridge.workspaceFiles.stat(path);
			if (!current) throw new Error("The current Workspace path does not exist");
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
			setMessage(`Moved to ${moved.path}`);
		});
	}

	/** Copy the current node to an explicit new path. */
	function copyCurrent() {
		void mutate(async () => {
			const current = await window.NoumiBridge.workspaceFiles.stat(path);
			if (!current) throw new Error("The current Workspace path does not exist");
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
			setMessage(`Copied to ${copied.path}`);
		});
	}

	/** Create a short-lived download URL bound to the current node/etag. */
	async function createDownload() {
		setBusy(true);
		try {
			const current = await window.NoumiBridge.workspaceFiles.stat(path);
			if (!current || current.type !== "file" || !current.etag) {
				throw new Error("The current Workspace path is not a downloadable file");
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
			setMessage(`Download URL valid until ${download.expiresAt}`);
		} catch (error) {
			setMessage(
				error instanceof Error
					? error.message
					: "Creating the Workspace download URL failed",
			);
		} finally {
			setBusy(false);
		}
	}

	/** Delete the current node; directories use recursive semantics and the Gateway rechecks subtree access. */
	function removeCurrent() {
		void mutate(async () => {
			const current = await window.NoumiBridge.workspaceFiles.stat(path);
			if (!current) {
				setMessage(`${path} did not exist`);
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
				`Deleted ${result.path} (${result.removedNodeCount} node(s))`,
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
					<h2 className="font-semibold">Workspace Files Test</h2>
					<p className="mt-1 text-sm leading-6 text-muted-foreground">
						Operate on collaborative files in the Project owned by this Light System; v1
						has no Light System-specific permissions and uses the current member's normal Workspace
						access boundary, with file contents retained in VFS history.
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
					<span className="font-medium">UTF-8 text content</span>
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
					<FolderPlus data-icon="inline-start" />Create parent directory
				</Button>
				<Button
					disabled={busy || !capabilities.write || !path}
					onClick={writeCurrent}
					type="button"
				>
					<FileUp data-icon="inline-start" />Safe write
				</Button>
				<Button
					disabled={busy || !capabilities.read || !path}
					onClick={() => void readCurrent()}
					type="button"
					variant="secondary"
				>
					<FolderOpen data-icon="inline-start" />Read text
				</Button>
				<Button
					disabled={busy || !capabilities.read}
					onClick={() => void refresh()}
					type="button"
					variant="secondary"
				>
					<RefreshCw data-icon="inline-start" />List parent directory
				</Button>
				<Button
					disabled={busy || !capabilities.write || !path}
					onClick={moveCurrent}
					type="button"
					variant="secondary"
				>
					<MoveRight data-icon="inline-start" />Move
				</Button>
				<Button
					disabled={busy || !capabilities.write || !path}
					onClick={copyCurrent}
					type="button"
					variant="secondary"
				>
					<Copy data-icon="inline-start" />Copy
				</Button>
				<Button
					disabled={busy || !capabilities.read || !path}
					onClick={() => void createDownload()}
					type="button"
					variant="secondary"
				>
					<Download data-icon="inline-start" />Download URL
				</Button>
				<Button
					disabled={busy || !capabilities.write || !path}
					onClick={removeCurrent}
					type="button"
					variant="destructive"
				>
					<Trash2 data-icon="inline-start" />Delete
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
						Download Workspace file
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
									? "Directory"
									: `${entry.size ?? 0} bytes`}
							</span>
						</li>
					))}
				</ul>
			</div>
		</Card>
	);
}
