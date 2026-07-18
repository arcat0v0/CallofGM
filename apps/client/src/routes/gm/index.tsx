import { createFileRoute } from "@tanstack/react-router";
import { ArrowRight, Ellipsis, FileSpreadsheet, Package, Play, Plus, Users, VenetianMask } from "lucide-react";
import { useState } from "react";
import { MetricCard } from "@/components/shared/metric-card";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AdminLayout } from "@/features/gm-admin/admin-layout";
import { CreateSessionDialog } from "@/features/gm-admin/dialogs/create-session-dialog";
import { ImportCharacterSheetDialog } from "@/features/gm-admin/dialogs/import-character-sheet-dialog";

export const Route = createFileRoute("/gm/")({
  component: GmDashboardPage,
});

type Tone = "success" | "accent" | "warning" | "default";

const STATS = [
  { value: "1", label: "进行中的团", icon: Play, iconBg: "bg-brand-moegi/15", iconColor: "text-brand-moegi" },
  { value: "4", label: "模组", icon: Package, iconBg: "bg-brand-sora/15", iconColor: "text-brand-sora" },
  { value: "12", label: "人物卡", icon: VenetianMask, iconBg: "bg-brand-fuji/15", iconColor: "text-brand-fuji" },
  { value: "3", label: "当前在线", icon: Users, iconBg: "bg-brand-yamabuki/15", iconColor: "text-brand-yamabuki" },
];

type Session = {
  name: string;
  module: string;
  status: { label: string; tone: Tone };
  phase: string | null;
  pc: string;
  updated: string;
  action: string;
  actionPrimary?: boolean;
};

const SESSIONS: Session[] = [
  {
    name: "沉没的记忆 · 第三夜",
    module: "沉没的记忆",
    status: { label: "进行中", tone: "success" },
    phase: "演绎时间",
    pc: "澪 / 拓真 +1",
    updated: "21:12",
    action: "进入控制台",
    actionPrimary: true,
  },
  {
    name: "无人矿坑 · 单团",
    module: "无人矿坑",
    status: { label: "等待开始", tone: "default" },
    phase: null,
    pc: "3 名 PC",
    updated: "昨天",
    action: "打开",
  },
  {
    name: "星之彩 · 序章",
    module: "星之彩",
    status: { label: "准备中", tone: "warning" },
    phase: null,
    pc: "4 名 PC",
    updated: "07-08",
    action: "打开",
  },
  {
    name: "旧日的回响",
    module: "旧日的回响",
    status: { label: "已结团", tone: "default" },
    phase: null,
    pc: "5 名 PC",
    updated: "06-30",
    action: "回放记录",
  },
];

const MODULES = [
  { name: "沉没的记忆", cover: "/demo/modules/sunk-memory.png", meta: "场景 5 · 人物 8 · 音乐 12", live: true },
  { name: "无人矿坑", cover: "/demo/modules/abandoned-mine.png", meta: "场景 3 · 人物 6 · 音乐 7", live: false },
  { name: "星之彩", cover: "/demo/modules/color-out-of-space.png", meta: "场景 4 · 人物 9 · 音乐 10", live: false },
];

function GmDashboardPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  return (
    <AdminLayout active="sessions">
      <div className="flex flex-col gap-5">
        <PageHeader
          title="团管理"
          description="创建团、指定参与 PC，并控制团状态的流转"
          actions={
            <>
            <Button variant="outline" size="md" onClick={() => setImportOpen(true)}>
              <FileSpreadsheet />
              导入人物卡 Excel
            </Button>
            <Button variant="primaryGradient" size="md" onClick={() => setCreateOpen(true)}>
              <Plus />
              新建团
            </Button>
            </>
          }
        />

        <div className="flex gap-3.5">
          {STATS.map((stat) => {
            return (
              <MetricCard
                key={stat.label}
                icon={stat.icon}
                value={stat.value}
                label={stat.label}
                iconContainerClassName={stat.iconBg}
                iconClassName={stat.iconColor}
              />
            );
          })}
        </div>

        <Table className="table-fixed">
          <TableHeader>
            <TableRow>
              <TableHead>团名</TableHead>
              <TableHead className="w-42">模组</TableHead>
              <TableHead className="w-24">状态</TableHead>
              <TableHead className="w-26">团内阶段</TableHead>
              <TableHead className="w-35">PC</TableHead>
              <TableHead className="w-25">更新</TableHead>
              <TableHead className="w-45">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {SESSIONS.map((session) => (
              <TableRow key={session.name}>
                <TableCell className="truncate text-[13px] font-semibold">{session.name}</TableCell>
                <TableCell className="text-foreground-secondary text-[13px]">{session.module}</TableCell>
                <TableCell>
                  <Badge variant="soft" tone={session.status.tone} size="sm">
                    {session.status.label}
                  </Badge>
                </TableCell>
                <TableCell>
                  {session.phase ? (
                  <Badge variant="soft" tone="accent" size="sm">
                    {session.phase}
                  </Badge>
                ) : (
                  <span className="text-foreground-tertiary font-chip text-[13px]">—</span>
                )}
                </TableCell>
                <TableCell className="text-foreground-secondary text-xs">{session.pc}</TableCell>
                <TableCell className="text-foreground-tertiary font-chip text-xs">{session.updated}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-1.5">
                    <Button
                      type="button"
                      variant={session.actionPrimary ? "primaryGradient" : "tertiary"}
                      size="sm"
                      className="h-7 px-3 text-xs font-semibold"
                    >
                      {session.action}
                    </Button>
                    <Button type="button" variant="ghost" size="icon-sm" aria-label={`${session.name} 更多操作`} className="size-7 text-foreground-tertiary">
                      <Ellipsis />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <div className="flex items-center justify-between pt-1.5">
          <h2 className="text-foreground font-serif text-[17px] font-bold">模组资源</h2>
          <Button variant="ghost" size="sm" className="text-foreground-secondary">
            全部模组
            <ArrowRight />
          </Button>
        </div>

        <div className="flex gap-4">
          {MODULES.map((module) => (
            <Card
              key={module.name}
              className="border-separator flex-1 gap-0 overflow-hidden rounded-[14px] border p-0"
            >
              <img src={module.cover} alt={module.name} className="h-[118px] w-full object-cover" />
              <div className="flex flex-col gap-2 p-3.5">
                <div className="flex items-center justify-between">
                  <span className="text-foreground text-sm font-semibold">{module.name}</span>
                  {module.live && (
                    <Badge variant="soft" tone="success" size="sm">
                      使用中
                    </Badge>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-foreground-tertiary text-[11px]">{module.meta}</span>
                  <Button
                    type="button"
                    variant="accentSoft"
                    size="sm"
                    className="h-[26px] px-3 text-[11px] font-semibold"
                  >
                    管理
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>

      <CreateSessionDialog open={createOpen} onOpenChange={setCreateOpen} />
      <ImportCharacterSheetDialog open={importOpen} onOpenChange={setImportOpen} />
    </AdminLayout>
  );
}
