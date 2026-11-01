type ChatMessage = {
  id: string;
  speakerName: string;
  speakerRoleLabel: string;
  avatarInitials: string;
  avatarBg: string;
  avatarFg: string;
  time: string;
  body: string;
  tone?: "ic" | "ooc";
  isSystem?: boolean;
};

export type { ChatMessage };
