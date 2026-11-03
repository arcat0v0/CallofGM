import { AppError } from "@/platform/errors/app-error";

export class TemplateNotFoundError extends AppError {
  constructor(message = "Template not found") {
    super("TEMPLATE_NOT_FOUND", message, 404);
  }
}

export class TemplateVersionNotFoundError extends AppError {
  constructor(message = "Template version not found") {
    super("TEMPLATE_VERSION_NOT_FOUND", message, 404);
  }
}

export class TemplateRuleMismatchError extends AppError {
  constructor(message = "Character rule does not match template rule") {
    super("TEMPLATE_RULE_MISMATCH", message, 400);
  }
}

export class TemplateSourceNotFoundError extends AppError {
  constructor(message = "Source module not found") {
    super("TEMPLATE_SOURCE_NOT_FOUND", message, 404);
  }
}
