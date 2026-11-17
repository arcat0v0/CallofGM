import type { MusicProvider } from "@cogm/shared";
import { MusicReferenceInvalidError } from "../domain/music-errors";

export function parseMusicReference(
	provider: MusicProvider,
	reference: string,
): { externalId: string; sourceUrl: string } {
	const value = reference.trim();
	if (provider === "netease" && /^\d{1,20}$/.test(value)) {
		return {
			externalId: value,
			sourceUrl: `https://music.163.com/song?id=${value}`,
		};
	}
	if (provider === "qq" && /^[A-Za-z0-9]{14}$/.test(value)) {
		return {
			externalId: value,
			sourceUrl: `https://y.qq.com/n/ryqq/songDetail/${value}`,
		};
	}

	let url: URL;
	try {
		url = new URL(value);
	} catch {
		throw new MusicReferenceInvalidError();
	}
	if (
		(url.protocol !== "https:" && url.protocol !== "http:") ||
		url.username ||
		url.password ||
		url.port
	) {
		throw new MusicReferenceInvalidError();
	}

	if (provider === "netease") {
		if (
			url.hostname !== "music.163.com" &&
			url.hostname !== "y.music.163.com"
		) {
			throw new MusicReferenceInvalidError();
		}
		const hashId = url.hash.match(/^#\/song\?id=(\d{1,20})(?:&|$)/)?.[1];
		const outchainId = url.pathname.match(
			/^\/outchain\/2\/(\d{1,20})\/?$/,
		)?.[1];
		const pageId =
			url.pathname === "/song" || url.pathname === "/m/song"
				? url.searchParams.get("id")
				: null;
		const externalId = hashId ?? outchainId ?? pageId;
		if (!externalId || !/^\d{1,20}$/.test(externalId)) {
			throw new MusicReferenceInvalidError();
		}
		return {
			externalId,
			sourceUrl: `https://music.163.com/song?id=${externalId}`,
		};
	}

	if (url.hostname === "y.qq.com") {
		const externalId = url.pathname.match(
			/^\/n\/ryqq(?:_v2)?\/songDetail\/([A-Za-z0-9]{14})\/?$/,
		)?.[1];
		if (!externalId) {
			throw new MusicReferenceInvalidError();
		}
		return {
			externalId,
			sourceUrl: `https://y.qq.com/n/ryqq/songDetail/${externalId}`,
		};
	}
	if (url.hostname === "i.y.qq.com" && url.pathname === "/v8/playsong.html") {
		const externalId = url.searchParams.get("songmid");
		if (!externalId || !/^[A-Za-z0-9]{14}$/.test(externalId)) {
			throw new MusicReferenceInvalidError();
		}
		return {
			externalId,
			sourceUrl: `https://y.qq.com/n/ryqq/songDetail/${externalId}`,
		};
	}
	throw new MusicReferenceInvalidError();
}
