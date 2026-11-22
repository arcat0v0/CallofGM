import type { GmAdminShellCtx } from "@cogm/theme-sdk";

export function GmAdminShell({ nodes }: GmAdminShellCtx) {
	return (
		<div className="bg-background flex h-dvh flex-col overflow-hidden md:flex-row">
			{nodes.nav}
			{nodes.content}
		</div>
	);
}
