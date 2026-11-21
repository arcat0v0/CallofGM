import { describe, expect, test } from "bun:test";
import { render, waitFor } from "@testing-library/react";
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

	test("slides the selection indicator when the active creation tab changes", async () => {
		const view = render(
			<Coc7eCreationTabsBar
				activeTab="identity"
				onSelectTab={() => undefined}
				validation={validation}
			/>,
		);
		const tablist = view.getByRole("tablist");
		Object.defineProperties(tablist, {
			offsetWidth: { value: 700, configurable: true },
			offsetHeight: { value: 56, configurable: true },
			clientWidth: { value: 700, configurable: true },
			clientHeight: { value: 56, configurable: true },
		});
		tablist.getBoundingClientRect = () => new DOMRect(0, 0, 700, 56);
		const tabs = view.getAllByRole("tab");
		for (const [index, tab] of tabs.entries()) {
			tab.getBoundingClientRect = () =>
				new DOMRect(6 + index * 98, 6, 94, 44);
		}
		view.rerender(
			<Coc7eCreationTabsBar
				activeTab="skills"
				onSelectTab={() => undefined}
				validation={validation}
			/>,
		);
		const indicator = tablist.querySelector(
			'[data-slot="selection-indicator"]',
		) as HTMLElement | null;
		expect(indicator).toBeTruthy();
		await waitFor(() => {
			expect(indicator?.style.left).toBe("202px");
		});
	});
});
