import type { GmConsoleLayoutCtx } from "@cogm/theme-sdk";

export function GmConsoleLayout({ nodes }: GmConsoleLayoutCtx) {
  return (
    <div className="bg-background relative flex h-full w-full overflow-hidden">
      {nodes.connection}
      {nodes.endedBanner}
      <div className="w-[360px] shrink-0">{nodes.controls}</div>
      <div className="min-w-0 flex-1">{nodes.stage}</div>
      <div className="w-[392px] shrink-0">{nodes.chat}</div>
      {nodes.overlays}
    </div>
  );
}