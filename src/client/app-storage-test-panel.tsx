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

/** starter fixture 的可见 App Storage 人工验收区域。 */
export function AppStorageTestPanel() {
	const [path, setPath] = useState("manual/hello.txt");
	const [text, setText] = useState("Hello from NoumiBridge.appStorage");
	const [file, setFile] = useState<File | null>(null);
	const [objects, setObjects] = useState<NoumiAppStorageObject[]>([]);
	const [message, setMessage] = useState("尚未执行 App Storage 操作");
	const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);
	const capabilities = window.NoumiBridge.appStorage.capabilities;

	/** 刷新当前 Light System 的对象列表。 */
	const refresh = useCallback(async () => {
		if (!capabilities.read) {
			setMessage("当前成员没有 App Storage read 权限");
			return;
		}
		try {
			const page = await window.NoumiBridge.appStorage.list({ limit: 100 });
			setObjects(page.objects);
			setMessage(`已列出 ${page.objects.length} 个对象`);
		} catch (error) {
			setMessage(error instanceof Error ? error.message : "App Storage list 失败");
		}
	}, [capabilities.read]);

	useEffect(() => {
		void refresh();
	}, [refresh]);

	/** 串行执行人工 mutation，避免同一个表单制造无意义并发。 */
	async function mutate(action: () => Promise<void>) {
		setBusy(true);
		setDownloadUrl(null);
		try {
			await action();
			await refresh();
		} catch (error) {
			setMessage(error instanceof Error ? error.message : "App Storage 操作失败");
		} finally {
			setBusy(false);
		}
	}

	/** 上传选中的二进制文件或当前文本。 */
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
			setMessage(`已上传 ${uploaded.path}（${uploaded.size} bytes）`);
		});
	}

	/** 读取当前 path；文本可直接回填，二进制显示 Blob 信息。 */
	async function readCurrent() {
		setBusy(true);
		setDownloadUrl(null);
		try {
			const result = await window.NoumiBridge.appStorage.get(path);
			if (result.contentType.startsWith("text/")) {
				setText(await result.body.text());
			}
			setMessage(
				`已读取 ${result.path}（${result.body.size} bytes, ${result.contentType}）`,
			);
		} catch (error) {
			setMessage(error instanceof Error ? error.message : "App Storage get 失败");
		} finally {
			setBusy(false);
		}
	}

	/** 复制到显式新 path，人工验证非原子 move 语义。 */
	function copyCurrent() {
		void mutate(async () => {
			const copied = await window.NoumiBridge.appStorage.copy(
				path,
				`${path}.copy`,
				{ overwrite: true },
			);
			setMessage(`已复制到 ${copied.path}`);
		});
	}

	/** 创建一次性短期下载 URL。 */
	async function createDownload() {
		setBusy(true);
		try {
			const download = await window.NoumiBridge.appStorage.createDownloadUrl(
				path,
				{ disposition: "attachment" },
			);
			setDownloadUrl(download.url);
			setMessage(`下载 URL 有效至 ${download.expiresAt}`);
		} catch (error) {
			setMessage(error instanceof Error ? error.message : "创建下载 URL 失败");
		} finally {
			setBusy(false);
		}
	}

	/** 幂等删除当前 path。 */
	function deleteCurrent() {
		void mutate(async () => {
			const result = await window.NoumiBridge.appStorage.delete(path);
			setMessage(result.deleted ? `已删除 ${path}` : `${path} 原本不存在`);
		});
	}

	return (
		<Card className="space-y-4 p-5">
			<div className="flex items-start gap-3">
				<div className="rounded-lg bg-primary/10 p-2 text-primary">
					<FolderOpen className="size-5" />
				</div>
				<div className="min-w-0">
					<h2 className="font-semibold">App Storage 测试</h2>
					<p className="mt-1 text-sm leading-6 text-muted-foreground">
						对象按当前 Light System 隔离并跨发布保留；文件字节直接走短期 ticket，不进入 Bridge JSON。
					</p>
				</div>
			</div>

			<div className="grid gap-3">
				<label className="grid gap-1 text-sm">
					<span className="font-medium">逻辑 path</span>
					<input
						className="min-w-0 rounded-md border bg-background px-3 py-2 outline-none ring-ring focus:ring-2"
						onChange={(event) => setPath(event.target.value)}
						value={path}
					/>
				</label>
				<label className="grid gap-1 text-sm">
					<span className="font-medium">文本内容</span>
					<textarea
						className="min-h-24 resize-y rounded-md border bg-background px-3 py-2 outline-none ring-ring focus:ring-2"
						onChange={(event) => setText(event.target.value)}
						value={text}
					/>
				</label>
				<label className="grid gap-1 text-sm">
					<span className="font-medium">或选择二进制文件</span>
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
					<FileUp data-icon="inline-start" />上传
				</Button>
				<Button
					disabled={busy || !capabilities.read || !path}
					onClick={() => void readCurrent()}
					type="button"
					variant="secondary"
				>
					<FolderOpen data-icon="inline-start" />读取
				</Button>
				<Button
					disabled={busy || !capabilities.read}
					onClick={() => void refresh()}
					type="button"
					variant="secondary"
				>
					<RefreshCw data-icon="inline-start" />刷新列表
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
					onClick={deleteCurrent}
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
						下载文件
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
