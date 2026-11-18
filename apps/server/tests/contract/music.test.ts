import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { MusicPlaylistDto, TrackDto } from "@cogm/shared";
import { type MusicService, MusicUnavailableError } from "@/modules/music";
import {
	closeWs,
	connectWs,
	listenTestApp,
	sendCommand,
	setSessionPhase,
	setupTestApp,
	stopServer,
	type TestContext,
	type TestServer,
} from "../helpers/setup";

const AUDIO = new TextEncoder().encode("abcdefgh");

class ControlledMusicService implements MusicService {
	async search(provider: "netease" | "qq", query: string) {
		return [this.metadata(provider, query, "unknown" as const)];
	}

	async resolve(provider: "netease" | "qq", reference: string) {
		if (reference === "unavailable") {
			throw new MusicUnavailableError();
		}
		return this.metadata(provider, reference, "available" as const);
	}

	async resolvePlaylist(
		provider: "netease" | "qq",
		reference: string,
		offset: number,
		limit: number,
	) {
		const items = Array.from({ length: 3 }, (_, index) =>
			this.metadata(provider, `${reference}-${index + 1}`, "unknown"),
		);
		return {
			provider,
			playlistId: provider === "netease" ? "3778678" : "9063620918",
			name: `${provider} public playlist`,
			coverUrl: null,
			description: "Public playlist description",
			creator: "Public creator",
			sourceUrl:
				provider === "netease"
					? "https://music.163.com/playlist?id=3778678"
					: "https://y.qq.com/n/ryqq/playlist/9063620918",
			totalCount: items.length,
			items: items.slice(offset, offset + limit),
			nextOffset: offset + limit < items.length ? offset + limit : null,
		};
	}

	async openStream(
		_provider: "netease" | "qq",
		_externalId: string,
		range?: string,
	) {
		const match = range?.match(/^bytes=(\d+)-(\d*)$/);
		if (!match) {
			return new Response(AUDIO, {
				headers: {
					"content-type": "audio/mpeg",
					"content-length": String(AUDIO.length),
				},
			});
		}
		const start = Number(match[1]);
		const end = match[2]
			? Math.min(Number(match[2]), AUDIO.length - 1)
			: AUDIO.length - 1;
		const body = AUDIO.slice(start, end + 1);
		return new Response(body, {
			status: 206,
			headers: {
				"content-type": "audio/mpeg",
				"content-length": String(body.length),
				"content-range": `bytes ${start}-${end}/${AUDIO.length}`,
				"accept-ranges": "bytes",
			},
		});
	}

	private metadata(
		provider: "netease" | "qq",
		reference: string,
		availability: "unknown" | "available",
	) {
		const externalId = provider === "netease" ? "1913586094" : "002rROE10ibMXN";
		return {
			provider,
			externalId,
			name: `${provider}-${reference}`,
			artists: ["Public Artist"],
			album: "Public Album",
			durationMs: 180000,
			sourceUrl:
				provider === "netease"
					? `https://music.163.com/song?id=${externalId}`
					: `https://y.qq.com/n/ryqq/songDetail/${externalId}`,
			availability,
		};
	}
}

