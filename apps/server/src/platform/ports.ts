export interface Clock {
  now(): Date;
  nowEpochMs(): number;
}

export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }

  nowEpochMs(): number {
    return Date.now();
  }
}

export interface IdGenerator {
  nextId(): string;
}

export class UuidGenerator implements IdGenerator {
  nextId(): string {
    return crypto.randomUUID();
  }
}

export interface RandomSource {
  random(): number;
  randomInt(min: number, max: number): number;
}

export class SecureRandomSource implements RandomSource {
  random(): number {
    const array = new Uint32Array(1);
    crypto.getRandomValues(array);
    return (array[0] ?? 0) / 4294967296;
  }

  randomInt(min: number, max: number): number {
    const range = max - min + 1;
    const array = new Uint32Array(1);
    crypto.getRandomValues(array);
    return min + ((array[0] ?? 0) % range);
  }
}
