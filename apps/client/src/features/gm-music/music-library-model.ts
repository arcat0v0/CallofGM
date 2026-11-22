import type { TrackDto } from "@cogm/shared";
import { t } from "@/i18n";
import { mediaUrl } from "@/lib/api";
import { formatDurationMmSs } from "@/lib/format";

/** 曲库里的一行：模组内列表的曲目可能没有 moduleName，全部曲目视图里一定有。 */
export type LibraryTrack = TrackDto & { moduleName?: string };

export type TrackTypeFilter = "all" | TrackDto["type"];
export type TrackSort = "added" | "name" | "duration";

/** URL 与存储里表示“全部曲目”的模组值。 */
export const ALL_MODULES = "all";

/** 短于该时长的上传文件默认记为音效，GM 可逐个改。 */
export const SE_GUESS_MAX_MS = 30_000;

export function guessTrackType(durationMs: number): TrackDto["type"] {
	return durationMs > 0 && durationMs <= SE_GUESS_MAX_MS ? "se" : "bgm";
}

export function filterTracks(
	tracks: readonly LibraryTrack[],
	filter: { type: TrackTypeFilter; query: string },
): LibraryTrack[] {
	const query = filter.query.trim().toLowerCase();
	return tracks.filter((track) => {
		if (filter.type !== "all" && track.type !== filter.type) {
			return false;
		}
		if (!query) {
			return true;
		}
		const haystack = [
			track.name,
			track.album ?? "",
			track.moduleName ?? "",
			...track.artists,
		]
			.join("\n")
			.toLowerCase();
		return haystack.includes(query);
	});
}

const collator = new Intl.Collator("zh-CN", { numeric: true });

export function sortTracks(
	tracks: readonly LibraryTrack[],
	sort: TrackSort,
): LibraryTrack[] {
	const next = [...tracks];
	if (sort === "name") {
		return next.sort((a, b) => collator.compare(a.name, b.name));
	}
	if (sort === "duration") {
		return next.sort((a, b) => b.duration - a.duration);
	}
	return next.sort((a, b) => b.createdAt - a.createdAt);
}

/** BGM 与 SE 各成一段（提示单的“幕”），段内保持传入顺序。 */
export function splitSections(tracks: readonly LibraryTrack[]) {
	return {
		bgm: tracks.filter((track) => track.type === "bgm"),
		se: tracks.filter((track) => track.type === "se"),
	};
}

export function libraryStats(tracks: readonly LibraryTrack[]) {
	return {
		count: tracks.length,
		totalMs: tracks.reduce((sum, track) => sum + track.duration, 0),
	};
}

/** 总时长：不足一小时 MM:SS，否则 H:MM:SS，与行内时间码同一种写法。 */
export function formatTotalDuration(totalMs: number): string {
	const total = Math.max(0, Math.floor(totalMs / 1000));
	const hours = Math.floor(total / 3600);
	const minutes = Math.floor((total % 3600) / 60);
	const seconds = total % 60;
	const mm = String(minutes).padStart(2, "0");
	const ss = String(seconds).padStart(2, "0");
	return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function trackSourceText(source: TrackDto["source"]): string {
	if (source === "netease") {
		return t("gm.workbench.trackSourceNetease");
	}
	if (source === "qq") {
		return t("gm.workbench.trackSourceQq");
	}
	return t("gm.workbench.trackSourceUpload");
}

/** 平台曲目的来源短标签；上传曲目没有，不写“上传”之类的填充。 */
export function trackSourceTag(track: Pick<TrackDto, "source">): string | null {
	if (track.source === "netease") {
		return t("gm.music.sourceNetease");
	}
	if (track.source === "qq") {
		return t("gm.music.sourceQq");
	}
	return null;
}

/**
 * 行的副信息：平台曲目写“艺术家 · 专辑”，上传的文件没有可用于找歌的
 * 信息，不写。全部曲目视图的所属模组由分组标尺表示，不再逐行重复。
 */
export function trackMetaParts(track: LibraryTrack): string[] {
	const parts: string[] = [];
	if (track.source !== "upload") {
		if (track.artists.length > 0) {
			parts.push(track.artists.join(" / "));
		}
		if (track.album) {
			parts.push(track.album);
		}
	}
	return parts;
}

export function trackDurationText(track: Pick<TrackDto, "duration">): string {
	return formatDurationMmSs(track.duration);
}

/** 模组搜索：按名称包含匹配，保持原有顺序。 */
export function filterModulesByQuery<T extends { name: string }>(
	modules: readonly T[],
	query: string,
): T[] {
	const needle = query.trim().toLowerCase();
	if (!needle) {
		return [...modules];
	}
	return modules.filter((module) => module.name.toLowerCase().includes(needle));
}

/** 试听地址：上传走媒体库，平台曲目走服务端代理流。 */
export function trackPlaybackPath(
	track: Pick<TrackDto, "id" | "source" | "audioAssetId">,
): string | null {
	if (track.source !== "upload") {
		return `/api/v1/music/tracks/${encodeURIComponent(track.id)}/stream`;
	}
	return mediaUrl(track.audioAssetId);
}
