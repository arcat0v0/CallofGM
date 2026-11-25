import type { StageComposition } from "@cogm/shared";
import type { CSSProperties, PointerEvent } from "react";
import { t } from "@/i18n";
import { mediaUrl } from "@/lib/api";
import { cn } from "@/lib/utils";
import { getRuleComponent } from "@/rules/registry";
import { usePlayStore } from "@/stores/play-store";
import { resolveStagePlacements } from "./portrait-layout";

export type StageResizeCorner = "nw" | "ne" | "sw" | "se";

export interface PortraitLayerInteractiveProps {
	selectedId: string | null;
	draggingId: string | null;
	onSelect: (characterId: string) => void;
	onPointerDownMove: (
		characterId: string,
		event: PointerEvent<HTMLElement>,
	) => void;
	onPointerDownScale: (
		characterId: string,
		corner: StageResizeCorner,
		event: PointerEvent<HTMLElement>,
	) => void;
}

function Bar({
	label,
	current,
	max,
	barClassName,
}: {
	label: string;
	current: number;
	max: number;
	barClassName: string;
}) {
	const ratio = max > 0 ? Math.max(0, Math.min(100, (current / max) * 100)) : 0;
	return (
		<div className="flex flex-col gap-0.5">
			<div className="text-md-on-surface/85 flex items-baseline justify-between gap-2 text-label-small">
				<span>{label}</span>
				<span className="tabular-nums">
					{current}/{max}
				</span>
			</div>
			<div className="bg-md-scrim/40 h-[3px] overflow-hidden rounded-full">
				<div
					className={cn("h-full rounded-full", barClassName)}
					style={{ width: `${ratio}%` }}
				/>
			</div>
		</div>
	);
}

const RESIZE_CORNERS: ReadonlyArray<{
	corner: StageResizeCorner;
	className: string;
}> = [
	{
		corner: "nw",
		className: "-top-1.5 -left-1.5 cursor-nwse-resize",
	},
	{
		corner: "ne",
		className: "-top-1.5 -right-1.5 cursor-nesw-resize",
	},
	{
		corner: "sw",
		className: "-bottom-1.5 -left-1.5 cursor-nesw-resize",
	},
	{
		corner: "se",
		className: "-bottom-1.5 -right-1.5 cursor-nwse-resize",
	},
];

