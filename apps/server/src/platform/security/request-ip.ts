export function clientIp(
	request: Request,
	server:
		| { requestIP?(request: Request): { address: string } | null }
		| null
		| undefined,
	trustProxy: boolean,
): string {
	if (trustProxy) {
		const forwarded = request.headers.get("x-forwarded-for");
		if (forwarded) {
			const first = forwarded.split(",")[0]?.trim();
			if (first) {
				return first;
			}
		}
	}
	const direct = server?.requestIP?.(request)?.address;
	if (direct) {
		return direct;
	}
	return "unknown";
}
