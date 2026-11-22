import { Search } from "lucide-react";
import { useState } from "react";
import {
	InputGroup,
	InputGroupAddon,
	InputGroupInput,
} from "@/components/ui/input-group";
import { FolderGroup, FolderItem } from "@/features/gm-admin/library-navigation";
import { t } from "@/i18n";
import { getRuleComponent } from "@/rules/registry";
import type { EnrichedModule, ModulesStatusFilter } from "./module-model";

export type ModuleFolderState = {
	rule?: string;
	status?: ModulesStatusFilter;
};

const RULE_SEARCH_THRESHOLD = 6;

export function ModuleFolders({
	items,
	ruleIds,
	state,
	onChange,
}: {
	items: EnrichedModule[];
	ruleIds: string[];
	state: ModuleFolderState;
	onChange: (next: ModuleFolderState) => void;
}) {
	const [ruleQuery, setRuleQuery] = useState("");
	const none = !state.rule && !state.status;

	// 分面计数：按另一维度的当前筛选条件计算
	const byStatus = items.filter((entry) => {
		if (state.status === "ready") return entry.assetTotal > 0;
		if (state.status === "empty") return entry.assetTotal === 0;
		return true;
	});
	const byRule = items.filter(
		(entry) => !state.rule || entry.module.ruleId === state.rule,
	);

	const ruleCountMap = new Map<string, number>();
	for (const entry of byStatus) {
		ruleCountMap.set(
			entry.module.ruleId,
			(ruleCountMap.get(entry.module.ruleId) ?? 0) + 1,
		);
	}

	const allRuleIds = Array.from(
		new Set([...ruleIds, ...items.map((item) => item.module.ruleId)]),
	);
	const needle = ruleQuery.trim().toLowerCase();
	const ruleRows = allRuleIds
		.map((id) => {
			const component = getRuleComponent(id);
			return {
				id,
				shortName: component.shortName,
				fullName: component.metadata.name,
				count: ruleCountMap.get(id) ?? 0,
			};
		})
		.filter(
			(row) =>
				!needle ||
				row.shortName.toLowerCase().includes(needle) ||
				row.fullName.toLowerCase().includes(needle) ||
				row.id.toLowerCase().includes(needle),
		)
		.sort((a, b) => b.count - a.count || a.shortName.localeCompare(b.shortName));

	const readyCount = byRule.filter((entry) => entry.assetTotal > 0).length;
	const emptyCount = byRule.filter((entry) => entry.assetTotal === 0).length;

	const toggleRule = (id: string) =>
		onChange({ ...state, rule: state.rule === id ? undefined : id });
	const toggleStatus = (status: ModulesStatusFilter) =>
		onChange({ ...state, status: state.status === status ? undefined : status });

	return (
		<nav aria-label={t("gm.modules.filtersAria")} className="flex flex-col">
			<FolderGroup>
				<FolderItem
					label={t("gm.modules.allModules")}
					count={items.length}
					active={none}
					onClick={() => onChange({})}
				/>
			</FolderGroup>

			<FolderGroup label={t("gm.modules.groupRule")}>
				{allRuleIds.length > RULE_SEARCH_THRESHOLD ? (
					<div className="px-3 pb-2">
						<InputGroup className="h-8 rounded-full">
							<InputGroupAddon>
								<Search aria-hidden />
							</InputGroupAddon>
							<InputGroupInput
								value={ruleQuery}
								onChange={(event) => setRuleQuery(event.target.value)}
								placeholder={t("gm.library.ruleSearchPlaceholder")}
								aria-label={t("gm.library.ruleSearchPlaceholder")}
							/>
						</InputGroup>
					</div>
				) : null}
				{ruleRows.map((rule) => (
					<FolderItem
						key={rule.id}
						label={rule.shortName}
						count={rule.count}
						active={state.rule === rule.id}
						onClick={() => toggleRule(rule.id)}
					/>
				))}
			</FolderGroup>

			<FolderGroup label={t("gm.modules.groupPrep")}>
				<FolderItem
					label={t("gm.modules.statusReady")}
					count={readyCount}
					active={state.status === "ready"}
					onClick={() => toggleStatus("ready")}
				/>
				<FolderItem
					label={t("gm.modules.statusEmpty")}
					count={emptyCount}
					active={state.status === "empty"}
					onClick={() => toggleStatus("empty")}
				/>
			</FolderGroup>
		</nav>
	);
}
