import { beforeEach, describe, expect, test } from "bun:test";
import { coc7e } from "@cogm/shared";
import { fireEvent, render, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { t } from "../src/i18n";
import { Coc7eCreationRecordsEditor } from "../src/rules/coc7e/creation-records-editor";

type Sheet = coc7e.Coc7eCharacterSheet;

const skillOptions = coc7e.COC7E_SKILL_CATALOG.map((entry) => ({
	value: entry.key,
	label: entry.key,
}));

function sheetFor(era: coc7e.Coc7eEra): Sheet {
	return coc7e.normalizeCoc7eSheet({
		era,
		attributes: {
			str: 50,
			con: 50,
			siz: 50,
			dex: 50,
			app: 50,
			int: 50,
			pow: 50,
			edu: 50,
			luck: 50,
		},
		skills: {},
	});
}

function Harness({
	initial,
	onChange,
}: {
	initial: Sheet;
	onChange: (sheet: Sheet) => void;
}) {
	const [sheet, setSheet] = useState(initial);
	return (
		<Coc7eCreationRecordsEditor
			sheet={sheet}
			showValidation={false}
			reportError={() => undefined}
			skillOptions={skillOptions}
			onChange={(next) => {
				onChange(next);
				setSheet(next);
			}}
		/>
	);
}

function renderRecords(initial: Sheet = sheetFor("1920s")) {
	let latest = initial;
	const view = render(
		<Harness
			initial={initial}
			onChange={(next) => {
				latest = next;
			}}
		/>,
	);
	return { view, latest: () => latest };
}

async function openPicker(
	view: ReturnType<typeof render>,
	triggerLabel: string,
) {
	fireEvent.click(view.getByRole("button", { name: triggerLabel }));
	return within(view.baseElement).findByRole("dialog");
}

function search(dialog: HTMLElement, searchLabel: string, value: string): void {
	fireEvent.input(
		within(dialog).getByRole("searchbox", { name: searchLabel }),
		{
			target: { value },
		},
	);
}

function rowsOf(dialog: HTMLElement): HTMLElement[] {
	return within(dialog).queryAllByRole("button");
}

function weaponNamed(name: string): coc7e.Coc7eWeaponDefinition {
	const definition = coc7e.COC7E_WEAPONS.find((entry) => entry.name === name);
	if (!definition) {
		throw new Error(`missing weapon ${name}`);
	}
	return definition;
}

function armorNamed(name: string): coc7e.Coc7eArmorDefinition {
	const definition = coc7e.COC7E_ARMOR.find((entry) => entry.name === name);
	if (!definition) {
		throw new Error(`missing armor ${name}`);
	}
	return definition;
}

describe("CoC 7e equipment pickers", () => {
	beforeEach(() => {
		if (!Element.prototype.hasPointerCapture) {
			Element.prototype.hasPointerCapture = () => false;
		}
		if (!Element.prototype.setPointerCapture) {
			Element.prototype.setPointerCapture = () => undefined;
		}
		if (!Element.prototype.releasePointerCapture) {
			Element.prototype.releasePointerCapture = () => undefined;
		}
	});

	test("appends a catalog weapon with its published values", async () => {
		const initial = sheetFor("1920s");
		const manual: coc7e.Coc7eWeapon = {
			name: "自制手斧",
			skillKey: "格斗(斗殴)",
			damage: "1d6+1",
			range: "接触",
			attacks: "1",
			ammo: null,
			malfunction: null,
			impale: false,
			applyDamageBonus: true,
		};
		initial.weapons = [manual];
		const editor = renderRecords(initial);
		const definition = weaponNamed("弩");

		const dialog = await openPicker(editor.view, t("equipment.pickWeapon"));
		search(dialog, t("equipment.searchWeapon"), "弩");
		const rows = rowsOf(dialog);
		expect(rows).toHaveLength(1);
		fireEvent.click(rows[0] as HTMLElement);

		await waitFor(() => expect(editor.latest().weapons).toHaveLength(2));
		expect(editor.latest().weapons[0]).toEqual(manual);
		expect(editor.latest().weapons[1]).toEqual({
			name: "弩",
			skillKey: definition.skillKey,
			damage: definition.damage,
			range: definition.range,
			attacks: definition.attacks,
			ammo: definition.ammo,
			malfunction: definition.malfunction,
			impale: definition.impale,
			applyDamageBonus: definition.damageBonus !== "none",
		});
		expect(
			editor.view.getByRole("textbox", {
				name: t("characterCreation.weaponName", { index: 2 }),
			}),
		).toBeTruthy();
	});

	test("keeps already added weapons out of the list", async () => {
		const initial = sheetFor("1920s");
		initial.weapons = [coc7e.coc7eWeaponFromCatalog(weaponNamed("弓箭"))];
		const editor = renderRecords(initial);

		const dialog = await openPicker(editor.view, t("equipment.pickWeapon"));
		search(dialog, t("equipment.searchWeapon"), "弓箭");
		expect(rowsOf(dialog)).toHaveLength(0);
		expect(within(dialog).getByText(t("equipment.noMatch"))).toBeTruthy();
	});

	test("hides modern-only weapons on a 1920s sheet and offers them on a modern sheet", async () => {
		const classic = renderRecords(sheetFor("1920s"));
		const classicDialog = await openPicker(
			classic.view,
			t("equipment.pickWeapon"),
		);
		search(classicDialog, t("equipment.searchWeapon"), "电锯");
		expect(rowsOf(classicDialog)).toHaveLength(0);
		classic.view.unmount();

		const modern = renderRecords(sheetFor("modern"));
		const modernDialog = await openPicker(
			modern.view,
			t("equipment.pickWeapon"),
		);
		search(modernDialog, t("equipment.searchWeapon"), "电锯");
		expect(rowsOf(modernDialog)).toHaveLength(1);
	});

	test("reports how many matches stay hidden", async () => {
		const editor = renderRecords(sheetFor("1920s"));
		const dialog = await openPicker(editor.view, t("equipment.pickWeapon"));
		const total = coc7e.coc7eWeaponsForEra("1920s").length;
		const shown = rowsOf(dialog).length;
		expect(shown).toBeLessThan(total);
		expect(
			within(dialog).getByText(t("equipment.truncated", { shown, total })),
		).toBeTruthy();
	});

	test("fills the armor slot from the catalog", async () => {
		const editor = renderRecords(sheetFor("1920s"));
		const definition = armorNamed("厚重皮夹克");

		const dialog = await openPicker(editor.view, t("equipment.pickArmor"));
		search(dialog, t("equipment.searchArmor"), "厚重皮夹克");
		const rows = rowsOf(dialog);
		expect(rows).toHaveLength(1);
		fireEvent.click(rows[0] as HTMLElement);

		await waitFor(() =>
			expect(editor.latest().armor.name).toBe(definition.name),
		);
		expect(editor.latest().armor).toEqual({
			name: definition.name,
			value: definition.value,
			locations: definition.locations,
			penalty: definition.penalty,
		});
		expect(
			editor.view.getByRole("spinbutton", {
				name: t("characterCreation.armorValue"),
			}),
		).toBeTruthy();
	});
});
