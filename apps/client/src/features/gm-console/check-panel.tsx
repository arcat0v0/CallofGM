import { getRuleComponent } from "@/rules/registry";
import { usePlayStore } from "@/stores/play-store";

export function CheckPanel({ onClose }: { onClose: () => void }) {
	const characters = usePlayStore((state) => state.characters);
	const ruleId = usePlayStore((state) => state.ruleId);
	const ruleState = usePlayStore((state) => state.ruleState);
	const Panel = getRuleComponent(ruleId ?? characters[0]?.ruleId).checkPanel;
	return (
		<Panel characters={characters} ruleState={ruleState} onClose={onClose} />
	);
}
