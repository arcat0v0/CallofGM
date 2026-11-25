import { coc7e } from "@cogm/shared";
import { Star, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { t } from "@/i18n";
import { cn } from "@/lib/utils";
import { parseCocSheet } from "./sheet-data";

export function Coc7eBackgroundSummaryView({
	sheet: rawSheet,
	includeIdentity = true,
	showEmptyFields = false,
}: {
	sheet: unknown;
	includeIdentity?: boolean;
	showEmptyFields?: boolean;
}) {
	const sheet = parseCocSheet(rawSheet);
	if (!sheet) {
		return null;
	}

	const bg = sheet.backgroundProfile;
	const identityItems = includeIdentity
		? [
				sheet.profile.gender ? `性别：${sheet.profile.gender}` : "",
				sheet.age !== null ? `年龄：${sheet.age} 岁` : "",
				sheet.profile.residence ? `住地：${sheet.profile.residence}` : "",
				sheet.profile.birthplace ? `故乡：${sheet.profile.birthplace}` : "",
				sheet.occupation.name ? `职业：${sheet.occupation.name}` : "",
			].filter(Boolean)
		: [];

	const fields = coc7e.COC7E_BACKGROUND_FIELD_META.map((field) => {
		const raw =
			field.key === "appearanceSummary"
				? bg.appearanceSummary || sheet.profile.appearance
				: bg[field.key];
		return {
			key: field.key,
			label: t(`characterCreation.bgField.${field.key}`),
			value: raw.trim(),
			isKey: bg.keyConnection === field.key,
		};
	});
	const visibleFields = showEmptyFields
		? fields
		: fields.filter((entry) => entry.value.length > 0 || entry.isKey);

	const partners =
		bg.partners.length > 0
			? bg.partners
			: bg.partnerName.trim()
				? [
						{
							id: "legacy",
							characterId: bg.partnerCharacterId,
							name: bg.partnerName,
							note: "",
						},
					]
				: [];

	const hasAnyContent =
		identityItems.length > 0 ||
		visibleFields.length > 0 ||
		bg.keyConnectionStory.trim().length > 0 ||
		partners.length > 0;

	if (!hasAnyContent) {
		return (
			<p className="text-foreground-tertiary rounded-2xl bg-md-surface-container px-4 py-3 text-body-medium">
				{t("characterProfile.backgroundStructuredEmpty")}
			</p>
		);
	}

	return (
		<div className="flex flex-col gap-3">
			{identityItems.length > 0 ? (
				<div className="flex flex-wrap gap-1.5">
					{identityItems.map((item) => (
						<Badge key={item} variant="soft" tone="default" size="sm">
							{item}
						</Badge>
					))}
				</div>
			) : null}

			{visibleFields.length > 0 ? (
				<div className="grid gap-3 md:grid-cols-2">
					{visibleFields.map((entry) => (
						<div
							key={entry.key}
							className={cn(
								"flex flex-col gap-1.5 rounded-2xl p-4",
								entry.isKey
									? "border-dossier-gold bg-md-surface-container-high border"
									: "bg-md-surface-container",
							)}
						>
							<div className="flex items-center justify-between gap-2">
								<span className="text-foreground text-title-small-emph">
									{entry.label}
								</span>
								{entry.isKey ? (
									<Badge variant="soft" tone="accent" size="sm">
										<Star className="size-3" />
										{t("characterCreation.isKeyConnection")}
									</Badge>
								) : null}
							</div>
							<p
								className={cn(
									"whitespace-pre-wrap text-body-medium select-text",
									entry.value
										? "text-foreground-secondary"
										: "text-foreground-tertiary",
								)}
							>
								{entry.value || "未填写"}
							</p>
						</div>
					))}
				</div>
			) : null}

			{bg.keyConnectionStory.trim() ? (
				<div className="rounded-2xl bg-md-surface-container-high/70 p-4">
					<span className="text-foreground text-title-small-emph">
						{t("characterCreation.keyConnectionStory")}
					</span>
					<p className="text-foreground-secondary mt-1.5 whitespace-pre-wrap text-body-medium select-text">
						{bg.keyConnectionStory}
					</p>
				</div>
			) : null}

			{partners.length > 0 ? (
				<div className="flex flex-col gap-2.5 rounded-2xl bg-md-surface-container p-4">
					<div className="flex items-center gap-2">
						<Users className="text-foreground-secondary size-4" />
						<h4 className="text-foreground text-title-small-emph">
							调查员同伴（{partners.length}）
						</h4>
					</div>
					<div className="grid gap-2 sm:grid-cols-2">
						{partners.map((partner) => (
							<div
								key={partner.id}
								className="rounded-xl bg-md-surface-container-high/60 px-3.5 py-2.5"
							>
								<p className="text-foreground text-body-medium-emph select-text">
									{partner.name || "未命名同伴"}
								</p>
								{partner.note ? (
									<p className="text-foreground-secondary mt-0.5 whitespace-pre-wrap text-body-small select-text">
										{partner.note}
									</p>
								) : null}
							</div>
						))}
					</div>
				</div>
			) : null}
		</div>
	);
}
