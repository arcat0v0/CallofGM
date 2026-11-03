import type { MessageChannel } from "@cogm/shared";

export interface MessageRow {
  id: string;
  sessionId: string;
  senderId: string | null;
  senderUserId: string | null;
  senderType: string;
  characterId: string | null;
  channel: string;
  content: string;
  status: string;
  queueOrder: number;
  expressionKey: string | null;
  eventId: number | null;
  presentedAt: number | null;
  rejectionReason: string | null;
  createdAt: number;
}

export interface NewMessageRow {
  id: string;
  sessionId: string;
  senderId: string | null;
  senderUserId: string | null;
  senderType: string;
  characterId: string | null;
  channel: MessageChannel;
  content: string;
  status: string;
  queueOrder: number;
  expressionKey: string | null;
  eventId: number | null;
  presentedAt: number | null;
  rejectionReason?: string | null;
  createdAt: number;
}

export interface ChatRepository {
  insertMessage(message: NewMessageRow): Promise<void>;
  findMessageById(id: string): Promise<MessageRow | null>;
  maxQueueOrder(sessionId: string): Promise<number>;
  listPending(sessionId: string): Promise<MessageRow[]>;
  listDiscarded(sessionId: string): Promise<MessageRow[]>;
  markPresentedIfPending(id: string, presentedAt: number): Promise<boolean>;
  markDiscardedIfPending(id: string, reason: string | null): Promise<boolean>;
  markPendingIfDiscarded(id: string, queueOrder: number): Promise<boolean>;
  assignEventId(id: string, eventId: number): Promise<void>;
  reorderPending(sessionId: string, orderedIds: string[]): Promise<void>;
  findCharacterName(characterId: string): Promise<string | null>;
  portraitExists(characterId: string, expressionKey: string): Promise<boolean>;
  setSessionCharacterExpression(
    sessionId: string,
    characterId: string,
    expressionKey: string
  ): Promise<void>;
}
