import { createFileRoute } from "@tanstack/react-router";
import type { BlacklistEntryDto } from "@cogm/shared";
import { Copy, ScanLine, Search, ShieldBan, ShieldOff, ShieldX, Timer, UserX } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { MetricCard } from "@/components/shared/metric-card";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AdminLayout } from "@/features/gm-admin/admin-layout";
import { BanPlayerDialog } from "@/features/gm-admin/dialogs/ban-player-dialog";
import { api, isApiError, unwrapItems } from "@/lib/api";
import { requireGmAuth } from "@/lib/identity";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/gm/blacklist")({
  beforeLoad: requireGmAuth,
  component: BlacklistPage,
});

type DurationTone = "warning" | "danger" | "default";

type BlacklistEntry = {
  fingerprintHash: string;
  playerId: string | null;
  displayName: string | null;
  fingerprint: string;
  note: string;
  duration: string;
  durationTone: DurationTone;
  remaining: string;
  remainingMuted?: boolean;
  bannedAt: string;
  active: boolean;
};

function formatStamp(epochMs: number): string {
  const date = new Date(epochMs);
  return `${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function shortHash(hash: string): string {
  return hash.length <= 16 ? hash : `${hash.slice(0, 8)}…${hash.slice(-4)}`;
}

function mapEntry(row: BlacklistEntryDto, now: number): BlacklistEntry {
  const active = row.expiresAt === null || row.expiresAt > now;
  let duration = "永久";
  let durationTone: DurationTone = "danger";
  let remaining = "—";
  if (row.expiresAt !== null) {
    durationTone = "warning";
    const ms = row.expiresAt - row.createdAt;
    const hours = Math.round(ms / 3600_000);
    duration = hours >= 24 ? `${Math.round(hours / 24)} 天` : `${Math.max(1, hours)} 小时`;
    if (!active) {
      remaining = "已解封";
    } else {
      const left = row.expiresAt - now;
      const leftHours = Math.max(1, Math.round(left / 3600_000));
      remaining = leftHours >= 24 ? `剩 ${Math.round(leftHours / 24)} 天` : `剩 ${leftHours} 小时`;
    }
  }
  return {
    fingerprintHash: row.fingerprintHash,
    playerId: row.playerId,
    displayName: row.displayName,
    fingerprint: shortHash(row.fingerprintHash),
    note: row.reason || "—",
    duration,
    durationTone: active ? durationTone : "default",
    remaining: active ? remaining : "已解封",
    remainingMuted: !active,
    bannedAt: formatStamp(row.createdAt),
    active,
  };
}

async function copyText(value: string, label: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(value);
    toast.success(`已复制${label}`);
  } catch {
    toast.error("复制失败");
  }
}

function BlacklistPage() {
  const [banContext, setBanContext] = useState<{ playerId: string; fingerprintHash: string } | null>(null);
  const [unbanTarget, setUnbanTarget] = useState<BlacklistEntry | null>(null);
  const [rows, setRows] = useState<BlacklistEntryDto[]>([]);
  const [query, setQuery] = useState("");

  async function reload() {
    try {
      const data = await api<unknown>("/gm/blacklist");
      setRows(unwrapItems<BlacklistEntryDto>(data));
    } catch (error) {
      toast.error(isApiError(error) ? error.message : "无法加载黑名单");
    }
  }

  useEffect(() => {
    void reload();
  }, []);

  const entries = useMemo(() => {
    const now = Date.now();
    const mapped = rows.map((row) => mapEntry(row, now));
    const q = query.trim();
    if (!q) {
      return mapped;
    }
    return mapped.filter(
      (entry) =>
        entry.fingerprint.includes(q) ||
        entry.note.includes(q) ||
        entry.fingerprintHash.includes(q) ||
        entry.playerId?.includes(q) ||
        entry.displayName?.includes(q),
    );
  }, [rows, query]);

  const activeCount = entries.filter((entry) => entry.active).length;
  const permanentCount = entries.filter((entry) => entry.active && entry.duration === "永久").length;

  return (
    <AdminLayout active="blacklist">
      <div className="flex h-full flex-col gap-5">
        <PageHeader
          title="黑名单"
          description="基于浏览器指纹的尽力封禁 · HTTP 与 WS 握手时校验 · 指纹不保证绝对可靠"
          actions={
            <>
              <InputGroup className="h-9 w-[220px] rounded-md border-separator-secondary">
                <InputGroupAddon>
                  <Search />
                </InputGroupAddon>
                <InputGroupInput
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="搜索指纹 / 备注…"
                  aria-label="搜索黑名单"
                  className="text-label-large"
                />
              </InputGroup>
              <Button variant="dangerSoft" className="h-12 px-6" onClick={() => setBanContext({ playerId: "", fingerprintHash: "" })}>
                <UserX />
                手动拉黑
              </Button>
            </>
          }
        />

        <div className="animate-in fade-in slide-in-from-bottom-4 flex gap-3.5 duration-500 ease-standard-default-spatial">
          <MetricCard icon={ShieldBan} value={String(activeCount)} label="生效中封禁" tone="error" />
          <MetricCard icon={ShieldX} value={String(permanentCount)} label="永久封禁" tone="tertiary" />
          <MetricCard icon={Timer} value={String(rows.length)} label="全部记录" tone="secondary" />
        </div>

        <div className="animate-in fade-in slide-in-from-bottom-4 overflow-hidden rounded-2xl bg-md-surface-container delay-75 duration-500 ease-standard-default-spatial">
        <Table className="table-fixed">
          <TableHeader>
            <TableRow>
              <TableHead className="w-52">玩家</TableHead>
              <TableHead className="w-58">指纹</TableHead>
              <TableHead>封禁备注</TableHead>
              <TableHead className="w-30">封禁时长</TableHead>
              <TableHead className="w-32">剩余</TableHead>
              <TableHead className="w-30">封禁时间</TableHead>
              <TableHead className="w-28">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map((entry) => (
              <TableRow key={entry.fingerprintHash}>
                <TableCell>
                  <div className="flex min-w-0 flex-col">
                    <span className="text-foreground truncate text-label-large">{entry.displayName ?? "未知玩家"}</span>
                    <span className="text-foreground-tertiary flex items-center gap-1 font-mono text-body-small">
                      <span className="truncate">{entry.playerId ? `${entry.playerId.slice(0, 8)}…` : "无 playerId"}</span>
                      {entry.playerId ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          className="size-6 shrink-0 text-foreground-tertiary"
                          aria-label="复制玩家 ID"
                          onClick={() => void copyText(entry.playerId!, "玩家 ID")}
                        >
                          <Copy className="size-3" />
                        </Button>
                      ) : null}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span className="bg-default flex size-[26px] items-center justify-center rounded-sm">
                      <ScanLine className="text-foreground-secondary size-3.5" />
                    </span>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="text-foreground min-w-0 flex-1 truncate font-mono text-body-small">{entry.fingerprintHash}</span>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-[320px] break-all font-mono">{entry.fingerprintHash}</TooltipContent>
                    </Tooltip>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="size-6 shrink-0 text-foreground-tertiary"
                      aria-label="复制指纹哈希"
                      onClick={() => void copyText(entry.fingerprintHash, "指纹哈希")}
                    >
                      <Copy className="size-3" />
                    </Button>
                  </div>
                </TableCell>
                <TableCell className="text-foreground-secondary truncate text-body-medium">{entry.note}</TableCell>
                <TableCell>
                  <Badge variant="soft" tone={entry.durationTone} size="sm" className="font-sans">
                    {entry.duration}
                  </Badge>
                </TableCell>
                <TableCell className={cn("text-body-small", entry.remainingMuted ? "text-foreground-tertiary" : "text-foreground")}>
                  {entry.remaining}
                </TableCell>
                <TableCell className="text-foreground-tertiary font-mono text-body-small">{entry.bannedAt}</TableCell>
                <TableCell>
                  {entry.active ? (
                  <Button
                    variant="tertiary"
                    size="sm"
                    className="h-7 px-3"
                    onClick={() => setUnbanTarget(entry)}
                  >
                    解封
                  </Button>
                ) : (
                  <Button
                    variant="tertiary"
                    size="sm"
                    className="h-7 px-3"
                    onClick={() =>
                      setBanContext({
                        playerId: entry.playerId ?? "",
                        fingerprintHash: entry.playerId ? "" : entry.fingerprintHash,
                      })
                    }
                  >
                    再次封禁
                  </Button>
                )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        </div>
      </div>

      <BanPlayerDialog
        open={banContext !== null}
        onOpenChange={(open) => {
          if (!open) {
            setBanContext(null);
          }
        }}
        playerName={banContext?.fingerprintHash ? "已解封记录" : undefined}
        defaultPlayerId={banContext?.playerId ?? ""}
        defaultFingerprintHash={banContext?.fingerprintHash ?? ""}
        onBan={async (input) => {
          try {
            await api("/gm/blacklist", {
              method: "POST",
              body: JSON.stringify({
                ...(input.playerId ? { playerId: input.playerId } : {}),
                ...(input.fingerprintHash ? { fingerprintHash: input.fingerprintHash } : {}),
                reason: input.reason,
                ...(input.durationSeconds ? { durationSeconds: input.durationSeconds } : {}),
              }),
            });
            await reload();
          } catch (error) {
            toast.error(isApiError(error) ? error.message : "拉黑失败");
            throw error;
          }
        }}
      />
      <ConfirmDialog
        open={unbanTarget !== null}
        onOpenChange={(open) => !open && setUnbanTarget(null)}
        icon={ShieldOff}
        title="解除封禁"
        description={`确认将指纹 ${unbanTarget?.fingerprint ?? ""} 从黑名单移除？该指纹将可重新加入团。`}
        confirmLabel="解封"
        confirmIcon={ShieldOff}
        variant="warning"
        onConfirm={() => {
          const target = unbanTarget;
          setUnbanTarget(null);
          if (!target) {
            return;
          }
          void api("/gm/blacklist/unban", {
            method: "POST",
            body: JSON.stringify({ fingerprintHash: target.fingerprintHash }),
          })
            .then(() => reload())
            .catch((error) => toast.error(isApiError(error) ? error.message : "解封失败"));
        }}
      />
    </AdminLayout>
  );
}
