import type { JoinInfoResponse, SessionStatus } from "@cogm/shared";
import type { JoinSeatView } from "@cogm/theme-sdk";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Link2Off, LogIn, LogOut, RotateCw } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { t, useI18nVersion } from "@/i18n";
import { api, isApiError } from "@/lib/api";
import { initialsOf } from "@/lib/format";
import { ensurePlayer, logoutAccount } from "@/lib/identity";
import { cn } from "@/lib/utils";
import { ThemeScope } from "@/themes/runtime/theme-scope";
import { ThemeSlot } from "@/themes/runtime/theme-slot";

export const Route = createFileRoute("/join/$sessionId")({
	component: JoinPage,
});

const OB_SEAT_ID = "ob";

const STAGGER_DELAYS = ["delay-75", "delay-150", "delay-225"] as const;

const joinInfoRequests = new Map<string, Promise<JoinInfoResponse>>();

function fetchJoinInfo(sessionId: string): Promise<JoinInfoResponse> {
	const pending = joinInfoRequests.get(sessionId);
	if (pending) {
		return pending;
	}
	const request = api<JoinInfoResponse>(
		`/public/sessions/${encodeURIComponent(sessionId)}/join-info`,
	);
	joinInfoRequests.set(sessionId, request);
	const clear = () => {
		if (joinInfoRequests.get(sessionId) === request) {
			joinInfoRequests.delete(sessionId);
		}
	};
	void request.then(clear, clear);
	return request;
}

