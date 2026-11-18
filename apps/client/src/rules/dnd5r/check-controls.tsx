import { dnd5r } from "@cogm/shared";
import { Dices, EyeOff, Send } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
	Field,
	FieldDescription,
	FieldGroup,
	FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
	GmPanelShell,
	GmSelectField,
} from "@/features/gm-console/gm-panel-fields";
import { t } from "@/i18n";
import { sendSessionCommand } from "@/lib/session-socket";
import type {
	RuleCheckOptions,
	RuleCheckPanelProps,
	RuleDiceTrayProps,
} from "@/rules/registry";
import { usePlayStore } from "@/stores/play-store";
import {
	ABILITIES,
	abilityLabel,
	checkLabel,
	type DndAbility,
	SKILLS,
	signed,
	skillLabel,
} from "./labels";

type CheckKind =
	| "ability"
	| "skill"
	| "save"
	| "attack"
	| "initiative"
	| "death";

function keyFor(kind: CheckKind, selection: string): string {
	return kind === "initiative" || kind === "death"
		? kind
		: `${kind}:${selection}`;
}

function modifierFor(
	sheet: dnd5r.CharacterSheet,
	kind: CheckKind,
	selection: string,
): number | null {
	const derived = dnd5r.deriveCharacter(sheet);
	if (kind === "initiative") return derived.initiative;
	if (kind === "death") return 0;
	if (kind === "ability")
		return derived.abilityModifiers[selection as DndAbility];
	if (kind === "save") return derived.savingThrows[selection as DndAbility];
	if (kind === "skill") return derived.skillModifiers[selection as dnd5r.Skill];
	return (
		derived.attacks.find((attack) => attack.id === selection)?.attackBonus ??
		null
	);
}

