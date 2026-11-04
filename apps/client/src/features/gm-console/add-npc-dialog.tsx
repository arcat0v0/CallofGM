import type { AddSessionNpcResponse, CharacterDto } from "@cogm/shared";
import { Link } from "@tanstack/react-router";
import { Plus, Search, UserPlus, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	InputGroup,
	InputGroupAddon,
	InputGroupInput,
} from "@/components/ui/input-group";
import { CreateCharacterDialog } from "@/features/gm-admin/dialogs/create-character-dialog";
import { t } from "@/i18n";
import { api, fetchAllPages } from "@/lib/api";
import { errorText } from "@/lib/errors";

function AddNpcDialog({
	open,
	onOpenChange,
	sessionId,
	moduleId,
	ruleId,
	existingIds,
	onAdded,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	sessionId: string | null;
	moduleId: string | null;
	ruleId: string | null;
	existingIds: string[];
	onAdded?: () => void;
}) {
	const [characters, setCharacters] = useState<CharacterDto[]>([]);
	const [query, setQuery] = useState("");
	const [pendingId, setPendingId] = useState<string | null>(null);
	const [createOpen, setCreateOpen] = useState(false);
	const [addedIds, setAddedIds] = useState<string[]>([]);

	const excluded = useMemo(
		() => new Set([...existingIds, ...addedIds]),
		[existingIds, addedIds],
	);

	useEffect(() => {
		if (!open) {
			return;
		}
		setQuery("");
		void fetchAllPages<CharacterDto>("/gm/characters")
			.then(setCharacters)
			.catch((error) =>
				toast.error(errorText(error, "gm.workbench.npcLoadFailed")),
			);
	}, [open]);

	const candidates = useMemo(() => {
		const keyword = query.trim();
		return characters.filter(
			(character) =>
				character.kind === "npc" &&
				(ruleId === null || character.ruleId === ruleId) &&
				!excluded.has(character.id) &&
				(!keyword || character.name.includes(keyword)),
		);
	}, [characters, excluded, query, ruleId]);

	async function add(character: CharacterDto) {
		if (!sessionId || pendingId) {
			return;
		}
		setPendingId(character.id);
		try {
			const result = await api<AddSessionNpcResponse>(
				`/gm/sessions/${encodeURIComponent(sessionId)}/npcs`,
				{
					method: "POST",
					body: JSON.stringify({ characterId: character.id }),
				},
			);
			setAddedIds((current) => [...current, result.characterId]);
			toast.success(
				result.alreadyInSession
					? t("gm.workbench.npcAlreadyInSession", { name: result.name })
					: t("gm.workbench.npcAdded", { name: result.name }),
			);
			onAdded?.();
		} catch (error) {
			toast.error(errorText(error, "gm.workbench.npcAddFailed"));
		} finally {
			setPendingId(null);
		}
	}

	return (
		<>
			<Dialog
				open={open}
				onOpenChange={(next) => {
					onOpenChange(next);
					if (!next) {
						setCreateOpen(false);
					}
				}}
			>
				<DialogContent
					showCloseButton={false}
					className="flex max-h-[80dvh] flex-col gap-0 p-0"
				>
					<DialogHeader className="flex-row items-center justify-between px-5 py-[18px]">
						<div className="flex flex-col gap-0.5">
							<DialogTitle>{t("gm.workbench.addNpcTitle")}</DialogTitle>
							<DialogDescription>
								{t("gm.workbench.addNpcDescription")}
							</DialogDescription>
						</div>
						<Button
							type="button"
							variant="ghost"
							size="icon-sm"
							aria-label={t("common.close")}
							onClick={() => onOpenChange(false)}
						>
							<X />
						</Button>
					</DialogHeader>

					<div className="flex flex-col gap-3 px-5 pb-3">
						<div className="flex items-center gap-2">
							<InputGroup className="h-10 flex-1">
								<InputGroupAddon>
									<Search />
								</InputGroupAddon>
								<InputGroupInput
									value={query}
									aria-label={t("gm.workbench.npcSearch")}
									placeholder={t("gm.workbench.npcSearch")}
									onChange={(event) => setQuery(event.target.value)}
								/>
							</InputGroup>
							<Button
								type="button"
								variant="tertiary"
								size="sm"
								className="bg-md-surface-container-highest h-10 shrink-0"
								onClick={() => setCreateOpen(true)}
							>
								<Plus className="size-4" />
								{t("gm.workbench.createNpc")}
							</Button>
						</div>
					</div>

					<div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">
						{candidates.length === 0 ? (
							<EmptyState
								icon={UserPlus}
								title={t("gm.workbench.npcEmpty")}
								description={t("gm.workbench.npcEmptyHint")}
								className="bg-transparent py-8"
							/>
						) : (
							<div className="flex flex-col gap-1.5">
								{candidates.map((character) => (
									<button
										key={character.id}
										type="button"
										disabled={pendingId !== null}
										onClick={() => void add(character)}
										className="bg-md-surface-container hover:bg-md-surface-container-high flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left outline-none transition-colors duration-150 ease-standard-fast-effects focus-visible:ring-4 focus-visible:ring-focus-ring/50 disabled:opacity-60"
									>
										<span className="bg-md-surface-container-highest text-md-on-surface-variant grid size-8 shrink-0 place-items-center rounded-full text-label-medium-emph">
											{character.name.slice(0, 1)}
										</span>
										<span className="min-w-0 flex-1 truncate text-body-medium">
											{character.name}
										</span>
										<Badge variant="soft" size="sm">
											{t("common.npc")}
										</Badge>
										<UserPlus className="text-md-primary size-4 shrink-0" />
									</button>
								))}
							</div>
						)}
					</div>

					{moduleId ? (
						<div className="border-separator-secondary/60 flex items-center justify-between gap-3 border-t px-5 py-3">
							<span className="text-md-on-surface-variant text-label-small">
								{t("gm.workbench.npcLinkHint")}
							</span>
							<Button
								asChild
								variant="ghost"
								size="sm"
								className="h-8 shrink-0 px-2 text-label-small"
							>
								<Link to="/gm/module/$moduleId" params={{ moduleId }}>
									{t("gm.workbench.openModuleCharacters")}
								</Link>
							</Button>
						</div>
					) : null}
				</DialogContent>
			</Dialog>

			<CreateCharacterDialog
				open={createOpen}
				onOpenChange={setCreateOpen}
				defaultKind="npc"
				lockKind
				fixedRuleId={ruleId ?? undefined}
				onCreated={(created) => {
					setCreateOpen(false);
					void add(created);
				}}
			/>
		</>
	);
}

export { AddNpcDialog };
