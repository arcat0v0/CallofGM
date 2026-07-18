import { createFileRoute } from "@tanstack/react-router";
import { ChevronRight, ImagePlus, MoreHorizontal, Pencil, Plus } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { AdminLayout } from "@/features/gm-admin/admin-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/gm/module/$moduleId")({
  component: ModuleDetailPage,
});

const scenes = [
  { id: "library-night", name: "图书馆 · 夜", stage: "序幕 · 图书馆调查", thumb: "/demo/scenes/library-night-thumb.png" },
  { id: "foyer", name: "洋馆玄关", stage: "入场首现", thumb: "/demo/scenes/library.png" },
  { id: "boathouse", name: "船屋", stage: "第二幕", thumb: "/demo/scenes/boathouse-thumb.png" },
  { id: "lake-altar", name: "湖底祭坛", stage: "终幕 · 高潮", thumb: "/demo/scenes/lake-altar-thumb.png" },
  { id: "courtyard-rain", name: "雨中庭院", stage: "转场", thumb: "/demo/scenes/boathouse-thumb.png" },
];

function ModuleDetailPage() {
  return (
    <AdminLayout active="modules">
      <div className="flex flex-col gap-5">
        <PageHeader
          title={
            <span className="flex items-center gap-1.5">
              <span>沉没的记忆</span>
              <Badge tone="success" variant="soft" size="sm">
                使用中
              </Badge>
            </span>
          }
          eyebrow={
            <div className="flex items-center gap-1.5">
              <span className="text-foreground-tertiary text-xs">模组管理</span>
              <ChevronRight className="text-foreground-tertiary size-[13px]" />
              <span className="text-foreground-secondary text-xs font-semibold">沉没的记忆</span>
            </div>
          }
          description="1920 年代旧日式洋馆的湖畔怪谈 · 4-5 名调查员 · 预计 6 小时"
          actions={
            <>
              <Button variant="outline">
                <Pencil />
                编辑信息
              </Button>
              <Button variant="primaryGradient" className="font-semibold">
                <Plus />
                新建场景
              </Button>
            </>
          }
        />

        <Tabs defaultValue="scene" className="gap-5">
          <TabsList>
            <TabsTrigger value="scene">场景 · 5</TabsTrigger>
            <TabsTrigger value="npc">人物 · 8</TabsTrigger>
            <TabsTrigger value="music">音乐 · 12</TabsTrigger>
          </TabsList>

          <TabsContent value="scene">
            <div className="grid grid-cols-3 gap-4">
              {scenes.map((scene) => (
                <Card
                  key={scene.id}
                  className="border-separator gap-0 overflow-hidden rounded-[14px] border p-0"
                >
                  <div className="relative h-[150px]">
                    <img src={scene.thumb} alt={scene.name} className="absolute inset-0 size-full object-cover" />
                    <div className="to-background/80 absolute inset-x-0 bottom-0 h-[50px] bg-linear-to-b from-transparent" />
                  </div>
                  <div className="flex items-center justify-between px-3 py-2.5">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-foreground text-sm font-semibold">{scene.name}</span>
                      <span className="text-foreground-tertiary text-[11px]">{scene.stage}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon-sm" aria-label={`编辑场景 ${scene.name}`} className="text-foreground-secondary size-7">
                        <Pencil />
                      </Button>
                      <Button variant="ghost" size="icon-sm" aria-label={`${scene.name} 更多操作`} className="text-foreground-tertiary size-7">
                        <MoreHorizontal />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}

              <Button
                type="button"
                variant="outline"
                className="border-separator-tertiary h-[216px] flex-col gap-2 rounded-[14px] border-[1.5px] px-4 text-center whitespace-normal"
              >
                <ImagePlus className="text-foreground-tertiary size-[26px]" />
                <span className="text-foreground-secondary text-[13px]">上传背景图新建场景</span>
                <span className="text-foreground-tertiary text-[11px]">支持 JPG / PNG · 建议 1920×1080</span>
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="npc">
            <p className="text-foreground-tertiary py-16 text-center text-sm">人物资源列表</p>
          </TabsContent>

          <TabsContent value="music">
            <p className="text-foreground-tertiary py-16 text-center text-sm">音乐资源列表</p>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
