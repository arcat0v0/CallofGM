import { ConsoleStage } from "./console-stage";
import { GmChatPanel } from "./gm-chat-panel";
import { GmPanel } from "./gm-panel";

function GmConsoleView() {
  return (
    <div className="bg-background flex h-dvh w-full overflow-hidden">
      <GmPanel className="w-[360px] shrink-0" />
      <div className="min-w-0 flex-1">
        <ConsoleStage />
      </div>
      <GmChatPanel className="w-[392px] shrink-0" />
    </div>
  );
}

export { GmConsoleView };
