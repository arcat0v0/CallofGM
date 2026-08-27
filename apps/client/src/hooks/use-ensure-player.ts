import { useEffect } from "react";
import { toast } from "sonner";
import { ensurePlayer } from "@/lib/identity";

export function useEnsurePlayer() {
  useEffect(() => {
    void ensurePlayer().catch((error) => {
      toast.error(error instanceof Error ? error.message : "无法建立玩家身份");
    });
  }, []);
}
