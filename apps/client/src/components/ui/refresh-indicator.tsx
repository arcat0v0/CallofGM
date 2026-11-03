import { RefreshCwIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/loading-indicator";

function RefreshIndicator({
	refreshing,
	onRefresh,
	children,
}: {
	refreshing: boolean;
	onRefresh: () => void;
	children?: ReactNode;
}) {
	return (
		<div
			data-slot="refresh-indicator"
			className="flex flex-col items-center gap-3"
		>
			<Button
				variant="tonal"
				size="icon-lg"
				disabled={refreshing}
				onClick={onRefresh}
				aria-label={refreshing ? "正在刷新" : "刷新"}
			>
				{refreshing ? <Spinner /> : <RefreshCwIcon />}
			</Button>
			<div aria-busy={refreshing} className="w-full">
				{children}
			</div>
		</div>
	);
}

export { RefreshIndicator };
