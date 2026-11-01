import type { JoinHeaderCtx } from "@cogm/theme-sdk";
import { Badge } from "@/components/ui/badge";
import { sessionStatusLabel } from "@/i18n/labels";
import { t } from "@/i18n";

export function JoinHeader({ status, moduleName, loading }: JoinHeaderCtx) {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 ease-expressive-default-spatial flex flex-col items-center gap-2.5">
      <Badge variant="soft" tone="default" size="sm">
        {status ? sessionStatusLabel(status) : loading ? t("common.loading") : t("status.waiting")}
      </Badge>
      <h1 className="font-serif text-headline-medium-emph text-foreground">{moduleName ?? t("join.title")}</h1>
      <p className="text-body-large text-md-on-surface-variant">{t("join.subtitle")}</p>
    </div>
  );
}