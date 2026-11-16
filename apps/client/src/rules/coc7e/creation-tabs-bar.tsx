import { useEffect, useRef } from "react";
import { t } from "@/i18n";
import { cn } from "@/lib/utils";
import {
	COC7E_TAB_ORDER,
	type Coc7eTabId,
	type Coc7eValidationState,
} from "./creation-validation";

export function Coc7eCreationTabsBar({
	activeTab,
	onSelectTab,
	validation,
}: {
	activeTab: Coc7eTabId;
	onSelectTab: (tab: Coc7eTabId) => void;
	validation: Coc7eValidationState;
}) {
	const buttonRefs = useRef<
		Partial<Record<Coc7eTabId, HTMLButtonElement | null>>
	>({});

	useEffect(() => {
		const target = buttonRefs.current[activeTab];
		if (target && typeof target.scrollIntoView === "function") {
			target.scrollIntoView({
				behavior: "smooth",
				inline: "center",
				block: "nearest",
			});
		}
	}, [activeTab]);

	return (
		<div
			role="tablist"
			aria-label={t("characterCreation.tabsNav")}
			className="border-md-outline-variant/40 bg-md-surface-container-low flex w-full gap-1.5 overflow-x-auto rounded-2xl border p-1.5 lg:grid lg:grid-cols-7 lg:overflow-visible"
		>
			{COC7E_TAB_ORDER.map((tab) => {
				const active = activeTab === tab.id;
				const count = validation.tabCounts[tab.id];
				const hasBlocker = validation.tabHasBlocker[tab.id];
				const label = t(tab.labelKey);
				return (
					<button
						key={tab.id}
						ref={(element) => {
							buttonRefs.current[tab.id] = element;
						}}
						type="button"
						role="tab"
						aria-selected={active}
						aria-label={
							count === 0
								? t("characterCreation.tabOkLabel", { tab: label })
								: t("characterCreation.tabIssuesLabel", { tab: label, count })
						}
						onClick={() => onSelectTab(tab.id)}
						className={cn(
							"flex min-h-[44px] min-w-[96px] shrink-0 items-center justify-between gap-2 rounded-xl px-3 py-2 text-left transition-colors duration-200 ease-standard lg:min-w-0",
							active
								? "bg-md-primary-container text-md-on-primary-container"
								: "text-foreground-secondary hover:bg-md-surface-container hover:text-foreground",
						)}
					>
						<span className="truncate font-sans text-label-large-emph">
							{label}
						</span>
						{count === 0 ? (
							<span
								aria-hidden="true"
								className="bg-md-surface-container-highest text-success inline-flex shrink-0 items-center rounded-full px-1.5 py-0.5 font-mono text-label-small"
							>
								✓
							</span>
						) : (
							<span
								aria-hidden="true"
								className={cn(
									"inline-flex shrink-0 items-center rounded-full px-1.5 py-0.5 font-mono text-label-small",
									hasBlocker
										? "bg-danger-soft text-danger-soft-foreground"
										: "bg-warning-soft text-warning-soft-foreground",
								)}
							>
								⚠{count}
							</span>
						)}
					</button>
				);
			})}
		</div>
	);
}
