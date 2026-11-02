import { LayoutPanelLeft } from "lucide-react";
import { type PortraitLayout, type PortraitScale } from "@cogm/shared";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SegmentedControl } from "@/components/shared/segmented-control";
import { sendSessionCommand } from "@/lib/session-socket";
import { usePlayStore } from "@/stores/play-store";
import { t } from "@/i18n";

const LAYOUT_OPTIONS: ReadonlyArray<{ value: PortraitLayout; labelKey: string }> = [
  { value: "auto", labelKey: "gm.workbench.layoutAuto" },
  { value: "center", labelKey: "gm.workbench.layoutCenter" },
  { value: "left", labelKey: "gm.workbench.layoutLeft" },
  { value: "right", labelKey: "gm.workbench.layoutRight" },
  { value: "spread", labelKey: "gm.workbench.layoutSpread" },
];

const SCALE_OPTIONS: ReadonlyArray<{ value: PortraitScale; labelKey: string }> = [
  { value: "md", labelKey: "gm.workbench.layoutScaleMd" },
  { value: "lg", labelKey: "gm.workbench.layoutScaleLg" },
];

function StageLayoutControl() {
  const layout = usePlayStore((state) => state.portraitLayout);
  const scale = usePlayStore((state) => state.portraitScale);
  const ended = usePlayStore((state) => state.status === "ended");

  function update(nextLayout: PortraitLayout, nextScale: PortraitScale) {
    if (nextLayout === layout && nextScale === scale) {
      return;
    }
    sendSessionCommand("stage:layout", { layout: nextLayout, scale: nextScale });
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="tertiary"
          size="sm"
          disabled={ended}
          aria-label={t("gm.workbench.stageLayout")}
          title={t("gm.workbench.stageLayout")}
          className="bg-md-surface-container-low text-md-on-surface-variant border-md-outline-variant/50 h-10 gap-2 rounded-full border px-4"
        >
          <LayoutPanelLeft className="size-5" />
          {t("gm.workbench.stageLayoutShort")}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="bg-md-surface-container-high w-80 p-4">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <span className="text-md-on-surface text-label-medium-emph">{t("gm.workbench.layoutPosition")}</span>
            <SegmentedControl
              value={layout}
              options={LAYOUT_OPTIONS.map((option) => ({
                value: option.value,
                label: t(option.labelKey),
              }))}
              itemClassName="px-2 text-label-small"
              onValueChange={(value) => update(value, scale)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-md-on-surface text-label-medium-emph">{t("gm.workbench.layoutScale")}</span>
            <SegmentedControl
              value={scale}
              options={SCALE_OPTIONS.map((option) => ({
                value: option.value,
                label: t(option.labelKey),
              }))}
              onValueChange={(value) => update(layout, value)}
            />
          </div>
          <p className="text-md-on-surface-variant text-label-small">{t("gm.workbench.layoutHint")}</p>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export { StageLayoutControl };
