import type { TrashEntityType, TrashItemDto } from "@cogm/shared";

export interface TrashRepository {
	listOwned(userId: string): Promise<TrashItemDto[]>;
	listAdmin(): Promise<TrashItemDto[]>;
	restoreOwned(
		userId: string,
		entityType: TrashEntityType,
		id: string,
	): Promise<boolean>;
	restoreOwnedUser(id: string): Promise<boolean>;
	findParentState(
		entityType: TrashEntityType,
		id: string,
	): Promise<{ parentDeleted: boolean }>;
}
