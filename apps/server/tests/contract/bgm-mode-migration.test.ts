import { Database } from "bun:sqlite";
import { describe, expect, test } from "bun:test";
import { createDb } from "@/platform/db/client";
import { runMigrations } from "@/platform/db/migration";

describe("BGM mode migration", () => {
	test("the application migrator applies cleanly and does not rerun completed migrations", async () => {
		const context = createDb(":memory:");
		try {
			await runMigrations(context.db);
			const first = context.sqlite
				.query("SELECT count(*) AS count FROM __drizzle_migrations")
				.get();
			await runMigrations(context.db);
			expect(
				context.sqlite
					.query("SELECT count(*) AS count FROM __drizzle_migrations")
					.get(),
			).toEqual(first);
			expect(first).toEqual({ count: 8 });
			expect(context.sqlite.query("PRAGMA foreign_key_check").all()).toEqual(
				[],
			);
		} finally {
			context.sqlite.close();
		}
	});

	test("converts old flags without losing playback state or keeping the loop column", async () => {
		const folder = new URL("../../migrations/", import.meta.url);
		const database = new Database(":memory:");
		try {
			for (const name of [
				"0000_initial_multi_ruleset",
				"0001_eminent_vulcan",
				"0002_public_stryfe",
				"0003_big_shadowcat",
				"0004_dice_skin",
				"0005_lazy_xorn",
			]) {
				database.exec(await Bun.file(new URL(`${name}.sql`, folder)).text());
			}
			database.exec("PRAGMA foreign_keys=OFF");
			for (const loop of [0, 1]) {
				database
					.query(
						"INSERT INTO session_audio_state (id,session_id,track_id,playing,volume,loop,seek_offset_ms,started_at_ms,version,created_at) VALUES (?,?,?,1,70,?,1234,5678,9,1)",
					)
					.run(`audio-${loop}`, `session-${loop}`, "track", loop);
			}
			database.exec(
				await Bun.file(new URL("0006_bgm_playback_modes.sql", folder)).text(),
			);
			expect(
				database.query("SELECT * FROM session_audio_state ORDER BY id").all(),
			).toEqual([
				{
					id: "audio-0",
					session_id: "session-0",
					track_id: "track",
					playing: 1,
					volume: 70,
					mode: "off",
					seek_offset_ms: 1234,
					started_at_ms: 5678,
					version: 9,
					created_at: 1,
				},
				{
					id: "audio-1",
					session_id: "session-1",
					track_id: "track",
					playing: 1,
					volume: 70,
					mode: "single",
					seek_offset_ms: 1234,
					started_at_ms: 5678,
					version: 9,
					created_at: 1,
				},
			]);
		} finally {
			database.close();
		}
	});
});
