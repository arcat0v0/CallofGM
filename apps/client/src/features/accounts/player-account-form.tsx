import { CreatePlayerAccountRequest } from "@cogm/shared";
import { useId, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import {
	Field,
	FieldDescription,
	FieldError,
	FieldGroup,
	FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { t } from "@/i18n";
import { isApiError } from "@/lib/api";
import { errorText } from "@/lib/errors";

export function PlayerAccountForm({
	submitLabel,
	onSubmit,
}: {
	submitLabel: string;
	onSubmit: (credentials: CreatePlayerAccountRequest) => Promise<void>;
}) {
	const id = useId();
	const [username, setUsername] = useState("");
	const [password, setPassword] = useState("");
	const [pending, setPending] = useState(false);
	const [errors, setErrors] = useState<{
		username?: string;
		password?: string;
		form?: string;
	}>({});

	async function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (pending) return;
		const parsed = CreatePlayerAccountRequest.safeParse({ username, password });
		if (!parsed.success) {
			setErrors({
				username: parsed.error.issues.some(
					(issue) => issue.path[0] === "username",
				)
					? t("account.usernameHint")
					: undefined,
				password: parsed.error.issues.some(
					(issue) => issue.path[0] === "password",
				)
					? t("error.INVALID_PASSWORD")
					: undefined,
			});
			return;
		}
		setPending(true);
		setErrors({});
		try {
			await onSubmit(parsed.data);
		} catch (error) {
			const message = errorText(error, "account.createFailed");
			if (isApiError(error) && error.code === "USERNAME_TAKEN") {
				setErrors({ username: message });
			} else {
				setErrors({ form: message });
			}
		} finally {
			setPending(false);
		}
	}

	return (
		<form
			className="flex flex-col gap-5"
			onSubmit={submit}
			noValidate
			aria-busy={pending}
		>
			<FieldGroup className="gap-4">
				<Field data-invalid={!!errors.username}>
					<FieldLabel htmlFor={`${id}-username`}>
						{t("login.usernameLabel")}
					</FieldLabel>
					<Input
						id={`${id}-username`}
						name="username"
						autoComplete="username"
						autoCapitalize="none"
						spellCheck={false}
						required
						maxLength={32}
						value={username}
						disabled={pending}
						aria-invalid={!!errors.username}
						aria-describedby={
							errors.username ? `${id}-username-error` : undefined
						}
						onChange={(event) => {
							setUsername(event.target.value);
							setErrors((current) => ({
								...current,
								username: undefined,
								form: undefined,
							}));
						}}
					/>
					{errors.username && (
						<FieldError id={`${id}-username-error`}>
							{errors.username}
						</FieldError>
					)}
				</Field>
				<Field data-invalid={!!errors.password}>
					<FieldLabel htmlFor={`${id}-password`}>
						{t("login.passwordLabel")}
					</FieldLabel>
					<Input
						id={`${id}-password`}
						name="password"
						type="password"
						autoComplete="new-password"
						required
						maxLength={128}
						value={password}
						disabled={pending}
						aria-invalid={!!errors.password}
						aria-describedby={`${id}-password-hint`}
						onChange={(event) => {
							setPassword(event.target.value);
							setErrors((current) => ({
								...current,
								password: undefined,
								form: undefined,
							}));
						}}
					/>
					{errors.password ? (
						<FieldError id={`${id}-password-hint`}>
							{errors.password}
						</FieldError>
					) : (
						<FieldDescription id={`${id}-password-hint`}>
							{t("admin.passwordHint")}
						</FieldDescription>
					)}
				</Field>
			</FieldGroup>
			{errors.form && <FieldError>{errors.form}</FieldError>}
			<Button
				type="submit"
				variant="primary"
				className="h-11 w-full"
				disabled={pending}
			>
				{pending ? t("account.creating") : submitLabel}
			</Button>
		</form>
	);
}
