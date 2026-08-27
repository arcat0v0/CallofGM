import { usePlayStore } from "@/stores/play-store";

function ConnectionBanner() {
  const connected = usePlayStore((state) => state.connected);
  const sessionId = usePlayStore((state) => state.sessionId);
  if (connected) {
    return null;
  }
  return (
    <div className="bg-warning/20 text-warning absolute inset-x-0 top-0 z-30 px-3 py-1.5 text-center text-[11px] font-medium">
      {sessionId ? "连接中断，正在重连…" : "正在连接团…"}
    </div>
  );
}

export { ConnectionBanner };