describe("external music workflow", () => {
	let ctx: TestContext;
	let server: TestServer;
	let trackId = "";
	let seTrackId = "";

	function api(path: string, init: RequestInit & { token?: string } = {}) {
		const { token, ...requestInit } = init;
		return ctx.app.handle(
			new Request(`http://localhost${path}`, {
				...requestInit,
				headers: {
					...(requestInit.body ? { "content-type": "application/json" } : {}),
					...(token ? { authorization: `Bearer ${token}` } : {}),
					...requestInit.headers,
				},
			}),
		);
	}

	beforeAll(async () => {
		ctx = await setupTestApp({
			musicService: new ControlledMusicService(),
			players: ["listener", "outsider"],
			claims: [{ player: "listener", role: "ob" }],
		});
		server = listenTestApp(ctx.app);
	});

	afterAll(async () => {
		await stopServer(server);
		ctx.container.dbContext.sqlite.close();
	});

	test("requires GM authentication for search and resolution", async () => {
		const search = await api(
			"/api/v1/gm/music/search?provider=qq&query=test&limit=5",
		);
		expect(search.status).toBe(401);
		const resolved = await api("/api/v1/gm/music/resolve", {
			method: "POST",
			body: JSON.stringify({ provider: "qq", reference: "002rROE10ibMXN" }),
		});
		expect(resolved.status).toBe(401);
		const playlist = await api("/api/v1/gm/music/playlists/resolve", {
			method: "POST",
			body: JSON.stringify({ provider: "netease", reference: "3778678" }),
		});
		expect(playlist.status).toBe(401);
	});

	test("resolves trusted bounded playlist pages through the real app", async () => {
		const response = await api("/api/v1/gm/music/playlists/resolve", {
			method: "POST",
			token: ctx.gmToken,
			body: JSON.stringify({
				provider: "netease",
				reference: "https://music.163.com/playlist?id=3778678",
				offset: 1,
				limit: 2,
			}),
		});
		expect(response.status).toBe(200);
		const page = MusicPlaylistDto.parse(await response.json());
		expect(page).toMatchObject({
			provider: "netease",
			playlistId: "3778678",
			name: "netease public playlist",
			totalCount: 3,
			nextOffset: null,
		});
		expect(page.items).toHaveLength(2);
		expect(page.items.every((track) => track.availability === "unknown")).toBe(
			true,
		);

		const invalidLimit = await api("/api/v1/gm/music/playlists/resolve", {
			method: "POST",
			token: ctx.gmToken,
			body: JSON.stringify({
				provider: "netease",
				reference: "3778678",
				limit: 51,
			}),
		});
		expect(invalidLimit.status).toBe(400);

		const untrusted = await api("/api/v1/gm/music/playlists/resolve", {
			method: "POST",
			token: ctx.gmToken,
			headers: { origin: "https://untrusted.example" },
			body: JSON.stringify({ provider: "netease", reference: "3778678" }),
		});
		expect(untrusted.status).toBe(403);
	});

	test("searches, resolves and adds provider tracks as module resources", async () => {
		const search = await api(
			"/api/v1/gm/music/search?provider=netease&query=public&limit=5",
			{
				token: ctx.gmToken,
			},
		);
		expect(search.status).toBe(200);
		expect(await search.json()).toMatchObject({
			items: [
				{
					provider: "netease",
					externalId: "1913586094",
					availability: "unknown",
				},
			],
		});

		const resolved = await api("/api/v1/gm/music/resolve", {
			method: "POST",
			token: ctx.gmToken,
			body: JSON.stringify({
				provider: "netease",
				reference: "https://music.163.com/song?id=1913586094",
			}),
		});
		expect(resolved.status).toBe(200);
		expect(await resolved.json()).toMatchObject({
			availability: "available",
			durationMs: 180000,
		});

		const created = await api(`/api/v1/gm/modules/${ctx.moduleId}/tracks`, {
			method: "POST",
			token: ctx.gmToken,
			body: JSON.stringify({
				source: "netease",
				reference: "https://music.163.com/song?id=1913586094",
				type: "bgm",
			}),
		});
		expect(created.status).toBe(200);
		const track = TrackDto.parse(await created.json());
		trackId = track.id;
		expect(track).toMatchObject({
			source: "netease",
			externalId: "1913586094",
			audioAssetId: null,
			name: "netease-https://music.163.com/song?id=1913586094",
			artists: ["Public Artist"],
			album: "Public Album",
			duration: 180000,
			type: "bgm",
		});

		const se = await api(`/api/v1/gm/modules/${ctx.moduleId}/tracks`, {
			method: "POST",
			token: ctx.gmToken,
			body: JSON.stringify({
				source: "qq",
				reference: "002rROE10ibMXN",
				type: "se",
			}),
		});
		seTrackId = TrackDto.parse(await se.json()).id;

		const listed = await api(
			`/api/v1/gm/modules/${ctx.moduleId}/tracks?limit=20`,
			{
				token: ctx.gmToken,
			},
		);
		expect((await listed.json()).items).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ id: trackId, source: "netease" }),
				expect.objectContaining({ id: seTrackId, source: "qq" }),
			]),
		);
	});

	test("returns a stable unavailable error and never creates an unplayable track", async () => {
		const response = await api(`/api/v1/gm/modules/${ctx.moduleId}/tracks`, {
			method: "POST",
			token: ctx.gmToken,
			body: JSON.stringify({
				source: "netease",
				reference: "unavailable",
				type: "bgm",
			}),
		});
		expect(response.status).toBe(422);
		expect(await response.json()).toMatchObject({ code: "MUSIC_UNAVAILABLE" });
	});

	test("authorizes track streaming and preserves byte ranges", async () => {
		const path = `/api/v1/music/tracks/${trackId}/stream`;
		const gm = await api(path, {
			token: ctx.gmToken,
			headers: { range: "bytes=1-3" },
		});
		expect(gm.status).toBe(206);
		expect(gm.headers.get("content-range")).toBe("bytes 1-3/8");
		expect(new Uint8Array(await gm.arrayBuffer())).toEqual(
			new Uint8Array([98, 99, 100]),
		);

		const listener = await api(path, {
			token: ctx.playerTokens.get("listener"),
			headers: { range: "bytes=2-" },
		});
		expect(listener.status).toBe(206);
		expect(new Uint8Array(await listener.arrayBuffer())).toEqual(
			AUDIO.slice(2),
		);

		expect((await api(path)).status).toBe(401);
		expect(
			(await api(path, { token: ctx.playerTokens.get("outsider") })).status,
		).toBe(403);
	});

	test("keeps authoritative BGM, reconnect and SE semantics for provider tracks", async () => {
		await setSessionPhase(ctx, "free_discussion");
		const listenerToken = ctx.playerTokens.get("listener");
		if (!listenerToken) {
			throw new Error("Missing listener test token");
		}
		const url = `ws://127.0.0.1:${server.server.port}/api/v1/sessions/${ctx.sessionId}/ws`;
		const gm = await connectWs(url, ctx.gmToken);
		await gm.waitFor((message) => message.type === "snapshot");
		const listener = await connectWs(url, listenerToken);
		await listener.waitFor((message) => message.type === "snapshot");

		sendCommand(
			gm,
			"audio:bgm",
			{ action: "play", trackId, expectedVersion: 0 },
			"external-bgm",
		);
		const playing = await listener.waitFor(
			(message) => message.type === "audio:bgm",
		);
		expect(playing.payload.bgm).toMatchObject({
			trackId,
			source: "netease",
			audioAssetId: null,
			playbackUrl: `/api/v1/music/tracks/${trackId}/stream`,
			playing: true,
			version: 1,
		});
		sendCommand(
			gm,
			"audio:bgm",
			{ action: "pause", expectedVersion: 1 },
			"external-pause",
		);
		const paused = await gm.waitFor(
			(message) =>
				message.type === "audio:bgm" && message.payload.bgm.playing === false,
		);
		expect(paused.payload.bgm).toMatchObject({
			source: "netease",
			playbackUrl: `/api/v1/music/tracks/${trackId}/stream`,
			version: 2,
		});
		sendCommand(
			gm,
			"audio:bgm",
			{ action: "volume", volume: 45, expectedVersion: 2 },
			"external-volume",
		);
		const volume = await gm.waitFor(
			(message) =>
				message.type === "audio:bgm" && message.payload.bgm.volume === 45,
		);
		expect(volume.payload.bgm).toMatchObject({
			source: "netease",
			playbackUrl: `/api/v1/music/tracks/${trackId}/stream`,
			version: 3,
		});
		sendCommand(
			gm,
			"audio:bgm",
			{ action: "seek", seekOffsetMs: 12345, expectedVersion: 3 },
			"external-seek",
		);
		const sought = await gm.waitFor(
			(message) =>
				message.type === "audio:bgm" &&
				message.payload.bgm.seekOffsetMs === 12345,
		);
		expect(sought.payload.bgm).toMatchObject({
			source: "netease",
			playbackUrl: `/api/v1/music/tracks/${trackId}/stream`,
			version: 4,
		});
		await closeWs(listener);
		const reconnected = await connectWs(url, listenerToken);
		const snapshot = await reconnected.waitFor(
			(message) => message.type === "snapshot",
		);
		expect(snapshot.payload.bgm).toMatchObject({
			trackId,
			playing: false,
			version: 4,
			playbackUrl: `/api/v1/music/tracks/${trackId}/stream`,
		});
		expect(snapshot.payload.bgm.seekOffsetMs).toBe(12345);

		sendCommand(
			gm,
			"audio:se",
			{ trackId: seTrackId, volume: 70 },
			"external-se",
		);
		const se = await reconnected.waitFor(
			(message) => message.type === "audio:se",
		);
		expect(se.payload).toMatchObject({
			trackId: seTrackId,
			source: "qq",
			volume: 70,
			playbackUrl: `/api/v1/music/tracks/${seTrackId}/stream`,
		});
		await Promise.all([closeWs(gm), closeWs(reconnected)]);
	});
});
