import { mkdir, unlink } from "fs/promises";
import { join } from "path";
import { type MediaStorage } from "../application/ports";

export class LocalMediaStorage implements MediaStorage {
  private readonly uploadDir: string;

  constructor(uploadDir = "data/uploads") {
    this.uploadDir = uploadDir;
  }

  async store(key: string, data: Uint8Array): Promise<void> {
    await mkdir(this.uploadDir, { recursive: true });
    const filePath = join(this.uploadDir, key);
    await Bun.write(filePath, data);
  }

  async read(key: string): Promise<Uint8Array> {
    const filePath = join(this.uploadDir, key);
    const file = Bun.file(filePath);
    if (!(await file.exists())) {
      throw new Error(`File not found: ${key}`);
    }
    const arrayBuffer = await file.arrayBuffer();
    return new Uint8Array(arrayBuffer);
  }

  async delete(key: string): Promise<void> {
    const filePath = join(this.uploadDir, key);
    try {
      await unlink(filePath);
    } catch (error: unknown) {
      if (error && typeof error === "object" && "code" in error && error.code !== "ENOENT") {
        throw error;
      }
    }
  }
}
