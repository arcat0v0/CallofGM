import { Database } from "bun:sqlite";
import { describe, expect, test } from "bun:test";

describe("provider track migration", () => {
	test("preserves legacy and soft-deleted tracks as upload sources", async () => {
		const migrations = new URL("../../migrations/", import.meta.url);
		const db = new Database(":memory:");
		for (const name of [
			"0000_initial_multi_ruleset.sql",
			"0001_eminent_vulcan.sql",
			"0002_public_stryfe.sql",
			"0003_big_shadowcat.sql",
			"0004_dice_skin.sql",
		]) {
			db.exec(await Bun.file(new URL(name, migrations)).text());
		}
		db.exec("PRAGMA foreign_keys=OFF");
		db.query(
			"INSERT INTO tracks (id, module_id, name, audio_asset_id, type, duration, deleted_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
		).run("legacy-track", "module", "Legacy", "asset", "bgm", 1234, 99, 1);
		db.query(
			"INSERT INTO template_tracks (id, template_id, name, audio_asset_id, type, duration, deleted_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
		).run(
			"legacy-template-track",
			"template",
			"Template Legacy",
			"asset",
			"se",
			2345,
			null,
			2,
		);

		db.exec(await Bun.file(new URL("0005_lazy_xorn.sql", migrations)).text());
		expect(
			db.query("SELECT * FROM tracks WHERE id = ?").get("legacy-track"),
		).toMatchObject({
			name: "Legacy",
			source: "upload",
			external_id: null,
			artists_json: "[]",
			audio_asset_id: "asset",
			duration: 1234,
			deleted_at: 99,
		});
		expect(
			db
				.query("SELECT * FROM template_tracks WHERE id = ?")
				.get("legacy-template-track"),
		).toMatchObject({
			name: "Template Legacy",
			source: "upload",
			external_id: null,
			artists_json: "[]",
			audio_asset_id: "asset",
			duration: 2345,
			deleted_at: null,
		});
		db.close();
	});
});
