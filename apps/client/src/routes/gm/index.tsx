import { createFileRoute } from "@tanstack/react-router";
import { ArrowRight, Ellipsis, FileSpreadsheet, Package, Play, Plus, Users, VenetianMask } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AdminLayout } from "@/features/gm-admin/admin-layout";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/gm/")({
  component: GmDashboardPage,
});

const GRADIENT = "bg-[linear-gradient(180deg,var(--color-brand-moegi),var(--color-brand-nae))]";

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

const GRID = "grid items-center gap-3";
const GRID_STYLE = { gridTemplateColumns: "1fr 170px 96px 104px 140px 100px 180px" };

function GmDashboardPage() {
  return (
    <AdminLayout active="sessions">
      <div className="flex flex-col gap-5">
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-[3px]">
            <h1 className="text-foreground font-serif text-[22px] font-bold">团管理</h1>
            <p className="text-foreground-secondary text-[13px]">创建团、指定参与 PC，并控制团状态的流转</p>
          </div>
          <div className="flex items-center gap-2.5">
            <Button variant="outline" size="md">
              <FileSpreadsheet />
              导入人物卡 Excel
            </Button>
            <Button variant="primary" size="md" className={GRADIENT}>
              <Plus />
              新建团
            </Button>
          </div>
        </div>

        <div className="flex gap-3.5">
          {STATS.map((stat) => {
            const Icon = stat.icon;
            return (
              <Card
                key={stat.label}
                className="border-separator flex-1 flex-row items-center rounded-[14px] border"
              >
                <div className={cn("flex size-9 items-center justify-center rounded-[10px]", stat.iconBg)}>
                  <Icon className={cn("size-[17px]", stat.iconColor)} />
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-foreground font-chip text-[20px] font-bold">{stat.value}</span>
                  <span className="text-foreground-secondary text-[11px]">{stat.label}</span>
                </div>
              </Card>
            );
          })}
        </div>

        <div className="border-separator bg-surface overflow-hidden rounded-[14px] border">
          <div className={cn(GRID, "bg-surface-secondary px-4 py-2.5")} style={GRID_STYLE}>
            <span className="text-foreground-secondary text-xs font-semibold">团名</span>
            <span className="text-foreground-secondary text-xs font-semibold">模组</span>
            <span className="text-foreground-secondary text-xs font-semibold">状态</span>
            <span className="text-foreground-secondary text-xs font-semibold">团内阶段</span>
            <span className="text-foreground-secondary text-xs font-semibold">PC</span>
            <span className="text-foreground-secondary text-xs font-semibold">更新</span>
            <span className="text-foreground-secondary text-xs font-semibold">操作</span>
          </div>
          {SESSIONS.map((session) => (
            <div key={session.name} className={cn(GRID, "border-separator border-t px-4 py-3")} style={GRID_STYLE}>
              <span className="text-foreground text-[13px] font-semibold">{session.name}</span>
              <span className="text-foreground-secondary text-[13px]">{session.module}</span>
              <div>
                <Badge variant="soft" tone={session.status.tone} size="sm">
                  {session.status.label}
                </Badge>
              </div>
              <div>
                {session.phase ? (
                  <Badge variant="soft" tone="accent" size="sm">
                    {session.phase}
                  </Badge>
                ) : (
                  <span className="text-foreground-tertiary font-chip text-[13px]">—</span>
                )}
              </div>
              <span className="text-foreground-secondary text-xs">{session.pc}</span>
              <span className="text-foreground-tertiary font-chip text-xs">{session.updated}</span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  className={cn(
                    "flex h-7 items-center justify-center rounded-full px-3 text-xs font-semibold",
                    session.actionPrimary
                      ? cn(GRADIENT, "text-accent-foreground")
                      : "bg-default text-foreground",
                  )}
                >
                  {session.action}
                </button>
                <button
                  type="button"
                  className="text-foreground-tertiary hover:bg-surface-hover flex size-7 items-center justify-center rounded-full"
                >
                  <Ellipsis className="size-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between pt-1.5">
          <h2 className="text-foreground font-serif text-[17px] font-bold">模组资源</h2>
          <Button variant="ghost" size="sm" className="text-foreground-secondary">
            全部模组
            <ArrowRight />
          </Button>
        </div>

        <div className="flex gap-4">
          {MODULES.map((module) => (
            <div
              key={module.name}
              className="border-separator bg-surface flex-1 overflow-hidden rounded-[14px] border"
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
                  <button
                    type="button"
                    className="bg-accent-soft text-accent-soft-foreground flex h-[26px] items-center justify-center rounded-full px-3 text-[11px] font-semibold"
                  >
                    管理
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </AdminLayout>
  );
}
