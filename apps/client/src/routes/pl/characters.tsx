import type { CharacterDto } from "@cogm/shared";
import { createFileRoute } from "@tanstack/react-router";
import { Pencil, Plus, Trash2, VenetianMask } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { FormField } from "@/components/shared/form-field";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { t, useI18nVersion } from "@/i18n";
import { api, fetchAllPages, isApiError } from "@/lib/api";
import { errorText } from "@/lib/errors";
import { requireAccount } from "@/lib/identity";
import { useRuleOptions } from "@/lib/rules-api";
import { getRuleComponent } from "@/rules/registry";

export const Route = createFileRoute("/pl/characters")({
	beforeLoad: () => requireAccount(["pl"]),
	component: PlCharactersPage,
});

type EditorState = {
	open: boolean;
	character: CharacterDto | null;
};

function PlCharactersPage() {
	useI18nVersion();
	const [characters, setCharacters] = useState<CharacterDto[]>([]);
	const [loading, setLoading] = useState(true);
	const [editor, setEditor] = useState<EditorState>({
		open: false,
		character: null,
	});
	const [deleteTarget, setDeleteTarget] = useState<CharacterDto | null>(null);

	const load = useCallback(async () => {
		setLoading(true);
		try {
			setCharacters(await fetchAllPages<CharacterDto>("/pl/characters"));
		} catch (error) {
			toast.error(isApiError(error) ? error.message : t("pl.characters.empty"));
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		void load();
	}, [load]);

	async function remove(character: CharacterDto) {
		try {
			await api(`/pl/characters/${character.id}`, { method: "DELETE" });
			setDeleteTarget(null);
			await load();
		} catch (error) {
			toast.error(errorText(error, "pl.characters.deleteFailed"));
		}
	}

	return (
		<div className="mx-auto flex min-h-dvh w-full max-w-6xl flex-col gap-6 px-6 py-8">
			<PageHeader
				title={t("pl.characters.title")}
				description={t("pl.characters.description")}
				actions={
					<Button
						type="button"
						variant="primary"
						onClick={() => setEditor({ open: true, character: null })}
					>
						<Plus />
						{t("pl.characters.create")}
					</Button>
				}
			/>

			{loading ? (
				<p className="text-foreground-tertiary">{t("common.loading")}</p>
			) : characters.length === 0 ? (
				<p className="text-foreground-tertiary">{t("pl.characters.empty")}</p>
			) : (
				<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{characters.map((character) => (
						<Card key={character.id} className="flex flex-col gap-3 p-5">
							<div className="flex items-start justify-between gap-2">
								<div className="flex min-w-0 flex-col gap-0.5">
									<span className="truncate text-title-medium-emph">
										{character.name}
									</span>
									<span className="text-foreground-tertiary font-mono text-label-small">
										{character.ruleId} · v{character.version}
									</span>
								</div>
								<Badge variant="soft" tone="accent" size="sm">
									<VenetianMask className="size-3" />
									{t("common.pc")}
								</Badge>
							</div>
							{character.background ? (
								<p className="text-foreground-secondary line-clamp-3 text-body-small">
									{character.background}
								</p>
							) : null}
							<div className="mt-auto flex gap-2">
								<Button
									type="button"
									variant="tertiary"
									size="sm"
									onClick={() => setEditor({ open: true, character })}
								>
									<Pencil className="size-3.5" />
									{t("common.edit")}
								</Button>
								<Button
									type="button"
									variant="ghost"
									size="icon-sm"
									title={t("common.delete")}
									onClick={() => setDeleteTarget(character)}
								>
									<Trash2 />
								</Button>
							</div>
						</Card>
					))}
				</div>
			)}

			<CharacterEditor
				state={editor}
				onClose={() => setEditor({ open: false, character: null })}
				onSaved={() => void load()}
			/>

			<Dialog
				open={deleteTarget !== null}
				onOpenChange={(open) => (open ? undefined : setDeleteTarget(null))}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>{t("pl.characters.deleteTitle")}</DialogTitle>
						<DialogDescription>{deleteTarget?.name ?? ""}</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button
							type="button"
							variant="dangerSoft"
							onClick={() => deleteTarget && void remove(deleteTarget)}
						>
							{t("common.delete")}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}

function CharacterEditor({
	state,
	onClose,
	onSaved,
}: {
	state: EditorState;
	onClose: () => void;
	onSaved: () => void;
}) {
	const { rules, ruleId, setRuleId, loading: rulesLoading } = useRuleOptions();
	const [name, setName] = useState("");
	const [background, setBackground] = useState("");
	const [pending, setPending] = useState(false);

	useEffect(() => {
		if (!state.open) {
			return;
		}
		setName(state.character?.name ?? "");
		setBackground(state.character?.background ?? "");
		if (state.character) {
			setRuleId(state.character.ruleId);
		}
	}, [state.open, state.character, setRuleId]);

	async function submit() {
		const trimmed = name.trim();
		if (!trimmed || pending) {
			return;
		}
		setPending(true);
		try {
			if (state.character) {
				await api(`/pl/characters/${state.character.id}`, {
					method: "PATCH",
					body: JSON.stringify({
						name: trimmed,
						background,
						expectedVersion: state.character.version,
					}),
				});
			} else {
				await api("/pl/characters", {
					method: "POST",
					body: JSON.stringify({
						name: trimmed,
						background,
						ruleId,
						sheetData: getRuleComponent(ruleId).createEmptySheet(),
					}),
				});
			}
			toast.success(t("pl.characters.saved"));
			onClose();
			onSaved();
		} catch (error) {
			toast.error(errorText(error, "pl.characters.saveFailed"));
		} finally {
			setPending(false);
		}
	}

	return (
		<Dialog
			open={state.open}
			onOpenChange={(open) => (open ? undefined : onClose())}
		>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>
						{state.character
							? t("pl.characters.editTitle")
							: t("pl.characters.create")}
					</DialogTitle>
					<DialogDescription>{t("pl.characters.hint")}</DialogDescription>
				</DialogHeader>
				<div className="flex flex-col gap-4">
					<FormField
						label={t("pl.characters.name")}
						htmlFor="pl-character-name"
					>
						<Input
							id="pl-character-name"
							value={name}
							maxLength={100}
							onChange={(event) => setName(event.target.value)}
						/>
					</FormField>
					<FormField
						label={t("pl.characters.background")}
						htmlFor="pl-character-bg"
					>
						<Textarea
							id="pl-character-bg"
							value={background}
							rows={4}
							onChange={(event) => setBackground(event.target.value)}
						/>
					</FormField>
					{state.character ? null : (
						<FormField label={t("rules.label")}>
							<Select
								value={ruleId}
								onValueChange={setRuleId}
								disabled={rulesLoading}
							>
								<SelectTrigger>
									<SelectValue placeholder={t("rules.loading")} />
								</SelectTrigger>
								<SelectContent>
									{rules.map((rule) => (
										<SelectItem key={rule.id} value={rule.id}>
											{rule.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</FormField>
					)}
				</div>
				<DialogFooter>
					<Button
						type="button"
						variant="primary"
						disabled={pending || !name.trim()}
						onClick={() => void submit()}
					>
						{t("common.save")}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
