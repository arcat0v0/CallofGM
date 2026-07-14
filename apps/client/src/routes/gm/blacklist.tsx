import { createFileRoute } from "@tanstack/react-router";
import { ScanLine, Search, ShieldBan, ShieldOff, ShieldX, Timer, UserX } from "lucide-react";
import { useState } from "react";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AdminLayout } from "@/features/gm-admin/admin-layout";
import { BanPlayerDialog } from "@/features/gm-admin/dialogs/ban-player-dialog";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/gm/blacklist")({
  component: BlacklistPage,
});

type DurationTone = "warning" | "danger" | "default";

type BlacklistEntry = {
  fingerprint: string;
  note: string;
  duration: string;
  durationTone: DurationTone;
  remaining: string;
  remainingMuted?: boolean;
  bannedAt: string;
  active: boolean;
};

const entries: BlacklistEntry[] = [
  {
    fingerprint: "8c1d·4f2a·9e01",
    note: "阿飞 · 恶意刷屏",
    duration: "7 天",
    durationTone: "warning",
    remaining: "剩 5 天 12 时",
    bannedAt: "07-11",
    active: true,
  },
  {
    fingerprint: "2b7e·88c0·1af3",
    note: "捣乱访客",
    duration: "24 小时",
    durationTone: "warning",
    remaining: "剩 3 小时",
    bannedAt: "07-13",
    active: true,
  },
  {
    fingerprint: "f09a·3d21·7cc8",
    note: "开盒威胁 · 永久",
    duration: "永久",
    durationTone: "danger",
    remaining: "—",
    bannedAt: "07-02",
    active: true,
  },
  {
    fingerprint: "55ab·9012·ee34",
    note: "已到期 · 自动解封",
    duration: "3 天",
    durationTone: "default",
    remaining: "已解封",
    remainingMuted: true,
    bannedAt: "07-08",
    active: false,
  },
];

const stats = [
  { icon: ShieldBan, iconClass: "text-danger-soft-foreground", value: "3", label: "生效中封禁" },
  { icon: ShieldX, iconClass: "text-danger-soft-foreground", value: "1", label: "永久封禁" },
  { icon: Timer, iconClass: "text-warning", value: "2", label: "近 7 天新增" },
];

function BlacklistPage() {
  const [banDialog, setBanDialog] = useState<{ open: boolean; fingerprint?: string }>({ open: false });
  const [unbanTarget, setUnbanTarget] = useState<BlacklistEntry | null>(null);

  return (
    <AdminLayout active="blacklist">
      <div className="flex h-full flex-col gap-5">
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-0.5">
            <h1 className="text-foreground font-serif text-[22px] font-bold">黑名单</h1>
            <p className="text-foreground-secondary text-[13px]">
              基于浏览器指纹的尽力封禁 · HTTP 与 WS 握手时校验 · 指纹不保证绝对可靠
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="border-separator-secondary bg-field flex h-9 w-[220px] items-center gap-2 rounded-[10px] border px-3">
              <Search className="text-foreground-tertiary size-3.5 shrink-0" />
              <input
                placeholder="搜索指纹 / 备注…"
                className="placeholder:text-field-placeholder text-field-foreground w-full bg-transparent font-sans text-[13px] outline-none"
              />
            </div>
            <Button variant="dangerSoft" className="font-semibold" onClick={() => setBanDialog({ open: true })}>
              <UserX />
              手动拉黑
            </Button>
          </div>
        </div>

        <div className="flex gap-3.5">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <div
                key={stat.label}
                className="border-separator bg-surface flex flex-1 items-center gap-3 rounded-[14px] border p-4"
              >
                <span className="bg-danger-soft flex size-9 items-center justify-center rounded-[10px]">
                  <Icon className={cn("size-[17px]", stat.iconClass)} />
                </span>
                <div className="flex flex-col gap-0.5">
                  <span className="text-foreground font-chip text-xl font-bold">{stat.value}</span>
                  <span className="text-foreground-secondary text-[11px]">{stat.label}</span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="border-separator bg-surface flex flex-1 flex-col overflow-hidden rounded-[14px] border">
          <div className="bg-surface-secondary text-foreground-secondary flex items-center gap-3 px-4 py-2.5 text-xs font-semibold">
            <span className="w-[210px]">指纹</span>
            <span className="flex-1">备注 / 曾用名</span>
            <span className="w-[120px]">封禁时长</span>
            <span className="w-[130px]">剩余</span>
            <span className="w-[120px]">封禁时间</span>
            <span className="w-[100px]">操作</span>
          </div>

          {entries.map((entry) => (
            <div
              key={entry.fingerprint}
              className="border-separator flex items-center gap-3 border-t px-4 py-3"
            >
              <div className="flex w-[210px] items-center gap-2">
                <span className="bg-default flex size-[26px] items-center justify-center rounded-[7px]">
                  <ScanLine className="text-foreground-secondary size-3.5" />
                </span>
                <span className="text-foreground font-mono text-xs">{entry.fingerprint}</span>
              </div>
              <div className="text-foreground-secondary flex-1 text-[13px]">{entry.note}</div>
              <div className="w-[120px]">
                <Badge variant="soft" tone={entry.durationTone} size="sm" className="font-sans">
                  {entry.duration}
                </Badge>
              </div>
              <div
                className={cn(
                  "w-[130px] text-xs",
                  entry.remainingMuted ? "text-foreground-tertiary" : "text-foreground",
                )}
              >
                {entry.remaining}
              </div>
              <div className="text-foreground-tertiary w-[120px] font-mono text-xs">{entry.bannedAt}</div>
              <div className="w-[100px]">
                {entry.active ? (
                  <Button
                    variant="tertiary"
                    size="sm"
                    className="h-7 rounded-full px-3 text-xs font-semibold"
                    onClick={() => setUnbanTarget(entry)}
                  >
                    解封
                  </Button>
                ) : (
                  <Button
                    variant="tertiary"
                    size="sm"
                    className="h-7 rounded-full px-3 text-xs font-semibold"
                    onClick={() => setBanDialog({ open: true, fingerprint: entry.fingerprint })}
                  >
                    再次封禁
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <BanPlayerDialog
        open={banDialog.open}
        onOpenChange={(open) => setBanDialog((state) => ({ ...state, open }))}
        fingerprint={banDialog.fingerprint ? `指纹 ${banDialog.fingerprint}` : undefined}
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
        onConfirm={() => setUnbanTarget(null)}
      />
    </AdminLayout>
  );
}
