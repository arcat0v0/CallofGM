export interface MediaStorage {
	store(key: string, data: Uint8Array): Promise<void>;
	read(key: string): Promise<Uint8Array>;
	delete(key: string): Promise<void>;
}
