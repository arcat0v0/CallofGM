import { z } from "zod";
import { AppError } from "./app-error";

/** 稳定校验错误：不把 zod 内部结构暴露给客户端 */
export function validationFailed(error?: z.ZodError | unknown): AppError {
  return new AppError("VALIDATION_FAILED", "Invalid request", 400, issueMetadata(error));
}

function issueMetadata(error: unknown): Record<string, unknown> {
  if (!error || typeof error !== "object") {
    return {};
  }
  const issues = (error as { issues?: Array<{ path: PropertyKey[] }> }).issues;
  if (!Array.isArray(issues)) {
    return {};
  }
  return {
    fields: issues.map((issue) => issue.path.map(String).join(".")).filter(Boolean),
  };
}