function JoinPage() {
	useI18nVersion();
	const { sessionId } = Route.useParams();
	const navigate = useNavigate();
	const [pcSeats, setPcSeats] = useState<
		Array<{ id: string; name: string; claimed: boolean }>
	>([]);
	const [status, setStatus] = useState<SessionStatus | null>(null);
	const [moduleName, setModuleName] = useState<string | null>(null);
	const [sessionName, setSessionName] = useState<string | null>(null);
	const [themeId, setThemeId] = useState<string | null>(null);
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [loading, setLoading] = useState(true);
	const [joining, setJoining] = useState(false);
	const [loadError, setLoadError] = useState<string | null>(null);
	const [loadErrorCode, setLoadErrorCode] = useState<string | null>(null);
	const [leavingGm, setLeavingGm] = useState(false);
	const [reloadToken, setReloadToken] = useState(0);

	useEffect(() => {
		let cancelled = false;
		setLoading(true);
		setLoadError(null);
		setLoadErrorCode(null);
		void (async () => {
			try {
				await ensurePlayer();
				const info = await fetchJoinInfo(sessionId);
				if (cancelled) {
					return;
				}
				const nextPcSeats = info.characters
					.filter((character) => character.kind === "pc")
					.map((character) => ({
						id: character.id,
						name: character.name,
						claimed: character.claimed,
					}));
				setPcSeats(nextPcSeats);
				setStatus(info.session.status);
				setModuleName(info.session.moduleName);
				setSessionName(info.session.name);
				setThemeId(info.session.themeId);
				if (info.session.status === "ended") {
					setSelectedId(OB_SEAT_ID);
				} else {
					const firstOpen = nextPcSeats.find((seat) => !seat.claimed);
					setSelectedId(firstOpen?.id ?? OB_SEAT_ID);
				}
			} catch (error) {
				if (!cancelled) {
					setLoadError(
						isApiError(error) ? error.message : t("join.loadFailed"),
					);
					setLoadErrorCode(isApiError(error) ? error.code : null);
				}
			} finally {
				if (!cancelled) {
					setLoading(false);
				}
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [sessionId, reloadToken]);

	const isEnded = status === "ended";

	const cardSeats: JoinSeatView[] = pcSeats.map((seat) => ({
		id: seat.id,
		name: seat.name,
		detail: t("join.pcDetail"),
		initial: initialsOf(seat.name),
		kind: "character",
		claimed: seat.claimed,
	}));
	const obSeat: JoinSeatView = {
		id: OB_SEAT_ID,
		name: t("join.obName"),
		detail: t("join.obDetail"),
		kind: "spectator",
		claimed: false,
	};
	const seats = [...cardSeats, obSeat];
	const selectedSeat = seats.find(
		(seat) => seat.id === selectedId && !seat.claimed,
	);

	const handleJoin = async () => {
		if (joining) {
			return;
		}
		setJoining(true);
		try {
			await ensurePlayer();
			const claimPayload =
				isEnded || selectedSeat?.kind === "spectator"
					? { role: "ob" as const }
					: { role: "pc" as const, characterId: selectedSeat?.id };
			await api(`/sessions/${encodeURIComponent(sessionId)}/claim`, {
				method: "POST",
				body: JSON.stringify(claimPayload),
			});
			await navigate({ to: "/play/$sessionId", params: { sessionId } });
		} catch (error) {
			setLoadError(isApiError(error) ? error.message : t("join.claimFailed"));
			setLoadErrorCode(isApiError(error) ? error.code : null);
		} finally {
			setJoining(false);
		}
	};

	async function leaveGmAndRetry() {
		if (leavingGm) {
			return;
		}
		setLeavingGm(true);
		try {
			await logoutAccount().catch(() => undefined);
			setLoadError(null);
			setLoadErrorCode(null);
			setReloadToken((token) => token + 1);
		} finally {
			setLeavingGm(false);
		}
	}

	const header = (
		<ThemeSlot
			name="join.header"
			ctx={{
				status,
				moduleName,
				sessionName,
				loading,
				ended: isEnded,
				loadError,
			}}
		/>
	);

	const notice = loadError ? (
		<div className="animate-in fade-in slide-in-from-bottom-4 ease-expressive-default-spatial flex flex-col items-center gap-4 duration-500">
			<div className="bg-md-error-container text-md-on-error-container flex size-16 items-center justify-center rounded-t-full rounded-b-xl">
				<Link2Off className="size-7" />
			</div>
			<p className="text-danger text-body-medium text-center">{loadError}</p>
		</div>
	) : isEnded ? (
		<div className="bg-md-surface-container-low animate-in fade-in slide-in-from-bottom-4 ease-expressive-default-spatial flex max-w-md flex-col items-center gap-2 rounded-2xl px-6 py-5 text-center duration-500">
			<span className="text-body-medium text-foreground-secondary">
				{t("join.seatsClosed")}
			</span>
			<span className="text-body-small text-foreground-tertiary">
				{t("join.seatsClosedDescription")}
			</span>
		</div>
	) : null;

	const seatNodes = loading ? (
		<p className="text-foreground-tertiary text-body-medium">
			{t("join.loadingSeats")}
		</p>
	) : (
		<div
			className="flex flex-wrap justify-center gap-4"
			role="radiogroup"
			aria-label={t("join.chooseGroup")}
		>
			{cardSeats.map((seat, index) => (
				<ThemeSlot
					key={seat.id}
					name="join.seat-card"
					ctx={{
						seat,
						selected: selectedId === seat.id,
						disabled: seat.claimed,
						onSelect: () => setSelectedId(seat.id),
						variant: "card",
						className: cn(
							"animate-in fade-in slide-in-from-bottom-4 duration-500 ease-expressive-default-spatial fill-mode-backwards",
							STAGGER_DELAYS[index % STAGGER_DELAYS.length],
						),
					}}
				/>
			))}
		</div>
	);

	const spectator =
		!loading && !loadError && !isEnded ? (
			<div className="animate-in fade-in slide-in-from-bottom-4 duration-500 ease-expressive-default-spatial fill-mode-backwards delay-225 flex w-full justify-center">
				<ThemeSlot
					name="join.seat-card"
					ctx={{
						seat: obSeat,
						selected: selectedId === obSeat.id,
						disabled: false,
						onSelect: () => setSelectedId(obSeat.id),
						variant: "row",
					}}
				/>
			</div>
		) : null;

	const action = loadError ? (
		<div className="animate-in fade-in slide-in-from-bottom-4 ease-expressive-default-spatial flex flex-wrap items-center justify-center gap-2 duration-500">
			{loadErrorCode === "GM_SESSION_ACTIVE" ? (
				<Button
					type="button"
					variant="primary"
					size="lg"
					disabled={leavingGm}
					onClick={() => void leaveGmAndRetry()}
				>
					<LogOut className="size-4" />
					{t("join.leaveGmAndJoin")}
				</Button>
			) : (
				<Button
					type="button"
					variant="primary"
					size="lg"
					onClick={() => setReloadToken((token) => token + 1)}
				>
					<RotateCw className="size-4" />
					{t("common.retry")}
				</Button>
			)}
			<Button asChild variant="tertiary" size="lg">
				<Link to="/">{t("play.returnEntry")}</Link>
			</Button>
		</div>
	) : (
		<div className="animate-in fade-in slide-in-from-bottom-4 duration-500 ease-expressive-default-spatial fill-mode-backwards delay-225 flex flex-col items-center gap-3">
			<Button
				type="button"
				disabled={joining || (!isEnded && !selectedSeat)}
				onClick={() => void handleJoin()}
				variant="primary"
				size="lg"
			>
				<LogIn className="size-4" />
				{isEnded
					? t("join.enterReview")
					: selectedSeat
						? t("join.enterAs", { name: selectedSeat.name })
						: t("join.selectSeat")}
			</Button>
			<p className="text-label-small text-foreground-tertiary">
				{isEnded ? t("join.reviewHint") : t("join.bgmHint")}
			</p>
		</div>
	);

	return (
		<ThemeScope themeId={themeId}>
			<ThemeSlot
				name="join.layout"
				ctx={{
					nodes: {
						header,
						notice,
						seats: loadError || isEnded ? null : seatNodes,
						spectator,
						action,
					},
					view: {
						sessionId,
						status,
						moduleName,
						sessionName,
						loading,
						joining,
						selectedName: selectedSeat?.name ?? null,
						ended: isEnded,
						loadError,
					},
					actions: { join: () => void handleJoin() },
				}}
			/>
		</ThemeScope>
	);
}
