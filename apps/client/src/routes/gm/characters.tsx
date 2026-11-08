import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
	Ellipsis,
	FileSpreadsheet,
	PencilLine,
	Plus,
	Search,
	Settings2,
	Trash2,
	UserRound,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { SegmentedControl } from "@/components/shared/segmented-control";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	InputGroup,
	InputGroupAddon,
	InputGroupInput,
} from "@/components/ui/input-group";
import { AdminLayout } from "@/features/gm-admin/admin-layout";
import { CreateCharacterDialog } from "@/features/gm-admin/dialogs/create-character-dialog";
import { ImportCharacterSheetDialog } from "@/features/gm-admin/dialogs/import-character-sheet-dialog";
import { t, useI18nVersion } from "@/i18n";
import { api, fetchAllPages } from "@/lib/api";
import {
	type CharacterRow,
	type GameCharacter,
	mapCharacterRow,
} from "@/lib/character-sheet";
import { errorText } from "@/lib/errors";
import { requireGmAuth } from "@/lib/identity";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/gm/characters")({
	beforeLoad: requireGmAuth,
	component: GmCharactersPage,
});

type Filter = "all" | "PC" | "NPC";

function GmCharactersPage() {
	useI18nVersion();
	const [list, setList] = useState<GameCharacter[]>([]);
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [filter, setFilter] = useState<Filter>("all");
	const [query, setQuery] = useState("");
	const [importOpen, setImportOpen] = useState(false);
	const [importTargetId, setImportTargetId] = useState<string | null>(null);
	const [createOpen, setCreateOpen] = useState(false);
	const [deleteOpen, setDeleteOpen] = useState(false);
	const navigate = useNavigate();

	const reload = useCallback(async () => {
		try {
			const mapped = (await fetchAllPages<CharacterRow>("/gm/characters")).map(
				mapCharacterRow,
			);
			setList(mapped);
			setSelectedId((current) =>
				current && mapped.some((item) => item.id === current)
					? current
					: (mapped[0]?.id ?? null),
			);
		} catch (error) {
			toast.error(errorText(error, "gm.characters.loadFailed"));
		}
	}, []);

	useEffect(() => {
		void reload();
	}, [reload]);

	useEffect(() => {
		if (!selectedId) {
			return;
		}
		let cancelled = false;
		void api<CharacterRow>(`/gm/characters/${encodeURIComponent(selectedId)}`)
			.then((row) => {
				if (cancelled) {
					return;
				}
				const mapped = mapCharacterRow(row);
				setList((current) =>
					current.map((item) => (item.id === mapped.id ? mapped : item)),
				);
			})
			.catch(() => undefined);
		return () => {
			cancelled = true;
		};
	}, [selectedId]);
	async function openSheet(id: string) {
		await navigate({
			to: "/gm/characters/$characterId",
			params: { characterId: id },
		});
	}

	const visible = useMemo(() => {
		const q = query.trim();
		return list.filter(
			(character) =>
				(filter === "all" || character.kind === filter) &&
				(!q || character.name.includes(q)),
		);
	}, [filter, list, query]);
	const selected =
		list.find((character) => character.id === selectedId) ?? list[0];
	const counts = {
		all: list.length,
		PC: list.filter((c) => c.kind === "PC").length,
		NPC: list.filter((c) => c.kind === "NPC").length,
	};

	return (
		<AdminLayout>
			<div className="-mx-10 -my-9 flex h-screen overflow-hidden">
				<aside className="bg-background border-separator-secondary/40 flex w-80 flex-col border-r">
					<div className="flex flex-col gap-3 px-4 pt-5 pb-3">
						<div className="flex items-center justify-between">
							<h1 className="font-sans text-headline-small-emph">
								{t("gm.characters.title")}
							</h1>
							<div className="flex gap-1.5">
								<Button
									type="button"
									onClick={() => setCreateOpen(true)}
									variant="primary"
									size="sm"
									className="h-[30px] px-3"
								>
									<Plus /> {t("gm.characters.create")}
								</Button>
								<Button
									type="button"
									onClick={() => {
										setImportTargetId(null);
										setImportOpen(true);
									}}
									variant="outline"
									size="sm"
									className="h-[30px] px-3"
								>
									{t("gm.characters.import")}
								</Button>
							</div>
						</div>
						<InputGroup className="h-9">
							<InputGroupAddon>
								<Search />
							</InputGroupAddon>
							<InputGroupInput
								value={query}
								onChange={(event) => setQuery(event.target.value)}
								placeholder={t("gm.characters.searchPlaceholder")}
								aria-label={t("gm.characters.searchPlaceholder")}
							/>
						</InputGroup>
						<SegmentedControl
							value={filter}
							options={(
								[
									["all", t("gm.characters.filterAll", { count: counts.all })],
									["PC", t("gm.characters.filterPc", { count: counts.PC })],
									["NPC", t("gm.characters.filterNpc", { count: counts.NPC })],
								] as const
							).map(([value, label]) => ({ value, label }))}
							onValueChange={setFilter}
						/>
					</div>
					<div className="flex-1 overflow-y-auto px-2.5">
						{visible.map((character, index) => (
							<Button
								key={character.id}
								type="button"
								variant="ghost"
								className={cn(
									"animate-in fade-in slide-in-from-bottom-4 mb-1 h-auto w-full justify-start gap-2.5 border border-transparent px-2.5 py-2 duration-500 ease-standard-default-spatial",
									index % 3 === 1
										? "delay-75"
										: index % 3 === 2
											? "delay-150"
											: "",
									selected?.id === character.id &&
										"bg-md-primary-container text-md-on-primary-container border-md-primary/25",
								)}
								onClick={() => setSelectedId(character.id)}
							>
								<Avatar size="sm">
									<AvatarFallback>{character.initial}</AvatarFallback>
								</Avatar>
								<span className="min-w-0 flex-1 truncate text-left text-label-large-emph">
									{character.name}
								</span>
								<Badge variant="soft" size="sm">
									{character.kind}
								</Badge>
							</Button>
						))}
					</div>
				</aside>
				{selected ? (
					<div className="animate-in fade-in slide-in-from-bottom-4 flex flex-1 flex-col gap-4 overflow-auto px-7 py-6 duration-500 ease-standard-default-spatial">
						<div className="flex gap-4">
							<div className="flex w-[132px] shrink-0 flex-col gap-2">
								<div className="bg-surface-tertiary size-[132px] overflow-hidden rounded-t-full rounded-b-xl">
									{selected.portrait ? (
										<img
											src={selected.portrait}
											alt={selected.name}
											className="size-full object-cover"
										/>
									) : (
										<div className="flex size-full items-center justify-center">
											<UserRound />
										</div>
									)}
								</div>
								<span className="text-foreground-tertiary text-center text-label-small">
									{t("gm.characters.portraitPreview")}
								</span>
							</div>
							<div className="flex-1">
								<h2 className="font-sans text-headline-small-emph">
									{selected.name}
								</h2>
								<p className="text-foreground-secondary text-body-medium select-text">
									{selected.meta}
								</p>
								<div className="mt-3 flex flex-wrap items-center gap-2.5">
									<div
										role="toolbar"
										aria-label={t("gm.characters.actionsAria", {
											name: selected.name,
										})}
										className="bg-md-surface-container-high/80 border-md-outline-variant/45 flex flex-wrap items-center gap-1 rounded-full border p-1"
									>
										<Button
											type="button"
											variant="ghost"
											size="sm"
											className="text-md-on-surface hover:bg-md-on-surface/10 h-9 gap-2 rounded-full px-3.5 text-label-medium"
											onClick={() => {
												setImportTargetId(selected.id);
												setImportOpen(true);
											}}
										>
											<FileSpreadsheet className="size-4" />
											{t("gm.characters.importExcel")}
										</Button>
										<Button
											type="button"
											variant="ghost"
											size="sm"
											className="text-md-on-surface hover:bg-md-on-surface/10 h-9 gap-2 rounded-full px-3.5 text-label-medium"
											onClick={() => void openSheet(selected.id)}
										>
											<PencilLine className="size-4" />
											{t("gm.characters.editSheet")}
										</Button>
										<span
											className="bg-md-outline-variant/60 mx-1 h-5 w-px"
											aria-hidden
										/>
										<Button
											type="button"
											variant="ghost"
											size="sm"
											className="text-md-on-surface hover:bg-md-on-surface/10 h-9 gap-2 rounded-full px-3.5 text-label-medium"
											onClick={() => void openSheet(selected.id)}
										>
											<Settings2 className="size-4" />
											{t("characterProfile.openToolbar")}
										</Button>
									</div>
									<DropdownMenu>
										<DropdownMenuTrigger asChild>
											<Button
												variant="ghost"
												size="icon-sm"
												className="text-foreground-tertiary ml-auto size-10"
												aria-label={t("gm.characters.moreActions", {
													name: selected.name,
												})}
											>
												<Ellipsis />
											</Button>
										</DropdownMenuTrigger>
										<DropdownMenuContent align="end">
											<DropdownMenuItem
												variant="destructive"
												onClick={() => setDeleteOpen(true)}
											>
												<Trash2 />
												{t("gm.characters.deleteTitle")}
											</DropdownMenuItem>
										</DropdownMenuContent>
									</DropdownMenu>
								</div>
							</div>
						</div>
						<div className="grid grid-cols-5 gap-2">
							{(["hp", "mp", "san"] as const).map((key) => (
								<Card
									key={key}
									className="border-md-outline-variant/50 rounded-2xl border p-3 text-center"
								>
									<div className="text-foreground-tertiary text-label-small uppercase">
										{key}
									</div>
									<div className="text-body-large-emph">
										{selected.derived[key].current}/{selected.derived[key].max}
									</div>
								</Card>
							))}
							<Card className="border-md-outline-variant/50 rounded-2xl border p-3 text-center">
								<div className="text-label-small">LUCK</div>
								<div className="text-body-large-emph">
									{selected.derived.luck}
								</div>
							</Card>
							<Card className="border-md-outline-variant/50 rounded-2xl border p-3 text-center">
								<div className="text-label-small">MOV</div>
								<div className="text-body-large-emph">
									{selected.derived.mov}
								</div>
							</Card>
						</div>
						<div className="grid grid-cols-2 gap-4">
							<Card className="border-md-outline-variant/50 flex flex-col gap-1 rounded-2xl border p-4">
								<div className="text-md-on-surface-variant mb-1 text-label-medium-emph">
									{t("gm.characters.attributes")}
								</div>
								<div className="grid grid-cols-2 gap-x-8 gap-y-1 select-text">
									{selected.attributes.map((attr) => (
										<div
											key={attr.abbr}
											className="flex justify-between text-body-medium"
										>
											<span>{attr.label}</span>
											<span>{attr.value}</span>
										</div>
									))}
								</div>
							</Card>
							<Card className="border-md-outline-variant/50 flex flex-col gap-1 rounded-2xl border p-4">
								<div className="text-md-on-surface-variant mb-1 text-label-medium-emph">
									{t("gm.characters.skills")}
								</div>
								<div className="grid grid-cols-2 gap-x-8 gap-y-1 select-text">
									{selected.skills.map((skill) => (
										<div
											key={skill.label}
											className="flex justify-between text-body-medium"
										>
											<span>{skill.label}</span>
											<span>{skill.value}</span>
										</div>
									))}
								</div>
							</Card>
						</div>
					</div>
				) : (
					<div className="text-foreground-tertiary flex flex-1 items-center justify-center">
						{t("gm.characters.empty")}
					</div>
				)}
			</div>
			<CreateCharacterDialog
				open={createOpen}
				onOpenChange={setCreateOpen}
				onCreated={(created) => {
					setSelectedId(created.id);
					void openSheet(created.id);
					void reload();
				}}
			/>
			<ImportCharacterSheetDialog
				open={importOpen}
				onOpenChange={(open) => {
					setImportOpen(open);
					if (!open) {
						setImportTargetId(null);
					}
				}}
				onImported={() => void reload()}
				updateCharacterId={importTargetId}
			/>
			<ConfirmDialog
				open={deleteOpen}
				onOpenChange={setDeleteOpen}
				icon={Trash2}
				confirmIcon={Trash2}
				title={t("gm.characters.deleteTitle")}
				description={t("gm.characters.deleteDescription", {
					name: selected?.name ?? "",
				})}
				confirmLabel={t("common.delete")}
				onConfirm={() => {
					const id = selected?.id;
					setDeleteOpen(false);
					if (!id) return;
					void api(`/gm/characters/${encodeURIComponent(id)}`, {
						method: "DELETE",
					})
						.then(() => reload())
						.catch((error) =>
							toast.error(errorText(error, "gm.characters.deleteFailed")),
						);
				}}
			/>
		</AdminLayout>
	);
}
