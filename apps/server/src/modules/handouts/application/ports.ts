export interface HandoutRecord {
  id: string;
  moduleId: string;
  title: string;
  content: string;
  imageAssetId: string | null;
  createdAt: number;
}

export interface HandoutGrantRecord {
  id: string;
  sessionId: string;
  handoutId: string;
  isPublic: number;
  createdAt: number;
}

export interface HandoutsRepository {
  findHandoutById(id: string): Promise<HandoutRecord | null>;
  findGrantById(id: string): Promise<HandoutGrantRecord | null>;
  insertGrant(row: {
    id: string;
    sessionId: string;
    handoutId: string;
    isPublic: number;
    createdAt: number;
  }): Promise<void>;
  insertRecipients(
    rows: Array<{
      id: string;
      grantId: string;
      characterId: string;
      createdAt: number;
    }>
  ): Promise<void>;
  listRecipientCharacterIds(grantId: string): Promise<string[]>;
  findCharactersNotInSession(sessionId: string, characterIds: string[]): Promise<string[]>;
}
