import { describe, expect, test } from "bun:test";
import { render } from "@testing-library/react";
import { Coc7eCreationTabsBar } from "@/rules/coc7e/creation-tabs-bar";
import type { Coc7eValidationState } from "@/rules/coc7e/creation-validation";

const validation: Coc7eValidationState = {
	issues: [],
	warnings: [],
	blockers: [],
	tabCounts: {
		identity: 0,
		occupation: 0,
		skills: 1,
		background: 0,
		equipment: 0,
		experience: 0,
		review: 1,
	},
	tabHasBlocker: {
		identity: false,
		occupation: false,
		skills: false,
		background: false,
		equipment: false,
		experience: false,
		review: false,
	},
	filledBackgroundCount: 0,
	wornGearCount: 0,
	backpackGearCount: 0,
};

describe("creation tabs validation badge", () => {
	test("keeps the warning glyph and count separated", () => {
		const { container } = render(
			<Coc7eCreationTabsBar
				activeTab="skills"
				onSelectTab={() => undefined}
				validation={validation}
			/>,
		);
		const badge = container.querySelector('[data-slot="tab-issue-badge"]');
		expect(badge?.textContent).toBe("⚠1");
		expect(badge?.className).toContain("gap-1");
		expect(badge?.className).toContain("whitespace-nowrap");
	});
});