export function DndCheckControls({
	character,
	gm,
	disabled,
	onSubmitted,
}: RuleDiceTrayProps) {
	const parsed = dnd5r.CharacterSheet.safeParse(character.sheet);
	const derived = parsed.success ? dnd5r.deriveCharacter(parsed.data) : null;
	const [kind, setKind] = useState<CheckKind>("skill");
	const [selection, setSelection] = useState("perception");
	const [mode, setMode] = useState<dnd5r.RollMode>("normal");
	const [dc, setDc] = useState("");
	const [targetId, setTargetId] = useState("");
	const [abilityOverride, setAbilityOverride] = useState<DndAbility | null>(
		null,
	);
	const [twoHanded, setTwoHanded] = useState(false);
	const [hidden, setHidden] = useState(gm);
	const encounter = dnd5r.EncounterState.safeParse(
		usePlayStore((state) => state.ruleState),
	);
	const targets = encounter.success
		? encounter.data.combatants.filter(
				(item) => item.characterId !== character.characterId,
			)
		: [];
	const selectedAttack = derived?.attacks.find(
		(attack) => attack.id === selection,
	);
	const skillKey = keyFor(kind, selection);
	const modifier = parsed.success
		? modifierFor(parsed.data, kind, selection)
		: null;
	const dcNumber = dc.trim() ? Number(dc) : undefined;
	const selectedTargetId = targets.some(
		(target) => target.characterId === targetId,
	)
		? targetId
		: "";
	const targetedAttack = kind === "attack" && Boolean(selectedTargetId);
	const dcAllowed =
		kind !== "initiative" && kind !== "death" && !targetedAttack;
	const validDc =
		!dcAllowed ||
		dcNumber === undefined ||
		(Number.isInteger(dcNumber) && dcNumber >= 1 && dcNumber <= 40);
	const canChooseAbility =
		kind === "attack" && selectedAttack?.abilityChoice === true;
	const canTwoHand =
		kind === "attack" &&
		Boolean(selectedAttack?.weapon?.versatileDie) &&
		parsed.success &&
		!parsed.data.shield;
	const options: RuleCheckOptions = {
		mode,
		...(dcAllowed && dcNumber !== undefined && validDc ? { dc: dcNumber } : {}),
		...(targetedAttack ? { targetId: selectedTargetId } : {}),
		...(canChooseAbility && abilityOverride
			? { ability: abilityOverride }
			: {}),
		...(canTwoHand && twoHanded ? { twoHanded: true } : {}),
	};
	const selectionOptions =
		kind === "ability" || kind === "save"
			? ABILITIES.map((id) => ({ value: id, label: abilityLabel(id) }))
			: kind === "skill"
				? SKILLS.map((id) => ({ value: id, label: skillLabel(id) }))
				: (derived?.attacks ?? []).map((attack) => ({
						value: attack.id,
						label: attack.name,
					}));

	function changeKind(next: CheckKind) {
		setKind(next);
		setTargetId("");
		setAbilityOverride(null);
		setTwoHanded(false);
		setSelection(
			next === "skill"
				? "perception"
				: next === "attack"
					? (derived?.attacks[0]?.id ?? "unarmed")
					: "str",
		);
	}

	function send(request: boolean) {
		if (!parsed.success || !validDc || disabled) return;
		const type = request ? "check:request" : "check:perform";
		const sent = sendSessionCommand(type, {
			characterId: character.characterId,
			skillKey,
			hidden,
			options,
		});
		if (!sent) {
			toast.error(t("chat.notConnected"));
			return;
		}
		toast.success(
			t(request ? "dnd5r.check.requestSubmitted" : "check.submitted", {
				skill: checkLabel(skillKey),
			}),
		);
		onSubmitted?.();
	}

	return (
		<FieldGroup>
			<div className="grid gap-3 sm:grid-cols-2">
				<Field>
					<FieldLabel>{t("dnd5r.check.kind")}</FieldLabel>
					<Select
						value={kind}
						onValueChange={(value) => changeKind(value as CheckKind)}
					>
						<SelectTrigger aria-label={t("dnd5r.check.kind")}>
							<SelectValue />
						</SelectTrigger>
						<SelectContent position="popper">
							<SelectGroup>
								{(
									[
										"ability",
										"skill",
										"save",
										"attack",
										"initiative",
										"death",
									] as const
								).map((value) => (
									<SelectItem key={value} value={value}>
										{t(`dnd5r.check.kind.${value}`)}
									</SelectItem>
								))}
							</SelectGroup>
						</SelectContent>
					</Select>
				</Field>
				{kind !== "initiative" && kind !== "death" ? (
					<Field>
						<FieldLabel>{t("dnd5r.check.subject")}</FieldLabel>
						<Select
							value={selection}
							onValueChange={(value) => {
								setSelection(value);
								setAbilityOverride(null);
								setTwoHanded(false);
							}}
						>
							<SelectTrigger aria-label={t("dnd5r.check.subject")}>
								<SelectValue />
							</SelectTrigger>
							<SelectContent position="popper">
								<SelectGroup>
									{selectionOptions.map((option) => (
										<SelectItem key={option.value} value={option.value}>
											{option.label}
										</SelectItem>
									))}
								</SelectGroup>
							</SelectContent>
						</Select>
					</Field>
				) : null}
			</div>
			<Field>
				<FieldLabel>{t("dnd5r.check.mode")}</FieldLabel>
				<ToggleGroup
					type="single"
					value={mode}
					onValueChange={(value) => value && setMode(value as dnd5r.RollMode)}
					className="w-full"
				>
					{(["normal", "advantage", "disadvantage"] as const).map((value) => (
						<ToggleGroupItem
							key={value}
							value={value}
							className="min-h-11 flex-1"
						>
							{t(`dnd5r.check.mode.${value}`)}
						</ToggleGroupItem>
					))}
				</ToggleGroup>
			</Field>
			<div className="grid gap-3 sm:grid-cols-2">
				{dcAllowed ? (
					<Field data-invalid={!validDc}>
						<FieldLabel htmlFor="dnd-check-dc">
							{t("dnd5r.check.dc")}
						</FieldLabel>
						<Input
							id="dnd-check-dc"
							type="number"
							min={1}
							max={40}
							value={dc}
							aria-invalid={!validDc}
							placeholder={t("dnd5r.check.dcPlaceholder")}
							onChange={(event) => setDc(event.target.value)}
						/>
						<FieldDescription>
							{t("dnd5r.check.modifier", {
								value: modifier === null ? "—" : signed(modifier),
							})}
						</FieldDescription>
					</Field>
				) : null}
				{kind === "attack" ? (
					<Field>
						<FieldLabel>{t("dnd5r.check.target")}</FieldLabel>
						<Select
							value={selectedTargetId || "none"}
							onValueChange={(value) =>
								setTargetId(value === "none" ? "" : value)
							}
						>
							<SelectTrigger aria-label={t("dnd5r.check.target")}>
								<SelectValue />
							</SelectTrigger>
							<SelectContent position="popper">
								<SelectGroup>
									<SelectItem value="none">
										{t("dnd5r.check.noTarget")}
									</SelectItem>
									{targets.map((target) => (
										<SelectItem
											key={target.characterId}
											value={target.characterId}
										>
											{target.name}
										</SelectItem>
									))}
								</SelectGroup>
							</SelectContent>
						</Select>
						<FieldDescription>
							{t("dnd5r.check.targetDescription")}
						</FieldDescription>
					</Field>
				) : null}
			</div>
			{kind === "attack" && selectedAttack ? (
				<div className="flex flex-wrap gap-4">
					{selectedAttack.weapon?.versatileDie ? (
						<Field orientation="horizontal">
							<Switch
								id="dnd-two-handed"
								checked={twoHanded}
								disabled={!canTwoHand}
								onCheckedChange={setTwoHanded}
							/>
							<FieldLabel htmlFor="dnd-two-handed">
								{t("dnd5r.check.twoHanded")}
							</FieldLabel>
							{parsed.success && parsed.data.shield ? (
								<FieldDescription>
									{t("dnd5r.check.twoHandedShield")}
								</FieldDescription>
							) : null}
						</Field>
					) : null}
					{canChooseAbility ? (
						<Field className="min-w-40">
							<FieldLabel>{t("dnd5r.check.attackAbility")}</FieldLabel>
							<Select
								value={abilityOverride ?? selectedAttack.ability}
								onValueChange={(value) =>
									setAbilityOverride(value as DndAbility)
								}
							>
								<SelectTrigger>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectGroup>
										{(["str", "dex"] as const).map((id) => (
											<SelectItem key={id} value={id}>
												{abilityLabel(id)}
											</SelectItem>
										))}
									</SelectGroup>
								</SelectContent>
							</Select>
						</Field>
					) : null}
				</div>
			) : null}
			{gm ? (
				<Field orientation="horizontal">
					<Switch
						id="dnd-hidden-check"
						checked={hidden}
						onCheckedChange={setHidden}
					/>
					<FieldLabel htmlFor="dnd-hidden-check">
						<EyeOff data-icon="inline-start" />
						{t("dice.hidden")}
					</FieldLabel>
				</Field>
			) : null}
			<div className="flex flex-wrap justify-end gap-2">
				{gm && character.kind === "pc" ? (
					<Button
						type="button"
						variant="tertiary"
						disabled={disabled || !parsed.success || !validDc}
						onClick={() => send(true)}
					>
						<Send data-icon="inline-start" />
						{t("dnd5r.check.request")}
					</Button>
				) : null}
				<Button
					type="button"
					variant="primary"
					disabled={disabled || !parsed.success || !validDc}
					onClick={() => send(false)}
				>
					<Dices data-icon="inline-start" />
					{t("dnd5r.check.roll")}
				</Button>
			</div>
		</FieldGroup>
	);
}

