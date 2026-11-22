import type { TrackDto } from "@cogm/shared";
import { useCallback, useRef, useState } from "react";
import { audioDurationMs } from "@/lib/audio-duration";
import { api } from "@/lib/api";
import { errorText } from "@/lib/errors";
import { uploadMediaAsset } from "@/lib/media-upload";
import { guessTrackType } from "./music-library-model";

export type UploadStatus = "queued" | "uploading" | "done" | "failed";

export type UploadItem = {
	id: string;
	file: File;
	name: string;
	type: TrackDto["type"];
	durationMs: number;
	status: UploadStatus;
	error?: string;
};

const AUDIO_EXTENSIONS = /\.(mp3|wav|ogg|oga|opus|flac|m4a|aac|weba|webm)$/i;

export function isAudioFile(file: File): boolean {
	return file.type.startsWith("audio/") || AUDIO_EXTENSIONS.test(file.name);
}

function defaultName(file: File): string {
	return file.name.replace(/\.[^./\\]+$/, "").trim() || file.name;
}

/**
 * 多文件上传队列：逐个上传并建曲目，失败的留在队列里可以重试。
 * 类型默认按时长猜（短音频记为 SE），GM 手动改过的不再被覆盖。
 */
export function useUploadQueue({
	moduleId,
	onAdded,
}: {
	moduleId: string | null;
	onAdded: (track: TrackDto) => void;
}) {
	const [items, setItems] = useState<UploadItem[]>([]);
	const [busy, setBusy] = useState(false);
	const touchedType = useRef(new Set<string>());
	const counter = useRef(0);

	const patch = useCallback((id: string, next: Partial<UploadItem>) => {
		setItems((current) =>
			current.map((item) => (item.id === id ? { ...item, ...next } : item)),
		);
	}, []);

	const addFiles = useCallback(
		(files: readonly File[]) => {
			const audio = files.filter(isAudioFile);
			const added: UploadItem[] = audio.map((file) => ({
				id: `upload-${counter.current++}`,
				file,
				name: defaultName(file),
				type: "bgm",
				durationMs: 0,
				status: "queued",
			}));
			if (added.length > 0) {
				setItems((current) => [...current, ...added]);
			}
			for (const item of added) {
				void audioDurationMs(item.file).then((durationMs) => {
					setItems((current) =>
						current.map((entry) =>
							entry.id === item.id
								? {
										...entry,
										durationMs,
										type: touchedType.current.has(item.id)
											? entry.type
											: guessTrackType(durationMs),
									}
								: entry,
						),
					);
				});
			}
			return { accepted: audio.length, rejected: files.length - audio.length };
		},
		[],
	);

	const rename = useCallback(
		(id: string, name: string) => patch(id, { name }),
		[patch],
	);

	const retype = useCallback(
		(id: string, type: TrackDto["type"]) => {
			touchedType.current.add(id);
			patch(id, { type });
		},
		[patch],
	);

	const remove = useCallback((id: string) => {
		touchedType.current.delete(id);
		setItems((current) => current.filter((item) => item.id !== id));
	}, []);

	const submit = useCallback(async () => {
		if (!moduleId || busy) {
			return;
		}
		setBusy(true);
		try {
			const pending = items.filter(
				(item) => item.status === "queued" || item.status === "failed",
			);
			for (const item of pending) {
				patch(item.id, { status: "uploading", error: undefined });
				try {
					const audioAssetId = await uploadMediaAsset(item.file, "audio");
					const track = await api<TrackDto>(
						`/gm/modules/${encodeURIComponent(moduleId)}/tracks`,
						{
							method: "POST",
							body: JSON.stringify({
								name: item.name.trim() || defaultName(item.file),
								audioAssetId,
								type: item.type,
								duration: item.durationMs,
							}),
						},
					);
					patch(item.id, { status: "done" });
					onAdded(track);
				} catch (error) {
					patch(item.id, {
						status: "failed",
						error: errorText(error, "gm.music.uploadFailed"),
					});
				}
			}
		} finally {
			setBusy(false);
		}
	}, [busy, items, moduleId, onAdded, patch]);

	const reset = useCallback(() => {
		touchedType.current.clear();
		setItems([]);
	}, []);

	const pendingCount = items.filter(
		(item) => item.status === "queued" || item.status === "failed",
	).length;

	return {
		items,
		busy,
		pendingCount,
		addFiles,
		rename,
		retype,
		remove,
		submit,
		reset,
	};
}