function PortraitLayer({
	className,
	compact = false,
	variant = "play",
	showNameplate = true,
	audience = "player",
	compositionOverride,
	expressionOverrides,
	latestSpeakerOverride,
	disableTransitions = false,
	interactive,
}: {
	className?: string;
	compact?: boolean;
	variant?: "play" | "gm";
	showNameplate?: boolean;
	audience?: "player";
	compositionOverride?: StageComposition | null;
	expressionOverrides?: Record<string, string>;
	latestSpeakerOverride?: string | null;
	disableTransitions?: boolean;
	interactive?: PortraitLayerInteractiveProps;
}) {
	const characters = usePlayStore((state) => state.characters);
	const layout = usePlayStore((state) => state.portraitLayout);
	const scale = usePlayStore((state) => state.portraitScale);
	const storeComposition = usePlayStore((state) => state.stageComposition);
	const storeLatestSpeaker = usePlayStore((state) => {
		for (let index = state.messages.length - 1; index >= 0; index -= 1) {
			const message = state.messages[index];
			if (message && message.tone !== "ooc") {
				return message.speakerName;
			}
		}
		return null;
	});

	const composition =
		compositionOverride !== undefined ? compositionOverride : storeComposition;
	const latestSpeaker =
		latestSpeakerOverride !== undefined
			? latestSpeakerOverride
			: storeLatestSpeaker;

	const placements = resolveStagePlacements(
		characters,
		composition,
		layout,
		scale,
		{ clampForCompact: compact },
	);

	const emphasizeSpeakerEnabled = composition?.emphasizeSpeaker ?? true;
	const emphasizeSpeaker =
		emphasizeSpeakerEnabled &&
		placements.length > 1 &&
		latestSpeaker !== null &&
		placements.some((placement) => placement.character.name === latestSpeaker);

	const baseHeightCqh = compact ? 64 : 68;
	const spatialEase =
		variant === "gm"
			? "ease-standard-default-spatial"
			: "ease-expressive-default-spatial";

	return (
		<div
			data-stage-portrait-layer=""
			style={{ containerType: "size" } as CSSProperties}
			className={cn(
				"pointer-events-none absolute inset-x-0",
				compact ? "top-14 bottom-22" : "top-0 bottom-36",
				variant === "gm" && "top-0 bottom-0",
				className,
			)}
		>
			{placements.map((placement) => {
				const { character } = placement;
				const portraits = character.portraits ?? [];
				const activeExpressionKey =
					expressionOverrides?.[character.characterId] ??
					character.currentExpressionKey;
				const current =
					portraits.find(
						(item) => item.expressionKey === activeExpressionKey,
					) ??
					portraits.find((item) => item.isDefault) ??
					portraits[0];
				const ruleComponent = getRuleComponent(character.ruleId);
				const stateSource =
					audience === "player" &&
					character.kind === "npc" &&
					character.publicState !== undefined
						? character.publicState
						: character.state;
				const bars = ruleComponent.stateBars(stateSource);
				const statusLabels = stateSource
					? ruleComponent.statusLabelsOfState(stateSource)
					: [];
				const speaking = !emphasizeSpeaker || character.name === latestSpeaker;
				const isSelected = interactive?.selectedId === character.characterId;
				const isDragging = interactive?.draggingId === character.characterId;
				const noTransition = disableTransitions || isDragging;
				const imgHeightCqh =
					Math.round(baseHeightCqh * placement.scale * 10) / 10;
				const maxWidthCqw = compact
					? Math.min(72, Math.round(52 * placement.scale))
					: Math.min(68, Math.round(48 * placement.scale));
				const placeholderWidthCqh = Math.round(imgHeightCqh * 0.68 * 10) / 10;

				return (
					<div
						key={character.characterId}
						data-stage-character={character.characterId}
						data-selected={isSelected ? "true" : undefined}
						className={cn(
							"absolute flex -translate-x-1/2 flex-col items-center gap-2",
							!noTransition &&
								cn(
									"animate-in fade-in duration-500 transition-[left,bottom,opacity,transform,filter]",
									spatialEase,
								),
							emphasizeSpeaker &&
								!speaking &&
								!isSelected &&
								"scale-[0.97] opacity-55 saturate-75",
							interactive &&
								"pointer-events-auto cursor-grab active:cursor-grabbing",
						)}
						style={{
							left: `${placement.x}%`,
							bottom: `${placement.y}%`,
							zIndex: placement.zIndex,
						}}
						onPointerDown={
							interactive
								? (event) => {
										interactive.onSelect(character.characterId);
										interactive.onPointerDownMove(character.characterId, event);
									}
								: undefined
						}
					>
						<div
							className={cn(
								"relative flex items-end justify-center",
								interactive &&
									"rounded-xl transition-[box-shadow] duration-150",
								interactive &&
									!isSelected &&
									"hover:ring-md-primary/45 hover:ring-1",
								isSelected &&
									"ring-md-primary bg-md-primary/6 ring-2 ring-offset-2 ring-offset-transparent",
							)}
						>
							{current ? (
								<img
									src={mediaUrl(current.portraitAssetId) ?? undefined}
									alt={character.name}
									draggable={false}
									style={{
										height: `${imgHeightCqh}cqh`,
										maxWidth: `${maxWidthCqw}cqw`,
									}}
									className={cn(
										"w-auto object-contain object-bottom select-none drop-shadow-[0_18px_40px_rgba(0,0,0,0.55)] [mask-image:linear-gradient(to_bottom,black_88%,transparent)]",
										!noTransition &&
											cn(
												"transition-[height,transform] duration-500",
												spatialEase,
											),
										placement.flipX && "-scale-x-100",
									)}
								/>
							) : (
								<div
									role="img"
									aria-label={t("stage.portraitPendingAria", {
										name: character.name,
									})}
									style={{
										height: `${imgHeightCqh}cqh`,
										width: `${placeholderWidthCqh}cqh`,
										maxWidth: `${maxWidthCqw}cqw`,
									}}
									className={cn(
										"bg-stage-panel relative flex shrink-0 flex-col items-center justify-end overflow-hidden rounded-t-full rounded-b-xl select-none",
										!noTransition &&
											cn(
												"transition-[height,width,transform] duration-500",
												spatialEase,
											),
									)}
								>
									<span
										aria-hidden
										className={cn(
											"bg-md-on-surface/15 absolute bottom-0 left-1/2 h-[52%] w-[64%] -translate-x-1/2 rounded-t-full",
											placement.flipX && "-scale-x-100",
										)}
									/>
									<span
										aria-hidden
										className="bg-md-on-surface/15 absolute bottom-[44%] left-1/2 size-[28%] -translate-x-1/2 rounded-full"
									/>
									<span
										className={cn(
											"text-md-on-surface/85 relative font-serif",
											compact
												? "mb-1 text-title-medium-emph"
												: "mb-2 text-headline-small-emph",
										)}
									>
										{character.name.slice(0, 1)}
									</span>
									<span
										className={cn(
											"text-md-on-surface relative mb-2 text-label-small",
											compact && "mb-1",
										)}
									>
										{t("stage.portraitPending")}
									</span>
								</div>
							)}

							{interactive && isSelected ? (
								<>
									<div className="bg-md-primary text-md-on-primary pointer-events-none absolute -top-7 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-label-small-emph whitespace-nowrap shadow-card">
										<span>{character.name}</span>
										<span className="opacity-80 tabular-nums">
											{Math.round(placement.scale * 100)}%
										</span>
									</div>
									{RESIZE_CORNERS.map(({ corner, className: cornerClass }) => (
										<button
											key={corner}
											type="button"
											aria-label={t("gm.stageStudio.resizeAria", {
												name: character.name,
											})}
											data-resize-handle={corner}
											onPointerDown={(event) => {
												event.stopPropagation();
												interactive.onPointerDownScale(
													character.characterId,
													corner,
													event,
												);
											}}
											className={cn(
												"bg-md-primary border-md-on-primary absolute z-20 size-3.5 rounded-full border-2 shadow-card",
												cornerClass,
											)}
										/>
									))}
								</>
							) : null}
						</div>

						{showNameplate ? (
							<>
								<div
									className={cn(
										"stage-glass shadow-card shrink-0 rounded-xl",
										compact ? "px-2 py-1" : "px-2.5 py-1.5",
									)}
								>
									<span
										className={cn(
											"text-md-on-surface block text-center",
											compact
												? "text-label-small-emph"
												: "text-label-medium-emph",
										)}
									>
										{character.name}
									</span>
								</div>
								{bars.length > 0 || statusLabels.length > 0 ? (
									<div
										className={cn(
											"flex w-36 max-w-40 flex-col",
											compact ? "w-28 gap-1" : "gap-1.5",
										)}
									>
										{bars.map((bar) => (
											<Bar
												key={bar.key}
												label={bar.label}
												current={bar.current}
												max={bar.max}
												barClassName={bar.barClassName}
											/>
										))}
										{statusLabels.length > 0 ? (
											<div className="text-warning text-center text-label-small">
												{statusLabels.join(" ")}
											</div>
										) : null}
									</div>
								) : character.kind === "npc" ? (
									<div className="text-md-on-surface/70 text-center text-label-small">
										NPC
									</div>
								) : null}
							</>
						) : null}
					</div>
				);
			})}
		</div>
	);
}

export { PortraitLayer };
