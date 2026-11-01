import type { JoinLayoutCtx } from "@cogm/theme-sdk";
import { t } from "@/i18n";

export function JoinLayout({ nodes }: JoinLayoutCtx) {
  return (
    <main className="flex min-h-dvh w-full flex-col items-center justify-center gap-10 overflow-hidden bg-background px-4">
      {nodes.header}
      <div className="flex flex-wrap justify-center gap-4" role="radiogroup" aria-label={t("join.chooseGroup")}>
        {nodes.seats}
      </div>
      {nodes.spectator}
      {nodes.action}
    </main>
  );
}