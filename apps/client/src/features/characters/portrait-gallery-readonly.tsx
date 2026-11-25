import type { CharacterPortraitDto } from "@cogm/shared";
import { ImageOff, Star } from "lucide-react";
import { SheetSection } from "@/components/shared/creation-form";
import { Badge } from "@/components/ui/badge";
import { t } from "@/i18n";
import { mediaUrl } from "@/lib/api";
import { expressionLabel } from "@/lib/format";

export function PortraitGalleryReadOnly({
	portraits,
}: {
	portraits: CharacterPortraitDto[];
}) {
	const ordered = [...portraits].sort(
		(a, b) =>
			b.isDefault - a.isDefault ||
			a.sortOrder - b.sortOrder ||
			a.createdAt - b.createdAt,
	);
	return (
		<SheetSection
			title={t("characterProfile.portraitsReadOnlyTitle")}
			description={t("characterProfile.portraitsReadOnlyHint")}
		>
			{ordered.length === 0 ? (
				<div className="text-foreground-tertiary flex items-center gap-2.5 rounded-2xl bg-md-surface-container px-4 py-6 text-body-medium">
					<ImageOff className="size-4 shrink-0" />
					<span>{t("characterProfile.portraitsReadOnlyEmpty")}</span>
				</div>
			) : (
				<div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
					{ordered.map((portrait) => {
						const src = mediaUrl(portrait.portraitAssetId);
						const label = expressionLabel(
							portrait.expressionKey,
							portrait.label ?? null,
						);
						return (
							<figure
								key={portrait.id}
								className="flex flex-col overflow-hidden rounded-2xl bg-md-surface-container"
							>
								<div className="bg-md-surface-container-high aspect-[3/4] w-full overflow-hidden">
									{src ? (
										<img
											src={src}
											alt={label}
											className="size-full object-contain object-bottom"
										/>
									) : null}
								</div>
								<figcaption className="flex items-center justify-between gap-2 px-3 py-2">
									<span className="text-foreground truncate text-label-large">
										{label}
									</span>
									{portrait.isDefault === 1 ? (
										<Badge variant="soft" tone="accent" size="sm">
											<Star className="size-3" />
											{t("expressions.defaultBadge")}
										</Badge>
									) : null}
								</figcaption>
							</figure>
						);
					})}
				</div>
			)}
		</SheetSection>
	);
}
