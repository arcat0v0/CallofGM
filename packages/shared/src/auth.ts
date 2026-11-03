import { z } from "zod";

export const UserRole = z.enum(["admin", "gm", "pl"]);
export type UserRole = z.infer<typeof UserRole>;

export const UserRoleLabel: Record<UserRole, string> = {
	admin: "管理员",
	gm: "主持人",
	pl: "玩家",
};

export const UsernameSchema = z
	.string()
	.trim()
	.min(3)
	.max(32)
	.regex(/^[A-Za-z0-9_一-龥-]+$/, "username contains unsupported characters");

export const PasswordSchema = z.string().min(8).max(128);

export const LoginRequest = z.object({
	username: z.string().min(1).max(128),
	password: z.string().min(1).max(128),
});
export type LoginRequest = z.infer<typeof LoginRequest>;

export const LoginResponse = z.object({
	userId: z.string(),
	username: z.string(),
	role: UserRole,
	expiresAt: z.number().int(),
});
export type LoginResponse = z.infer<typeof LoginResponse>;

export const AuthMeResponse = z.object({
	type: z.literal("user"),
	userId: z.string(),
	username: z.string(),
	role: UserRole,
});
export type AuthMeResponse = z.infer<typeof AuthMeResponse>;

export const ChangePasswordRequest = z.object({
	currentPassword: z.string().min(1).max(128),
	newPassword: PasswordSchema,
});
export type ChangePasswordRequest = z.infer<typeof ChangePasswordRequest>;

export const CreateUserRequest = z.object({
	username: UsernameSchema,
	password: PasswordSchema,
	role: UserRole,
});
export type CreateUserRequest = z.infer<typeof CreateUserRequest>;

export const UpdateUserRequest = z.object({
	disabled: z.boolean().optional(),
	deleted: z.boolean().optional(),
	username: UsernameSchema.optional(),
});
export type UpdateUserRequest = z.infer<typeof UpdateUserRequest>;

export const ResetUserPasswordRequest = z.object({
	password: PasswordSchema,
});
export type ResetUserPasswordRequest = z.infer<typeof ResetUserPasswordRequest>;

export const UserDto = z.object({
	id: z.string(),
	username: z.string(),
	role: UserRole,
	disabledAt: z.number().int().nullable(),
	deletedAt: z.number().int().nullable(),
	createdAt: z.number().int(),
	updatedAt: z.number().int(),
});
export type UserDto = z.infer<typeof UserDto>;

export const TrashEntityType = z.enum([
	"module",
	"scene",
	"track",
	"handout",
	"character",
	"session",
	"template",
	"media",
	"user",
]);
export type TrashEntityType = z.infer<typeof TrashEntityType>;

export const TrashItemDto = z.object({
	entityType: TrashEntityType,
	id: z.string(),
	name: z.string(),
	deletedAt: z.number().int(),
});
export type TrashItemDto = z.infer<typeof TrashItemDto>;
