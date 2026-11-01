import type { GmAdminShellCtx } from "@cogm/theme-sdk";

export function GmAdminShell({ nodes }: GmAdminShellCtx) {
  return (
    <div className="bg-background flex h-screen">
      {nodes.nav}
      {nodes.content}
    </div>
  );
}