import { useCallback, useEffect, useState } from "react";
import {
	Copy,
	Download,
	FileUp,
	FolderOpen,
	RefreshCw,
	Trash2,
} from "lucide-react";
import { Button } from "./components/ui/button";
import { Card } from "./components/ui/card";

/** Visible App Storage acceptance fixture. */
export function AppStorageTestPanel() {
	const [path, setPath] = useState("manual/hello.txt");
	const [text, setText] = useState("Hello from NoumiBridge.appStorage");
	const [file, setFile] = useState<File | null>(null);
	const [objects, setObjects] = useState<Noumi.AppStorageObject[]>([]);
	const [message, setMessage] = useState("No App Storage operation run yet");
	const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);
	const capabilities = window.NoumiBridge.appStorage.capabilities;

	/** Refresh the current Light System's object list. */
	const refresh = useCallback(async () => {
		if (!capabilities.read) {
			setMessage("The current member lacks App Storage read permission");
			return;
		}
		try {
			const page = await window.NoumiBridge.appStorage.list({ limit: 100 });
			setObjects(page.objects);
			setMessage(`Listed ${page.objects.length} object(s)`);
		} catch (error) {
			setMessage(error instanceof Error ? error.message : "App Storage list failed");
		}
	}, [capabilities.read]);

	useEffect(() => {
		void refresh();
	}, [refresh]);

	/** Run a fixture mutation serially to avoid redundant form concurrency. */
	async function mutate(action: () => Promise<void>) {
		setBusy(true);
		setDownloadUrl(null);
		try {
			await action();
			await refresh();
		} catch (error) {
			setMessage(error instanceof Error ? error.message : "App Storage operation failed");
		} finally {
			setBusy(false);
		}
	}

	/** Upload the selected binary file or current text. */
	function upload() {
		void mutate(async () => {
			const input = file ?? text;
			const uploaded = await window.NoumiBridge.appStorage.put(
				path,
				input,
				{
					contentType: file?.type || undefined,
					metadata: { fixture: "starter", source: file ? "file" : "text" },
				},
			);
			setMessage(`Uploaded ${uploaded.path} (${uploaded.size} bytes)`);
		});
	}

	/** Read the current path; refill text or show Blob metadata for binary content. */
	async function readCurrent() {
		setBusy(true);
		setDownloadUrl(null);
		try {
			const result = await window.NoumiBridge.appStorage.get(path);
			if (result.contentType.startsWith("text/")) {
				setText(await result.body.text());
			}
			setMessage(
				`Read ${result.path} (${result.body.size} bytes, ${result.contentType})`,
			);
		} catch (error) {
			setMessage(error instanceof Error ? error.message : "App Storage get failed");
		} finally {
			setBusy(false);
		}
	}

	/** Copy to an explicit new path to verify non-atomic move semantics. */
	function copyCurrent() {
		void mutate(async () => {
			const copied = await window.NoumiBridge.appStorage.copy(
				path,
				`${path}.copy`,
				{ overwrite: true },
			);
			setMessage(`Copied to ${copied.path}`);
		});
	}

	/** Create a short-lived one-time download URL. */
	async function createDownload() {
		setBusy(true);
		try {
			const download = await window.NoumiBridge.appStorage.createDownloadUrl(
				path,
				{ disposition: "attachment" },
			);
			setDownloadUrl(download.url);
			setMessage(`Download URL valid until ${download.expiresAt}`);
		} catch (error) {
			setMessage(error instanceof Error ? error.message : "Creating download URL failed");
		} finally {
			setBusy(false);
		}
	}

	/** Idempotently delete the current path. */
	function deleteCurrent() {
		void mutate(async () => {
			const result = await window.NoumiBridge.appStorage.delete(path);
			setMessage(result.deleted ? `Deleted ${path}` : `${path} did not exist`);
		});
	}

	return (
		<Card className="space-y-4 p-5">
			<div className="flex items-start gap-3">
				<div className="rounded-lg bg-primary/10 p-2 text-primary">
					<FolderOpen className="size-5" />
				</div>
				<div className="min-w-0">
					<h2 className="font-semibold">App Storage Test</h2>
					<p className="mt-1 text-sm leading-6 text-muted-foreground">
						Objects are isolated by Light System and survive deployments; file bytes use a short-lived ticket and do not enter Bridge JSON.
					</p>
				</div>
			</div>

			<div className="grid gap-3">
				<label className="grid gap-1 text-sm">
					<span className="font-medium">Logical path</span>
					<input
						className="min-w-0 rounded-md border bg-background px-3 py-2 outline-none ring-ring focus:ring-2"
						onChange={(event) => setPath(event.target.value)}
						value={path}
					/>
				</label>
				<label className="grid gap-1 text-sm">
					<span className="font-medium">Text content</span>
					<textarea
						className="min-h-24 resize-y rounded-md border bg-background px-3 py-2 outline-none ring-ring focus:ring-2"
						onChange={(event) => setText(event.target.value)}
						value={text}
					/>
				</label>
				<label className="grid gap-1 text-sm">
					<span className="font-medium">Or choose a binary file</span>
					<input
						className="min-w-0 rounded-md border bg-background px-3 py-2 text-sm"
						onChange={(event) => setFile(event.target.files?.[0] ?? null)}
						type="file"
					/>
				</label>
			</div>

			<div className="grid gap-2 sm:grid-cols-3">
				<Button
					disabled={busy || !capabilities.write || !path}
					onClick={upload}
					type="button"
				>
					<FileUp data-icon="inline-start" />Upload
				</Button>
				<Button
					disabled={busy || !capabilities.read || !path}
					onClick={() => void readCurrent()}
					type="button"
					variant="secondary"
				>
					<FolderOpen data-icon="inline-start" />Read
				</Button>
				<Button
					disabled={busy || !capabilities.read}
					onClick={() => void refresh()}
					type="button"
					variant="secondary"
				>
					<RefreshCw data-icon="inline-start" />Refresh list
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
					onClick={deleteCurrent}
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
						Download file
					</a>
				)}
				<ul className="mt-3 grid gap-1 text-xs">
					{objects.map((object) => (
						<li className="flex min-w-0 justify-between gap-3" key={object.path}>
							<button
								className="min-w-0 truncate text-left font-medium text-primary"
								onClick={() => setPath(object.path)}
								type="button"
							>
								{object.path}
							</button>
							<span className="shrink-0 text-muted-foreground">
								{object.size} bytes
							</span>
						</li>
					))}
				</ul>
			</div>
		</Card>
	);
}
