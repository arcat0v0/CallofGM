import type { PlayLayoutCtx } from "@cogm/theme-sdk";
import { MessagesSquare } from "lucide-react";
import type { CSSProperties } from "react";
import { Button } from "@/components/ui/button";
import { t } from "@/i18n";
import { cn } from "@/lib/utils";

function ExpandChatButton({
	onExpand,
	compact = false,
	className,
}: {
	onExpand: () => void;
	compact?: boolean;
	className?: string;
}) {
	return (
		<div className={cn("absolute z-20", className)}>
			<Button
				type="button"
				variant="tertiary"
				size={compact ? "icon-sm" : "sm"}
				onClick={onExpand}
				aria-label={t("play.expandChat")}
				title={t("play.expandChat")}
				className={cn(
					"stage-glass text-md-on-surface-variant shadow-overlay animate-in fade-in rounded-full duration-350",
					compact ? "size-11 px-0" : "h-11 gap-2 px-4 text-label-large",
				)}
			>
				<MessagesSquare className={compact ? "size-5" : "size-4"} />
				{compact ? null : <span>{t("play.expandChat")}</span>}
			</Button>
		</div>
	);
}

export function PlayLayout({ viewport, nodes, view, actions }: PlayLayoutCtx) {
	const chatOpen = view.chatOpen ?? view.landscapeChatOpen;
	const setChatOpen = actions.setChatOpen ?? actions.setLandscapeChatOpen;

	if (viewport === "portrait") {
		return (
			<div className="bg-md-surface-container-lowest relative flex h-full w-full flex-col gap-2 overflow-hidden p-2">
				{nodes.connection}
				<div className="relative h-[clamp(280px,46dvh,430px)] w-full shrink-0 overflow-hidden rounded-xl">
					{nodes.stage}
				</div>
				<div className="stage-glass shadow-overlay relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl">
					{nodes.chat}
					<div className="flex shrink-0 justify-center px-3 pb-1">
						{nodes.dock}
					</div>
					{nodes.composer}
				</div>
				{nodes.overlays}
			</div>
		);
	}

	if (viewport === "landscape") {
		const chatInset = chatOpen ? "calc(300px + 1rem)" : "0px";
		return (
			<div
				className="bg-background relative h-full w-full overflow-hidden"
				style={{ "--play-chat-inset": chatInset } as CSSProperties}
			>
				{nodes.connection}
				<div className="absolute inset-0">{nodes.stage}</div>
				{chatOpen ? (
					<div className="stage-glass shadow-overlay animate-in fade-in absolute top-2 right-2 bottom-2 z-20 flex w-[300px] flex-col duration-350 ease-expressive-fast-effects overflow-hidden rounded-xl">
						{nodes.chat}
						<div className="flex shrink-0 justify-center px-3 pb-1">
							{nodes.dock}
						</div>
						{nodes.composer}
					</div>
				) : (
					<>
						<div className="absolute bottom-3 left-3 z-30">{nodes.dock}</div>
						<ExpandChatButton
							compact
							className="top-14 right-2"
							onExpand={() => setChatOpen(true)}
						/>
					</>
				)}
				{nodes.overlays}
			</div>
		);
	}

	const chatInset = chatOpen ? "calc(clamp(344px, 26vw, 400px) + 2rem)" : "0px";
	return (
		<div
			className="bg-background relative h-full w-full overflow-hidden"
			style={{ "--play-chat-inset": chatInset } as CSSProperties}
		>
			{nodes.connection}
			<div className="absolute inset-0">{nodes.stage}</div>
			<div className="pointer-events-none absolute inset-y-0 left-0 right-[var(--play-chat-inset,0px)] z-30 transition-[right] duration-500 ease-expressive-default-spatial">
				<div className="pointer-events-auto absolute top-4 left-1/2 -translate-x-1/2">
					{nodes.dock}
				</div>
			</div>
			{chatOpen ? (
				<div className="stage-glass shadow-overlay animate-in fade-in absolute top-4 right-4 bottom-4 z-20 flex w-[clamp(344px,26vw,400px)] flex-col duration-350 ease-expressive-fast-effects overflow-hidden rounded-xl">
					{nodes.chat}
					{nodes.composer}
				</div>
			) : (
				<ExpandChatButton
					className="top-4 right-4"
					onExpand={() => setChatOpen(true)}
				/>
			)}
			{nodes.overlays}
		</div>
	);
}
