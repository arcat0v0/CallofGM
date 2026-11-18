import type { VoiceMember } from "@cogm/shared";
import { Headphones, Mic, MicOff, Volume2, VolumeX } from "lucide-react";
import { useId, useState, useSyncExternalStore } from "react";
import { ToolDockButton } from "@/components/shared/tool-dock";
import { Alert, AlertContent, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { t, translateOr, useI18nVersion } from "@/i18n";
import type { VoiceController } from "./voice-controller";

function VoiceRoster({
	members,
	selfId,
	manage,
	busy,
	voice,
}: {
	members: VoiceMember[];
	selfId: string | null;
	manage: boolean;
	busy: boolean;
	voice: VoiceController;
}) {
	return (
		<ul
			aria-label={t("voice.members")}
			className="bg-md-surface-container-low flex max-h-64 flex-col gap-1 overflow-y-auto rounded-lg p-2"
		>
			{members.map((member) => (
				<li
					className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-2 py-1"
					key={member.id}
				>
					<div className="flex min-w-0 flex-1 items-center gap-2">
						<span
							className="min-w-0 truncate text-body-medium"
							title={member.name}
						>
							{member.name}
						</span>
						<Badge variant="soft" size="sm">
							{t(`voice.role.${member.role}`)}
						</Badge>
						{selfId === member.id ? (
							<Badge variant="soft" tone="accent" size="sm">
								{t("voice.self")}
							</Badge>
						) : null}
						{!member.canSpeak ? (
							<Badge variant="tertiary" size="sm">
								{t(member.muted ? "voice.moderatorMuted" : "voice.listenOnly")}
							</Badge>
						) : null}
					</div>
					{manage && member.role !== "gm" ? (
						<div className="flex flex-wrap gap-1">
							{member.role === "ob" ? (
								<Button
									type="button"
									variant="outline"
									size="sm"
									className="min-h-11"
									disabled={busy}
									aria-label={t(
										member.speakGranted ? "voice.revokeFor" : "voice.grantFor",
										{ name: member.name },
									)}
									onClick={() =>
										voice.moderate({
											memberId: member.id,
											speakGranted: !member.speakGranted,
										})
									}
								>
									{t(member.speakGranted ? "voice.revoke" : "voice.grant")}
								</Button>
							) : null}
							<Button
								type="button"
								variant="outline"
								size="sm"
								className="min-h-11"
								disabled={busy}
								aria-label={t(
									member.muted ? "voice.unmuteFor" : "voice.muteFor",
									{ name: member.name },
								)}
								onClick={() =>
									voice.moderate({ memberId: member.id, muted: !member.muted })
								}
							>
								{t(member.muted ? "voice.unmute" : "voice.mute")}
							</Button>
						</div>
					) : null}
				</li>
			))}
		</ul>
	);
}

export function VoiceDockButton({
	voice,
	showLabel,
	wideOnlyLabel,
	onOpen,
}: {
	voice: VoiceController;
	showLabel?: boolean;
	wideOnlyLabel?: boolean;
	onOpen?: () => void;
}) {
	useI18nVersion();
	const [open, setOpen] = useState(false);
	const limitId = useId();
	const {
		link,
		state,
		member,
		pending,
		mic,
		playbackMuted,
		playbackBlocked,
		peerConnecting,
		peerFailed,
		error,
	} = useSyncExternalStore(voice.subscribe, voice.getSnapshot);
	const roomFull = !!state && state.memberCount >= state.limit;
	const status =
		link !== "ready"
			? `voice.link.${link}`
			: pending === "voice:join"
				? "voice.joining"
				: pending === "voice:leave"
					? "voice.leaving"
					: member
						? "voice.joined"
						: !state?.available
							? "voice.unavailable"
							: !state.enabled
								? "voice.closed"
								: roomFull
									? "voice.full"
									: "voice.open";
	const MicIcon = mic === "on" ? Mic : MicOff;
	const PlaybackIcon = playbackMuted ? VolumeX : Volume2;
	return (
		<Dialog
			open={open}
			onOpenChange={(next) => {
				if (next) onOpen?.();
				setOpen(next);
			}}
		>
			<DialogTrigger asChild>
				<ToolDockButton
					icon={Headphones}
					label={t("voice.title")}
					active={open || member !== null}
					showLabel={showLabel}
					wideOnlyLabel={wideOnlyLabel}
				/>
			</DialogTrigger>
			<DialogContent className="max-h-[calc(100dvh-2rem)] max-w-lg overflow-y-auto">
				<DialogHeader>
					<DialogTitle>{t("voice.title")}</DialogTitle>
					<DialogDescription>{t("voice.description")}</DialogDescription>
				</DialogHeader>
				<div role="status" className="flex flex-wrap items-center gap-2">
					<Badge tone={member ? "accent" : "default"} variant="soft">
						{t(status)}
					</Badge>
					{state ? (
						<span className="text-muted-foreground text-body-medium tabular-nums">
							{t("voice.count", {
								count: state.memberCount,
								limit: state.limit,
							})}
						</span>
					) : null}
					{member && peerConnecting > 0 ? (
						<span className="text-muted-foreground text-body-medium">
							{t("voice.peersConnecting", { count: peerConnecting })}
						</span>
					) : null}
				</div>
				{error ? (
					<Alert variant="danger">
						<AlertContent>
							<AlertDescription>
								{translateOr(`voice.error.${error}`, t("voice.error.generic"))}
							</AlertDescription>
						</AlertContent>
					</Alert>
				) : null}
				{member ? (
					<>
						<div className="flex flex-wrap gap-2">
							<Button
								type="button"
								variant={mic === "on" ? "primary" : "outline"}
								className="min-h-11"
								disabled={!member.canSpeak}
								onClick={() => {
									void voice.toggleMic();
								}}
							>
								<MicIcon data-icon="inline-start" />
								{t(
									mic === "on"
										? "voice.micOff"
										: mic === "requesting"
											? "voice.micCancel"
											: "voice.micOn",
								)}
							</Button>
							<Button
								type="button"
								variant="outline"
								className="min-h-11"
								onClick={() => voice.togglePlayback()}
							>
								<PlaybackIcon data-icon="inline-start" />
								{t(playbackMuted ? "voice.playbackOn" : "voice.playbackOff")}
							</Button>
							<Button
								type="button"
								variant="ghost"
								className="min-h-11"
								onClick={() => voice.leave()}
							>
								{t("voice.leave")}
							</Button>
						</div>
						{!member.canSpeak ? (
							<p className="text-muted-foreground text-body-medium">
								{t(member.muted ? "voice.mutedHint" : "voice.listenHint")}
							</p>
						) : null}
						{mic === "denied" || mic === "unavailable" ? (
							<Alert variant="warning">
								<AlertContent>
									<AlertDescription>{t(`voice.mic.${mic}`)}</AlertDescription>
								</AlertContent>
							</Alert>
						) : null}
						{playbackBlocked ? (
							<Alert variant="warning">
								<AlertContent>
									<AlertDescription>{t("voice.autoplayHint")}</AlertDescription>
								</AlertContent>
								<Button
									type="button"
									variant="outline"
									className="min-h-11"
									onClick={() => voice.retryPlayback()}
								>
									{t("voice.retryPlayback")}
								</Button>
							</Alert>
						) : null}
						{peerFailed > 0 ? (
							<Alert variant="warning">
								<AlertContent>
									<AlertDescription>
										{t("voice.peersFailed", { count: peerFailed })}
									</AlertDescription>
								</AlertContent>
							</Alert>
						) : null}
					</>
				) : state?.enabled && state.available ? (
					<Button
						type="button"
						className="min-h-11 justify-self-start"
						disabled={roomFull || pending !== null}
						onClick={() => voice.join()}
					>
						{t("voice.join")}
					</Button>
				) : null}
				{state?.canManage ? (
					<div className="flex flex-wrap items-end gap-3">
						<Field className="w-auto">
							<FieldLabel htmlFor={limitId}>{t("voice.limit")}</FieldLabel>
							<Select
								value={String(state.limit)}
								disabled={state.enabled || !state.available || pending !== null}
								onValueChange={(value) =>
									voice.configure({ limit: Number(value) })
								}
							>
								<SelectTrigger id={limitId} className="min-h-11">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectGroup>
										{Array.from(
											{ length: state.maxLimit - 1 },
											(_, index) => index + 2,
										).map((limit) => (
											<SelectItem
												key={limit}
												value={String(limit)}
												disabled={limit < state.memberCount}
											>
												{t("voice.limitOption", { limit })}
											</SelectItem>
										))}
									</SelectGroup>
								</SelectContent>
							</Select>
						</Field>
						<Button
							type="button"
							variant={state.enabled ? "outline" : "primary"}
							className="min-h-11"
							disabled={
								(!state.enabled && !state.available) || pending !== null
							}
							onClick={() => voice.configure({ enabled: !state.enabled })}
						>
							{t(state.enabled ? "voice.closeRoom" : "voice.openRoom")}
						</Button>
					</div>
				) : null}
				{state && state.members.length > 0 ? (
					<VoiceRoster
						members={state.members}
						selfId={member?.id ?? null}
						manage={state.canManage}
						busy={pending !== null}
						voice={voice}
					/>
				) : null}
			</DialogContent>
		</Dialog>
	);
}
