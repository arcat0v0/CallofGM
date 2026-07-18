import { type DbClient } from "./client";

export interface TransactionRunner {
  run<T>(work: (tx: DbClient) => Promise<T>): Promise<T>;
}

export class DrizzleTransactionRunner implements TransactionRunner {
  private db: DbClient;

  constructor(db: DbClient) {
    this.db = db;
  }

  async run<T>(work: (tx: DbClient) => Promise<T>): Promise<T> {
    return await this.db.transaction(async (tx) => {
      return await work(tx);
    });
  }
}
