import { describe, expect, test } from "bun:test";
import { render } from "@testing-library/react";
import { SystemMessageCard } from "@/features/chat/system-message-card";

describe("phase record readability", () => {
	test("uses a high-contrast bounded label and brighter phase title", () => {
		const { container } = render(
			<SystemMessageCard
				message={{
					id: "phase-1",
					speakerName: "KP",
					speakerRoleLabel: "KP",
					avatarInitials: "K",
					avatarBg: "#1f1f1f",
					avatarFg: "#ffffff",
					body: "演绎时间",
					time: "13:06",
					phase: { label: "演绎时间" },
				}}
			/>,
		);
		const label = [...container.querySelectorAll("span")].find(
			(node) => node.textContent === "阶段 · 记录 / PHASE RECORD",
		);
		expect(label).toBeTruthy();
		expect(label?.className).toContain("border");
		expect(label?.className).toContain("font-semibold");
		const title = container.querySelector("h2");
		expect(title?.textContent).toBe("演绎时间");
		expect(title?.className).toContain("drop-shadow");
		const ornaments = [...container.querySelectorAll("[data-phase-ornament]")];
		expect(ornaments).toHaveLength(3);
		for (const ornament of ornaments) {
			expect((ornament as HTMLElement).style.maskImage).toContain(".svg");
		}
		expect(container.querySelector('img[src*="cthulhu/"]')).toBeNull();
	});
});
