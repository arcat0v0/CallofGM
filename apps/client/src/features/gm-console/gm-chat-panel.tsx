import {
	ArrowUp,
	ChevronDown,
	Dices,
	History,
	MessagesSquare,
	Paperclip,
	Search,
	X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	InputGroup,
	InputGroupAddon,
	InputGroupInput,
} from "@/components/ui/input-group";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import {
	type ChatChannel,
	filterChatMessages,
} from "@/features/chat/channel-filter";
import { ChatEmptyState } from "@/features/chat/chat-empty-state";
import { ChatMessageCard } from "@/features/chat/chat-message-card";
import { ChatPanelHeader } from "@/features/chat/chat-panel-header";
import { MessageList } from "@/features/chat/message-list";
import { DiceTray } from "@/features/session-live/dice-tray";
import { t } from "@/i18n";
import { sessionStatusLabel } from "@/i18n/labels";
import { expressionLabel, initialsOf } from "@/lib/format";
import { sendSessionCommand } from "@/lib/session-socket";
import { cn } from "@/lib/utils";
import { usePlayStore } from "@/stores/play-store";
import { gmFloatingCard } from "./gm-styles";
import { useGmTool } from "./gm-tool-context";

type MessageMode = "roleplay" | "ooc";

const CHANNEL_LABELS: Record<ChatChannel, string> = {
	all: "gm.workbench.channelAll",
	ic: "gm.workbench.channelIc",
	ooc: "gm.workbench.channelOoc",
};

