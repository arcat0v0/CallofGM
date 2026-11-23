import type { JoinLayoutCtx } from "@cogm/theme-sdk";

export function JoinLayout({ nodes }: JoinLayoutCtx) {
	return (
		<main className="flex min-h-dvh w-full flex-col items-center justify-center gap-6 overflow-y-auto bg-background px-4 py-8 sm:gap-10">
			{nodes.header}
			{nodes.notice}
			{nodes.seats}
			{nodes.spectator}
			{nodes.action}
		</main>
	);
}
