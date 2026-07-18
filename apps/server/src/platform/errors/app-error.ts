export class AppError extends Error {
  readonly code: string;
  readonly statusCode: number;
  readonly metadata: Record<string, unknown>;

  constructor(
    code: string,
    message: string,
    statusCode = 400,
    metadata: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.statusCode = statusCode;
    this.metadata = metadata;
  }
}
