import { describe, expect, test } from "bun:test";

const root = new URL("../", import.meta.url);

async function source(path: string): Promise<string> {
	return Bun.file(new URL(path, root)).text();
}

describe("version entry placement", () => {
	test("is not mounted globally or in the play room", async () => {
		const files = [
			"src/routes/__root.tsx",
			"src/routes/play.$sessionId.tsx",
			"src/features/play/play-view.tsx",
			"src/features/play/play-overlays.tsx",
			"src/features/session-stage/dialogue-box.tsx",
			"src/themes/default/slots/play-layout.tsx",
			"src/themes/default/slots/play-stage.tsx",
			"src/themes/default/slots/play-dialogue.tsx",
		];
		for (const file of files) {
			expect(await source(file)).not.toContain("VersionBadge");
		}
	});

	test("is mounted only on the approved non-play surfaces", async () => {
		const files = [
			"src/routes/index.tsx",
			"src/routes/login.tsx",
			"src/routes/join.$sessionId.tsx",
			"src/features/gm-admin/admin-layout.tsx",
			"src/features/gm-console/gm-top-bar.tsx",
		];
		for (const file of files) {
			expect(await source(file)).toContain("VersionBadge");
		}
	});
});
