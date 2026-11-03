import type { JoinHeaderCtx } from "@cogm/theme-sdk";
import { Badge } from "@/components/ui/badge";
import { t } from "@/i18n";
import { sessionStatusLabel } from "@/i18n/labels";

export function JoinHeader({
	status,
	moduleName,
	sessionName,
	loading,
	ended,
	loadError,
}: JoinHeaderCtx) {
	const badge = status
		? sessionStatusLabel(status)
		: loadError
			? t("join.invalidLink")
			: loading
				? t("common.loading")
				: t("status.waiting");
	const title = loadError
		? t("join.cannotEnter")
		: ended
			? (sessionName ?? moduleName ?? t("play.ended"))
			: (sessionName ?? moduleName ?? t("join.title"));
	const subtitle = loadError
		? t("join.invalidLinkDescription")
		: ended
			? t("join.endedDescription")
			: t("join.subtitle");
	return (
		<div className="animate-in fade-in slide-in-from-bottom-4 duration-500 ease-expressive-default-spatial flex flex-col items-center gap-2.5">
			<Badge variant="soft" tone="default" size="sm">
				{badge}
			</Badge>
			<h1 className="font-serif text-headline-medium-emph text-foreground text-center">
				{title}
			</h1>
			<p className="text-body-large text-md-on-surface-variant text-center">
				{subtitle}
			</p>
		</div>
	);
}