export function DndDiceTray(props: RuleDiceTrayProps) {
	const [selectedId, setSelectedId] = useState(props.character.characterId);
	const character = props.gm
		? (props.characters.find((item) => item.characterId === selectedId) ??
			props.character)
		: props.character;
	return (
		<FieldGroup>
			{props.gm ? (
				<Field>
					<FieldLabel>{t("dice.target")}</FieldLabel>
					<Select value={character.characterId} onValueChange={setSelectedId}>
						<SelectTrigger aria-label={t("dice.target")}>
							<SelectValue />
						</SelectTrigger>
						<SelectContent position="popper">
							<SelectGroup>
								{props.characters.map((item) => (
									<SelectItem key={item.characterId} value={item.characterId}>
										{item.name} · {item.kind === "npc" ? "NPC" : "PC"}
									</SelectItem>
								))}
							</SelectGroup>
						</SelectContent>
					</Select>
				</Field>
			) : null}
			<DndCheckControls {...props} character={character} />
		</FieldGroup>
	);
}

export function DndGmCheckPanel({ characters, onClose }: RuleCheckPanelProps) {
	const [characterId, setCharacterId] = useState("");
	const character =
		characters.find((item) => item.characterId === characterId) ??
		characters.find((item) => item.kind === "pc") ??
		characters[0];
	return (
		<GmPanelShell
			title={t("dnd5r.check.gmTitle")}
			subtitle={t("dnd5r.check.gmDescription")}
			onClose={onClose}
		>
			{character ? (
				<>
					<GmSelectField
						label={t("dice.target")}
						value={character.characterId}
						onValueChange={setCharacterId}
					>
						{characters.map((item) => (
							<SelectItem key={item.characterId} value={item.characterId}>
								{item.name}
							</SelectItem>
						))}
					</GmSelectField>
					<DndCheckControls
						character={character}
						characters={characters}
						gm
						disabled={false}
					/>
				</>
			) : (
				<p className="text-body-medium text-foreground-secondary">
					{t("gm.console.noTarget")}
				</p>
			)}
		</GmPanelShell>
	);
}
