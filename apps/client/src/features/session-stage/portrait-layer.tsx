import { t } from "@/i18n";
import { mediaUrl } from "@/lib/api";
import { parseCocState } from "@/lib/coc-live";
import { cn } from "@/lib/utils";
import { getRuleComponent } from "@/rules/registry";
import { usePlayStore } from "@/stores/play-store";
import { portraitSlots, portraitSlotWidths } from "./portrait-layout";

function Bar({
	label,
	current,
	max,
	className,
	dense = false,
}: {
	label: string;
	current: number;
	max: number;
	className?: string;
	dense?: boolean;
}) {
	const ratio = max > 0 ? Math.max(0, Math.min(100, (current / max) * 100)) : 0;
	if (dense) {
		return (
			<div className="text-md-on-surface/80 flex items-center gap-1.5 text-label-small">
				<span className="w-6 shrink-0">{label}</span>
				<span className="bg-md-scrim/40 h-1 min-w-0 flex-1 overflow-hidden rounded-full">
					<span
						className={cn("block h-full rounded-full", className)}
						style={{ width: `${ratio}%` }}
					/>
				</span>
				<span className="shrink-0 tabular-nums">
					{current}/{max}
				</span>
			</div>
		);
	}
	return (
		<div className="flex flex-col gap-0.5">
			<div className="text-md-on-surface/80 flex justify-between text-label-small">
				<span>{label}</span>
				<span>
					{current}/{max}
				</span>
			</div>
			<div className="bg-md-scrim/40 h-1.5 overflow-hidden rounded-full">
				<div
					className={cn("h-full rounded-full", className)}
					style={{ width: `${ratio}%` }}
				/>
			</div>
		</div>
	);
}

function PortraitLayer({
	className,
	compact = false,
	variant = "play",
	showNameplate = true,
}: {
	className?: string;
	compact?: boolean;
	variant?: "play" | "gm";
	showNameplate?: boolean;
}) {
	const characters = usePlayStore((state) => state.characters);
	const layout = usePlayStore((state) => state.portraitLayout);
	const scale = usePlayStore((state) => state.portraitScale);
	const latestSpeaker = usePlayStore((state) => {
		for (let index = state.messages.length - 1; index >= 0; index -= 1) {
			const message = state.messages[index];
			if (message && message.tone !== "ooc") {
				return message.speakerName;
			}
		}
		return null;
	});
	const visible = characters
		.filter(
			(character) => character.kind === "pc" || character.currentExpressionKey,
		)
		.slice(0, 4);
	const slots = portraitSlots(visible.length, layout);
	const slotWidth = portraitSlotWidths(visible.length, layout);
	const emphasizeSpeaker =
		visible.length > 1 &&
		visible.some((character) => character.name === latestSpeaker);
	const heightClass = compact
		? scale === "lg"
			? "max-h-[46dvh]"
			: "max-h-[38dvh]"
		: scale === "lg"
			? "h-[68dvh] max-h-[760px]"
			: "h-[56dvh] max-h-[620px]";

	return (
		<div
			className={cn(
				"pointer-events-none absolute inset-x-0",
				compact ? "top-14 bottom-22" : "top-0 bottom-36",
				variant === "gm" && "top-0 bottom-0",
				className,
			)}
		>
			{visible.map((character, index) => {
				const portraits = character.portraits ?? [];
				const current =
					portraits.find(
						(item) => item.expressionKey === character.currentExpressionKey,
					) ??
					portraits.find((item) => item.isDefault) ??
					portraits[0];
				const state = parseCocState(character.state);
				const left = slots[index] ?? 50;
				const speaking = !emphasizeSpeaker || character.name === latestSpeaker;
				const depth = emphasizeSpeaker
					? speaking
						? 30
						: 10 + index
					: 10 - Math.abs(index - (visible.length - 1) / 2) * 2;
				return (
					<div
						key={character.characterId}
						className={cn(
							"absolute bottom-0 flex -translate-x-1/2 flex-col items-center gap-2 transition-[left,width,opacity,transform] duration-500 ease-standard-default-spatial",
							emphasizeSpeaker &&
								!speaking &&
								"scale-[0.98] opacity-55 saturate-75",
						)}
						style={{ left: `${left}%`, width: `${slotWidth}%`, zIndex: depth }}
					>
						{current ? (
							<img
								src={mediaUrl(current.portraitAssetId) ?? undefined}
								alt={character.name}
								className={cn(
									"w-full object-contain object-bottom drop-shadow-[0_18px_40px_rgba(0,0,0,0.55)] [mask-image:linear-gradient(to_bottom,black_88%,transparent)]",
									heightClass,
								)}
							/>
						) : (
							<div
								role="img"
								aria-label={t("stage.portraitPendingAria", {
									name: character.name,
								})}
								className={cn(
									"bg-stage-panel relative flex w-full shrink-0 flex-col items-center justify-end overflow-hidden rounded-t-full rounded-b-xl",
									heightClass,
								)}
							>
								<span
									aria-hidden
									className="bg-md-on-surface/15 absolute bottom-0 left-1/2 h-[52%] w-[64%] -translate-x-1/2 rounded-t-full"
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
						{showNameplate ? (
							<div
								className={cn(
									"bg-md-surface-container-low/85 border border-md-outline-variant/40 shadow-card shrink-0 rounded-xl backdrop-blur-xl",
									compact ? "w-28 px-2 py-1.5" : "w-40 px-2.5 py-2",
								)}
							>
								<div
									className={cn(
										"text-md-on-surface text-center",
										compact
											? "text-label-small-emph"
											: "text-label-medium-emph",
									)}
								>
									{character.name}
								</div>
								{state ? (
									<div
										className={cn(
											"flex flex-col",
											compact ? "mt-1 gap-0.5" : "mt-1.5 gap-1",
										)}
									>
										<Bar
											label="HP"
											current={state.hp}
											max={state.maxHp}
											className="bg-danger"
											dense={compact}
										/>
										<Bar
											label="MP"
											current={state.mp}
											max={state.maxMp}
											className="bg-brand-sora"
											dense={compact}
										/>
										<Bar
											label="SAN"
											current={state.san}
											max={state.maxSan}
											className="bg-brand-fuji"
											dense={compact}
										/>
										{state.statuses.length > 0 ? (
											<div className="text-warning text-label-small">
												{getRuleComponent(character.ruleId)
													.statusLabels(state.statuses)
													.join(" ")}
											</div>
										) : null}
									</div>
								) : character.kind === "npc" ? (
									<div className="text-foreground-tertiary text-center text-label-small">
										NPC
									</div>
								) : null}
							</div>
						) : null}
					</div>
				);
			})}
		</div>
	);
}

export { PortraitLayer };
