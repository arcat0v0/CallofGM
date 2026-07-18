import type { ChatMessage } from "@/features/chat/types";

export const messages: ChatMessage[] = [
  {
    id: "1",
    speakerName: "KP",
    speakerRoleLabel: "主持人",
    avatarInitials: "KP",
    avatarBg: "bg-accent",
    avatarFg: "text-accent-foreground",
    time: "21:02",
    body: "雨声忽然变大了。你们脚下的木地板传来一阵低沉的、类似船体挤压的呻吟声——图书馆的西侧书架后，似乎有一扇从未见过的暗门。",
  },
  {
    id: "2",
    speakerName: "远野 澪",
    speakerRoleLabel: "PC",
    avatarInitials: "澪",
    avatarBg: "bg-default",
    avatarFg: "text-foreground",
    time: "21:05",
    body: "「……如果日记里写的是真的，那么七年前沉入湖底的，恐怕就不只是那辆车。」她把煤油灯举高，凑近暗门的缝隙。",
  },
];

export const expressionTiles = [
  { key: "default", label: "默认" },
  { key: "smile", label: "微笑" },
  { key: "surprised", label: "惊讶" },
  { key: "angry", label: "生气" },
  { key: "hurt", label: "受伤" },
];

export const myCharacter = {
  name: "远野 澪",
  initials: "澪",
};
