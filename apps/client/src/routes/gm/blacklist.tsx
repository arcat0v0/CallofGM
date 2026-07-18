import { createFileRoute } from "@tanstack/react-router";
import { ScanLine, Search, ShieldBan, ShieldOff, ShieldX, Timer, UserX } from "lucide-react";
import { useState } from "react";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { MetricCard } from "@/components/shared/metric-card";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
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
        <PageHeader
          title="黑名单"
          description="基于浏览器指纹的尽力封禁 · HTTP 与 WS 握手时校验 · 指纹不保证绝对可靠"
          actions={
            <>
              <InputGroup className="h-9 w-[220px] rounded-[10px] border-separator-secondary">
                <InputGroupAddon>
                  <Search />
                </InputGroupAddon>
                <InputGroupInput
                placeholder="搜索指纹 / 备注…"
                  aria-label="搜索黑名单"
                  className="text-[13px]"
                />
              </InputGroup>
              <Button variant="dangerSoft" className="font-semibold" onClick={() => setBanDialog({ open: true })}>
                <UserX />
                手动拉黑
              </Button>
            </>
          }
        />

        <div className="flex gap-3.5">
          {stats.map((stat) => {
            return (
              <MetricCard
                key={stat.label}
                icon={stat.icon}
                value={stat.value}
                label={stat.label}
                iconContainerClassName="bg-danger-soft"
                iconClassName={stat.iconClass}
              />
            );
          })}
        </div>

        <Table className="table-fixed">
          <TableHeader>
            <TableRow>
              <TableHead className="w-58">指纹</TableHead>
              <TableHead>备注 / 曾用名</TableHead>
              <TableHead className="w-30">封禁时长</TableHead>
              <TableHead className="w-32">剩余</TableHead>
              <TableHead className="w-30">封禁时间</TableHead>
              <TableHead className="w-28">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map((entry) => (
              <TableRow key={entry.fingerprint}>
                <TableCell>
                  <div className="flex items-center gap-2">
                <span className="bg-default flex size-[26px] items-center justify-center rounded-[7px]">
                  <ScanLine className="text-foreground-secondary size-3.5" />
                </span>
                <span className="text-foreground font-mono text-xs">{entry.fingerprint}</span>
                  </div>
                </TableCell>
                <TableCell className="text-foreground-secondary truncate text-[13px]">{entry.note}</TableCell>
                <TableCell>
                  <Badge variant="soft" tone={entry.durationTone} size="sm" className="font-sans">
                    {entry.duration}
                  </Badge>
                </TableCell>
                <TableCell className={cn("text-xs", entry.remainingMuted ? "text-foreground-tertiary" : "text-foreground")}>
                  {entry.remaining}
                </TableCell>
                <TableCell className="text-foreground-tertiary font-mono text-xs">{entry.bannedAt}</TableCell>
                <TableCell>
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
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
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
