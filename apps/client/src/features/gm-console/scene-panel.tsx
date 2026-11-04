import { Link } from "@tanstack/react-router";
import {
	ArrowUpRight,
	Check,
	Image as ImageIcon,
	Search,
	Settings2,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	InputGroup,
	InputGroupAddon,
	InputGroupInput,
} from "@/components/ui/input-group";
import { t } from "@/i18n";
import { mediaUrl } from "@/lib/api";
import { sendSessionCommand } from "@/lib/session-socket";
import { cn } from "@/lib/utils";
import { usePlayStore } from "@/stores/play-store";
import { GmPanelShell } from "./gm-panel-fields";

function ScenePanel({ onClose }: { onClose: () => void }) {
	const [query, setQuery] = useState("");
	const scenes = usePlayStore((state) => state.catalogScenes);
	const current = usePlayStore((state) => state.scene);
	const moduleId = usePlayStore((state) => state.moduleId);
	const filtered = useMemo(
		() =>
			scenes.filter((scene) =>
				scene.name.toLowerCase().includes(query.trim().toLowerCase()),
			),
		[query, scenes],
	);

	return (
		<GmPanelShell
			title={t("gm.workbench.sceneTitle")}
			subtitle={t("gm.workbench.sceneSubtitle")}
			onClose={onClose}
			footer={
				<div className="flex items-center justify-between gap-3">
					<span className="text-md-on-surface-variant text-label-medium">
						{t("gm.workbench.sceneHint")}
					</span>
					{moduleId ? (
						<Button
							asChild
							variant="tertiary"
							size="sm"
							className="bg-md-surface-container-highest h-10"
						>
							<Link to="/gm/module/$moduleId" params={{ moduleId }}>
								<Settings2 className="size-4" />
								{t("gm.workbench.manageScenes")}
							</Link>
						</Button>
					) : null}
				</div>
			}
		>
			<InputGroup className="h-10 rounded-lg">
				<InputGroupAddon className="[&_svg]:size-5">
					<Search />
				</InputGroupAddon>
				<InputGroupInput
					value={query}
					aria-label={t("gm.workbench.sceneSearch")}
					placeholder={t("gm.workbench.sceneSearch")}
					className="text-label-large"
					onChange={(event) => setQuery(event.target.value)}
				/>
			</InputGroup>

			<div className="flex flex-col gap-2">
				{filtered.length === 0 ? (
					<p className="text-md-on-surface-variant text-body-medium">
						{t("gm.workbench.sceneEmpty")}
					</p>
				) : (
					filtered.map((scene) => {
						const active = scene.id === current?.id;
						return (
							<button
								key={scene.id}
								type="button"
								aria-current={active ? "true" : undefined}
								onClick={() => {
									if (!active) {
										sendSessionCommand("scene:switch", { sceneId: scene.id });
									}
								}}
								className={cn(
									"flex min-h-25 w-full items-center gap-4 rounded-lg-inc p-2 text-left outline-none transition-colors duration-200 ease-standard-fast-effects focus-visible:ring-4 focus-visible:ring-focus-ring/50",
									active
										? "bg-md-primary-container border-md-primary/25 text-md-on-primary-container border"
										: "bg-md-surface-container text-md-on-surface hover:bg-md-surface-container-high border border-md-outline-variant/50",
								)}
							>
								<span className="bg-md-surface-container-highest relative block h-21 w-32 shrink-0 overflow-hidden rounded-lg">
									{scene.bgAssetId ? (
										<img
											src={mediaUrl(scene.bgAssetId) ?? undefined}
											alt={scene.name}
											className="size-full object-cover"
										/>
									) : (
										<ImageIcon className="text-md-on-surface-variant absolute top-1/2 left-1/2 size-5 -translate-x-1/2 -translate-y-1/2" />
									)}
								</span>
								<span className="flex min-w-0 flex-1 flex-col gap-1.5">
									<span className="truncate font-sans text-title-medium-emph">
										{scene.name}
									</span>
									<span
										className={cn(
											"text-label-medium",
											active
												? "text-md-on-primary-container"
												: "text-md-on-surface-variant",
										)}
									>
										{active
											? t("gm.workbench.presenting")
											: t("gm.workbench.sceneOrder", {
													order: scene.sortOrder + 1,
												})}
									</span>
								</span>
								<span
									className={cn(
										"grid size-10 shrink-0 place-items-center rounded-full",
										active
											? "bg-accent text-accent-foreground"
											: "bg-md-surface-container-high text-md-on-surface-variant",
									)}
								>
									{active ? (
										<Check className="size-5" />
									) : (
										<ArrowUpRight className="size-5" />
									)}
								</span>
							</button>
						);
					})
				)}
			</div>
		</GmPanelShell>
	);
}

export { ScenePanel };
