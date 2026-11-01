import { z } from "zod";

// ---------- commands ----------

export const GrantHandoutCommand = z.object({
  handoutId: z.string().min(1),
  /** 为空数组表示公开发放；否则秘密发放给指定 PC */
  recipientCharacterIds: z.array(z.string().min(1)).max(50).default([]),
});
export type GrantHandoutCommand = z.infer<typeof GrantHandoutCommand>;

export const AppendHandoutRecipientsCommand = z.object({
  grantId: z.string().min(1),
  recipientCharacterIds: z.array(z.string().min(1)).min(1).max(50),
});
export type AppendHandoutRecipientsCommand = z.infer<typeof AppendHandoutRecipientsCommand>;

export const ReadHandoutCommand = z.object({
  grantId: z.string().min(1),
});
export type ReadHandoutCommand = z.infer<typeof ReadHandoutCommand>;

// ---------- events & DTO ----------

export const HandoutDto = z.object({
  id: z.string(),
  title: z.string(),
  content: z.string(),
  imageAssetId: z.string().nullable(),
});
export type HandoutDto = z.infer<typeof HandoutDto>;

export const GrantedHandoutDto = z.object({
  grantId: z.string(),
  handout: HandoutDto,
  isPublic: z.boolean(),
  grantedAt: z.number().int(),
  read: z.boolean(),
});
export type GrantedHandoutDto = z.infer<typeof GrantedHandoutDto>;

/** Event payload: handout:granted（public 或 selectedPcIds 可见） */
export const HandoutGrantedEvent = z.object({
  grant: GrantedHandoutDto,
});
export type HandoutGrantedEvent = z.infer<typeof HandoutGrantedEvent>;
