import { afterEach, beforeEach, expect, spyOn, test } from "bun:test";
import { dnd5r, type SnapshotCharacter } from "@cogm/shared";
import {
	createMemoryHistory,
	createRootRoute,
	createRoute,
	createRouter,
	RouterProvider,
} from "@tanstack/react-router";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { CharacterPermanentFieldDialog } from "../src/features/gm-console/character-permanent-field-dialog";
import { CharactersPanel } from "../src/features/gm-console/characters-panel";
import { CharacterStateCard } from "../src/features/gm-console/gm-panel-stage";
import { GmToolProvider } from "../src/features/gm-console/gm-tool-context";
import { Route as CharactersRoute } from "../src/routes/gm/characters";
import { useIdentityStore } from "../src/stores/identity-store";
import { usePlayStore } from "../src/stores/play-store";
import "../src/themes/runtime/bootstrap";

const character = {
	id: "fighter",
	name: "边境战士",
	ruleId: "dnd5r",
	kind: "npc",
	sheetJson: JSON.stringify(dnd5r.createBlankSheet()),
	version: 3,
};

const state: dnd5r.SessionState = {
	hp: 10,
	maxHp: 10,
	tempHp: 3,
	conditions: ["unconscious"],
	exhaustion: 1,
	deathSaves: { successes: 0, failures: 0, stable: false, dead: false },
	hitDice: 1,
	maxHitDice: 1,
	spellSlots: [],
	maxSpellSlots: [],
	resources: {},
};

function npc(
	id: string,
	name: string,
	state: dnd5r.SessionState,
): SnapshotCharacter {
	return {
		characterId: id,
		name,
		ruleId: "dnd5r",
		kind: "npc",
		claim: null,
		state,
		currentExpressionKey: null,
		portraits: [],
		sheet: null,
	};
}

beforeEach(() => {
	usePlayStore.getState().reset();
	useIdentityStore.setState({
		account: { userId: "gm", username: "gm", role: "gm" },
		accountResolved: true,
	});
});

afterEach(() => {
	cleanup();
});

test("GM character directory shows actual D&D summary metrics", async () => {
	const fetcher = spyOn(globalThis, "fetch").mockImplementation(
		Object.assign(
			async (url: RequestInfo | URL) =>
				Response.json(
					String(url).includes("/gm/characters?")
						? { items: [character], nextCursor: null }
						: String(url).endsWith(`/gm/characters/${character.id}`)
							? character
							: { gmThemeId: null },
				),
			{ preconnect: fetch.preconnect },
		),
	);
	try {
		const root = createRootRoute();
		const route = createRoute({
			getParentRoute: () => root,
			path: "/gm/characters",
			component: CharactersRoute.options.component,
		});
		const router = createRouter({
			routeTree: root.addChildren([route]),
			history: createMemoryHistory({ initialEntries: ["/gm/characters"] }),
		});
		const view = render(<RouterProvider router={router} />);
		expect(await view.findByText("AC")).toBeTruthy();
		expect(view.getByText("HP")).toBeTruthy();
		for (const label of ["MP", "SAN", "LUCK"])
			expect(view.queryByText(label)).toBeNull();
	} finally {
		fetcher.mockRestore();
	}
});

test("permanent editor rejects above the D&D server maximum and submits the maximum", async () => {
	const requests: unknown[] = [];
	const fetcher = spyOn(globalThis, "fetch").mockImplementation(
		Object.assign(
			async (url: RequestInfo | URL, options?: RequestInit) => {
				const path = String(url);
				if (path.endsWith("/history")) return Response.json({ audits: [] });
				if (path.endsWith("/rules"))
					return Response.json([
						{
							id: character.ruleId,
							permanentSheetFields: ["abilities.str"],
							permanentFieldRange: { min: 1, max: 30 },
						},
					]);
				if (path.endsWith("/permanent-field")) {
					requests.push(JSON.parse(String(options?.body)));
					return Response.json({});
				}
				return Response.json(character);
			},
			{ preconnect: fetch.preconnect },
		),
	);
	try {
		const view = render(
			<CharacterPermanentFieldDialog
				open
				onOpenChange={() => undefined}
				characterId={character.id}
				sessionId="session"
			/>,
		);
		const input = await view.findByRole("spinbutton", { name: "新数值" });
		const button = view.getByRole("button", { name: "保存并审计" });
		const reason = view.getByLabelText("原因");
		fireEvent.input(reason, { target: { value: "修正力量" } });
		fireEvent.input(input, { target: { value: "31" } });
		fireEvent.click(button);
		expect(await view.findByRole("alert")).toHaveProperty(
			"textContent",
			"属性必须是 1–30 的整数",
		);
		expect(requests).toEqual([]);
		expect(input.getAttribute("max")).toBe("30");
		fireEvent.input(input, { target: { value: "30" } });
		fireEvent.click(button);
		await waitFor(() => {
			expect(view.queryByRole("alert")?.textContent ?? null).toBeNull();
			expect(requests).toEqual([
				{
					field: "abilities.str",
					value: 30,
					reason: "修正力量",
					sessionId: "session",
					expectedVersion: 3,
				},
			]);
		});
	} finally {
		fetcher.mockRestore();
	}
});

test("GM NPC list flags conditions from the NPC’s rule", () => {
	usePlayStore.setState({
		characters: [npc("fighter", character.name, state)],
	});
	const view = render(<CharactersPanel onClose={() => undefined} />);
	const label = view.getByText(/NPC ·/);
	expect(label.classList.contains("text-danger")).toBe(true);
});

test("GM priority card ranks D&D conditions and shows D&D resources", () => {
	usePlayStore.setState({
		characters: [
			npc("other", "轻伤哨兵", {
				...state,
				conditions: [],
				exhaustion: 0,
				tempHp: 0,
				hp: 8,
			}),
			npc("fighter", character.name, state),
		],
	});
	const view = render(
		<GmToolProvider>
			<CharacterStateCard />
		</GmToolProvider>,
	);
	const lines = view.getAllByText(/HP \d+ \/ \d+/);
	expect(lines[0]?.textContent).toContain("HP 10 / 10 · 临时 HP 3");
	expect(lines[1]?.textContent).toBe("HP 8 / 10");
	expect(view.queryByText(/SAN/)).toBeNull();
});