function GmChatPanel({
	className,
	onOpenHistory,
}: {
	className?: string;
	onOpenHistory?: () => void;
}) {
	const [channel, setChannel] = useState<ChatChannel>("all");
	const [mode, setMode] = useState<MessageMode>("roleplay");
	const [speakerId, setSpeakerId] = useState("");
	const [npcExpressions, setNpcExpressions] = useState<Record<string, string>>(
		{},
	);
	const [draft, setDraft] = useState("");
	const [searchOpen, setSearchOpen] = useState(false);
	const [query, setQuery] = useState("");
	const messages = usePlayStore((state) => state.messages);
	const characters = usePlayStore((state) => state.characters);
	const status = usePlayStore((state) => state.status);
	const historyHasMore = usePlayStore((state) => state.historyHasMore);
	const historyLoading = usePlayStore((state) => state.historyLoading);
	const historyPagesLoaded = usePlayStore((state) => state.historyPagesLoaded);
	const loadOlderHistory = usePlayStore((state) => state.loadOlderHistory);
	const firstPcId = usePlayStore(
		(state) =>
			state.characters.find((character) => character.kind === "pc")
				?.characterId,
	);
	const { openTool } = useGmTool();
	const ended = status === "ended";
	const npcs = useMemo(
		() => characters.filter((character) => character.kind === "npc"),
		[characters],
	);
	const activeSpeakerId = npcs.some(
		(character) => character.characterId === speakerId,
	)
		? speakerId
		: "";
	const speaker =
		npcs.find((character) => character.characterId === activeSpeakerId) ?? null;
	const portraits = speaker?.portraits ?? [];
	const defaultExpression =
		speaker?.currentExpressionKey ??
		portraits.find((portrait) => portrait.isDefault)?.expressionKey ??
		portraits[0]?.expressionKey ??
		"";
	const speakerExpression = speaker
		? (npcExpressions[speaker.characterId] ?? defaultExpression)
		: "";
	const speakerLabel = speaker
		? `${speaker.name} · ${t("common.npc")}`
		: t("chat.role.gm");
	const visible = useMemo(() => {
		const byChannel = filterChatMessages(messages, channel);
		const keyword = query.trim().toLowerCase();
		if (!keyword) {
			return byChannel;
		}
		return byChannel.filter(
			(message) =>
				message.body.toLowerCase().includes(keyword) ||
				message.speakerName.toLowerCase().includes(keyword),
		);
	}, [channel, messages, query]);

	function handleSend() {
		const content = draft.trim();
		if (!content || ended) {
			return;
		}
		const sent = sendSessionCommand("chat:send", {
			channel: mode === "ooc" ? "ooc" : "roleplay",
			content,
			...(speaker ? { characterId: speaker.characterId } : {}),
			...(speaker && speakerExpression
				? { expressionKey: speakerExpression }
				: {}),
		});
		if (!sent) {
			toast.error(t("chat.notConnected"));
			return;
		}
		setDraft("");
	}

	return (
		<div
			className={cn(
				gmFloatingCard,
				"animate-in fade-in flex h-full min-h-0 flex-col gap-4 rounded-xl p-3.5 duration-500",
				className,
			)}
		>
			<ChatPanelHeader
				padded={false}
				className="gap-4"
				statusPosition="end"
				status={
					<span className="text-md-on-surface-variant text-label-medium">
						{ended && status ? sessionStatusLabel(status) : t("chat.realtime")}
					</span>
				}
			>
				<div className="flex shrink-0 items-center justify-between gap-2">
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button
								type="button"
								variant="tertiary"
								size="sm"
								className="bg-md-surface-container-high/80 border border-md-outline-variant/50 h-9 gap-2 rounded-full px-3.5"
							>
								<MessagesSquare className="size-4" />
								{t(CHANNEL_LABELS[channel])}
								<ChevronDown className="size-4" />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="start" className="w-40">
							<DropdownMenuRadioGroup
								value={channel}
								onValueChange={(value) => setChannel(value as ChatChannel)}
							>
								{(Object.keys(CHANNEL_LABELS) as ChatChannel[]).map((key) => (
									<DropdownMenuRadioItem key={key} value={key}>
										{t(CHANNEL_LABELS[key])}
									</DropdownMenuRadioItem>
								))}
							</DropdownMenuRadioGroup>
						</DropdownMenuContent>
					</DropdownMenu>
					<Button
						type="button"
						variant="tertiary"
						size="icon-sm"
						className="bg-md-surface-container-high/80 border border-md-outline-variant/50 text-md-on-surface-variant size-9"
						aria-label={t("gm.workbench.searchChat")}
						aria-pressed={searchOpen}
						onClick={() => {
							setSearchOpen((value) => !value);
							if (searchOpen) {
								setQuery("");
							}
						}}
					>
						{searchOpen ? (
							<X className="size-4" />
						) : (
							<Search className="size-4" />
						)}
					</Button>
					{onOpenHistory ? (
						<Button
							type="button"
							variant="tertiary"
							size="icon-sm"
							className="bg-md-surface-container-high/80 border border-md-outline-variant/50 text-md-on-surface-variant size-9"
							aria-label={t("history.title")}
							title={t("history.title")}
							onClick={onOpenHistory}
						>
							<History className="size-4" />
						</Button>
					) : null}
				</div>

				{searchOpen ? (
					<InputGroup className="h-9 shrink-0">
						<InputGroupAddon className="[&_svg]:size-5">
							<Search />
						</InputGroupAddon>
						<InputGroupInput
							value={query}
							aria-label={t("gm.workbench.searchChat")}
							placeholder={t("gm.workbench.searchChat")}
							className="text-label-medium"
							onChange={(event) => setQuery(event.target.value)}
						/>
					</InputGroup>
				) : null}
			</ChatPanelHeader>

			{visible.length === 0 && !historyHasMore ? (
				<ChatEmptyState variant="gm" title={t("gm.workbench.chatEmpty")} />
			) : (
				<div className="flex min-h-0 flex-1 flex-col justify-end">
					<MessageList
						messages={visible}
						showRoleBadge={false}
						onLoadOlder={loadOlderHistory}
						hasOlderHistory={historyHasMore}
						loadingOlder={historyLoading}
						olderLoads={historyPagesLoaded}
						renderMessage={(message) => (
							<ChatMessageCard message={message} variant="flat" />
						)}
						stickToBottom
						className="min-h-0 max-h-full gap-4 overflow-y-auto pr-0.5"
					/>
				</div>
			)}

			<div className="bg-md-surface-container-high/80 border border-md-outline-variant/40 flex shrink-0 flex-col gap-2.5 rounded-3xl p-3">
				<div className="flex flex-wrap items-center justify-between gap-2">
					<div className="flex flex-wrap items-center gap-1.5">
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<button
									type="button"
									aria-label={t("gm.workbench.speakerMenuAria")}
									className="text-accent flex items-center gap-1.5 rounded-sm text-label-medium outline-none focus-visible:ring-4 focus-visible:ring-focus-ring/50"
								>
									<span
										className={cn(
											"grid size-5 shrink-0 place-items-center rounded-full text-[10px] font-semibold",
											speaker
												? "bg-md-secondary-container text-md-on-secondary-container"
												: "bg-accent text-accent-foreground",
										)}
									>
										{speaker
											? speaker.name.slice(0, 1)
											: initialsOf(t("chat.role.gm"))}
									</span>
									{speakerLabel}
									<ChevronDown className="size-3.5" />
								</button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="start" className="w-60">
								<DropdownMenuRadioGroup
									value={activeSpeakerId}
									onValueChange={(value) => {
										setSpeakerId(value);
										if (value) {
											setMode("roleplay");
										}
									}}
								>
									<DropdownMenuRadioItem value="">
										{t("gm.workbench.speakerGm")}
									</DropdownMenuRadioItem>
									{npcs.map((npc) => (
										<DropdownMenuRadioItem
											key={npc.characterId}
											value={npc.characterId}
										>
											{npc.name}
										</DropdownMenuRadioItem>
									))}
								</DropdownMenuRadioGroup>
							</DropdownMenuContent>
						</DropdownMenu>

						{speaker ? (
							portraits.length > 0 ? (
								<DropdownMenu>
									<DropdownMenuTrigger asChild>
										<button
											type="button"
											aria-label={t("gm.workbench.expressionMenuAria")}
											className="text-md-on-surface-variant hover:bg-md-on-surface/8 flex items-center gap-1 rounded-full px-2 py-0.5 text-label-medium outline-none focus-visible:ring-4 focus-visible:ring-focus-ring/50"
										>
											{expressionLabel(speakerExpression)}
											<ChevronDown className="size-3.5" />
										</button>
									</DropdownMenuTrigger>
									<DropdownMenuContent align="start" className="w-40">
										<DropdownMenuRadioGroup
											value={speakerExpression}
											onValueChange={(value) =>
												setNpcExpressions((current) => ({
													...current,
													[speaker.characterId]: value,
												}))
											}
										>
											{portraits.map((portrait) => (
												<DropdownMenuRadioItem
													key={portrait.expressionKey}
													value={portrait.expressionKey}
												>
													{expressionLabel(portrait.expressionKey)}
												</DropdownMenuRadioItem>
											))}
										</DropdownMenuRadioGroup>
									</DropdownMenuContent>
								</DropdownMenu>
							) : null
						) : (
							<DropdownMenu>
								<DropdownMenuTrigger asChild>
									<button
										type="button"
										className="text-md-on-surface-variant hover:bg-md-on-surface/8 flex items-center gap-1 rounded-full px-2 py-0.5 text-label-medium outline-none focus-visible:ring-4 focus-visible:ring-focus-ring/50"
									>
										{mode === "ooc"
											? t("chat.ooc")
											: t("gm.workbench.narration")}
										<ChevronDown className="size-3.5" />
									</button>
								</DropdownMenuTrigger>
								<DropdownMenuContent align="start" className="w-40">
									<DropdownMenuRadioGroup
										value={mode}
										onValueChange={(value) => setMode(value as MessageMode)}
									>
										<DropdownMenuRadioItem value="roleplay">
											{t("gm.workbench.narration")}
										</DropdownMenuRadioItem>
										<DropdownMenuRadioItem value="ooc">
											{t("chat.ooc")}
										</DropdownMenuRadioItem>
									</DropdownMenuRadioGroup>
								</DropdownMenuContent>
							</DropdownMenu>
						)}
					</div>
				</div>

				<Textarea
					value={draft}
					aria-label={
						speaker
							? t("gm.workbench.composerAsNpc", { name: speaker.name })
							: t("gm.workbench.composerPlaceholder")
					}
					placeholder={
						ended
							? t("chat.endedPlaceholder")
							: speaker
								? t("gm.workbench.composerAsNpc", { name: speaker.name })
								: t("gm.workbench.composerPlaceholder")
					}
					rows={2}
					disabled={ended}
					className="text-md-on-surface placeholder:text-md-on-surface-variant/80 min-h-9 resize-none rounded-none border-0 bg-transparent px-0 py-0 text-body-medium hover:bg-transparent focus-visible:border-transparent disabled:opacity-60"
					onChange={(event) => setDraft(event.target.value)}
					onKeyDown={(event) => {
						if (
							event.key === "Enter" &&
							!event.shiftKey &&
							!event.nativeEvent.isComposing
						) {
							event.preventDefault();
							handleSend();
						}
					}}
				/>

				<div className="flex items-center justify-between gap-2">
					<div className="flex items-center gap-1">
						<Popover>
							<PopoverTrigger asChild>
								<Button
									type="button"
									variant="ghost"
									size="icon-sm"
									className="text-md-on-surface-variant size-8"
									aria-label={t("chat.diceAria")}
									disabled={ended}
								>
									<Dices className="size-4" />
								</Button>
							</PopoverTrigger>
							<PopoverContent
								align="start"
								side="top"
								className="bg-md-surface-container-high w-80"
							>
								<DiceTray gm characterId={firstPcId} disabled={ended} />
							</PopoverContent>
						</Popover>
						<Button
							type="button"
							variant="ghost"
							size="icon-sm"
							className="text-md-on-surface-variant size-8"
							aria-label={t("gm.workbench.openHandouts")}
							disabled={ended}
							onClick={() => openTool("handouts")}
						>
							<Paperclip className="size-4" />
						</Button>
					</div>
					<Button
						type="button"
						variant="primary"
						size="icon-sm"
						className="size-9"
						aria-label={
							speaker
								? t("gm.workbench.sendAsNpc", { name: speaker.name })
								: t("gm.workbench.sendNarration")
						}
						disabled={ended || draft.trim().length === 0}
						onClick={handleSend}
					>
						<ArrowUp className="size-4" />
					</Button>
				</div>
			</div>
		</div>
	);
}

export { GmChatPanel };
