import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type {
	ClaimDto,
	JoinInfoResponse,
	ResolveSessionReferenceResponse,
} from "@cogm/shared";
import { sessions } from "@/platform/db/schema";
import { setupTestApp, type TestContext } from "../helpers/setup";

describe("Session reference resolution contract tests", () => {
	let ctx: TestContext;
	const uniqueUuid = "a1b2c3d4-0000-4000-8000-000000000001";
	const collisionOne = "deadbe01-0000-4000-8000-000000000001";
	const collisionTwo = "deadbe02-0000-4000-8000-000000000002";
	const exactShortId = "abcdef";
	const prefixedUnderExact = "abcdef99-0000-4000-8000-000000000001";
	const deletedSoleUuid = "f00d0001-0000-4000-8000-000000000001";
	const deletedAliasUuid = "cafe0001-0000-4000-8000-000000000001";
	const activeAliasUuid = "cafe0002-0000-4000-8000-000000000002";
	const boundaryNineUuid = "12345901-0000-4000-8000-000000000001";
	const boundaryAUuid = "12345a01-0000-4000-8000-000000000001";
	const maxHexUuid = "ffffff01-0000-4000-8000-000000000001";

	async function insertSession(id: string, deletedAt: number | null = null) {
		await ctx.container.db.insert(sessions).values({
			id,
			ownerId: ctx.gmUserId,
			name: `Session ${id.slice(0, 6)}`,
			moduleId: ctx.moduleId,
			ruleId: "coc7e",
			status: "waiting",
			phase: "free_discussion",
			currentSceneId: null,
			lastEventId: 0,
			sharePcSheets: 1,
			obSeePcState: 1,
			portraitLayout: "auto",
			portraitScale: "md",
			growthConfirmedAt: null,
			deletedAt,
			createdAt: Date.now(),
		});
	}

	beforeAll(async () => {
		ctx = await setupTestApp();
		await insertSession(uniqueUuid);
		await insertSession(collisionOne);
		await insertSession(collisionTwo);
		await insertSession(exactShortId);
		await insertSession(prefixedUnderExact);
		await insertSession(deletedSoleUuid, Date.now());
		await insertSession(deletedAliasUuid, Date.now());
		await insertSession(activeAliasUuid);
		await insertSession(boundaryNineUuid);
		await insertSession(boundaryAUuid);
		await insertSession(maxHexUuid);
	});

	afterAll(() => {
		ctx.container.dbContext.sqlite.close();
	});

	test("resolves six-hex UUID prefix across case, hash, and whitespace forms", async () => {
		for (const ref of ["a1b2c3", "A1B2C3", "%23a1b2c3", "%20A1B2C3%20"]) {
			const res = await ctx.app.handle(
				new Request(`http://localhost/api/v1/public/session-references/${ref}`),
			);
			expect(res.status).toBe(200);
			const body = (await res.json()) as ResolveSessionReferenceResponse;
			expect(body).toEqual({ sessionId: uniqueUuid });
		}
	});

	test("prefers exact match over six-hex prefix collision", async () => {
		const res = await ctx.app.handle(
			new Request(
				`http://localhost/api/v1/public/session-references/${exactShortId}`,
			),
		);
		expect(res.status).toBe(200);
		const body = (await res.json()) as ResolveSessionReferenceResponse;
		expect(body.sessionId).toBe(exactShortId);

		const fullRes = await ctx.app.handle(
			new Request(
				`http://localhost/api/v1/public/session-references/${uniqueUuid}`,
			),
		);
		expect(fullRes.status).toBe(200);
		expect(
			((await fullRes.json()) as ResolveSessionReferenceResponse).sessionId,
		).toBe(uniqueUuid);
	});

	test("returns 409 SESSION_REFERENCE_AMBIGUOUS with no candidate IDs on collision", async () => {
		const res = await ctx.app.handle(
			new Request("http://localhost/api/v1/public/session-references/deadbe"),
		);
		expect(res.status).toBe(409);
		const text = await res.text();
		expect(text).not.toContain(collisionOne);
		expect(text).not.toContain(collisionTwo);
		const body = JSON.parse(text) as {
			code: string;
			metadata?: Record<string, unknown>;
		};
		expect(body.code).toBe("SESSION_REFERENCE_AMBIGUOUS");
		expect(Object.keys(body.metadata ?? {})).toHaveLength(0);
	});

	test("excludes soft-deleted sole and alias matches", async () => {
		const soleDeletedRes = await ctx.app.handle(
			new Request("http://localhost/api/v1/public/session-references/f00d00"),
		);
		expect(soleDeletedRes.status).toBe(404);
		expect(((await soleDeletedRes.json()) as { code: string }).code).toBe(
			"SESSION_NOT_FOUND",
		);

		const aliasRes = await ctx.app.handle(
			new Request("http://localhost/api/v1/public/session-references/cafe00"),
		);
		expect(aliasRes.status).toBe(200);
		expect(
			((await aliasRes.json()) as ResolveSessionReferenceResponse).sessionId,
		).toBe(activeAliasUuid);
	});

	test("enforces exact range boundaries and rejects non-six-hex and malformed percent inputs", async () => {
		const nineRes = await ctx.app.handle(
			new Request("http://localhost/api/v1/public/session-references/123459"),
		);
		expect(nineRes.status).toBe(200);
		expect(
			((await nineRes.json()) as ResolveSessionReferenceResponse).sessionId,
		).toBe(boundaryNineUuid);

		const maxRes = await ctx.app.handle(
			new Request("http://localhost/api/v1/public/session-references/ffffff"),
		);
		expect(maxRes.status).toBe(200);
		expect(
			((await maxRes.json()) as ResolveSessionReferenceResponse).sessionId,
		).toBe(maxHexUuid);

		for (const bad of ["a1b2c", "a1b2c3d", "gggggg", "%ZZ"]) {
			const res = await ctx.app.handle(
				new Request(`http://localhost/api/v1/public/session-references/${bad}`),
			);
			expect(res.status).toBe(404);
			expect(((await res.json()) as { code: string }).code).toBe(
				"SESSION_NOT_FOUND",
			);
		}
	});

	test("keeps direct /join-info short-code lookup as 404 and integrates resolver with join-info and OB claim", async () => {
		const directShort = await ctx.app.handle(
			new Request("http://localhost/api/v1/public/sessions/a1b2c3/join-info"),
		);
		expect(directShort.status).toBe(404);

		const resolvedRes = await ctx.app.handle(
			new Request("http://localhost/api/v1/public/session-references/a1b2c3"),
		);
		expect(resolvedRes.status).toBe(200);
		const { sessionId } =
			(await resolvedRes.json()) as ResolveSessionReferenceResponse;
		expect(sessionId).toBe(uniqueUuid);

		const joinInfoRes = await ctx.app.handle(
			new Request(
				`http://localhost/api/v1/public/sessions/${sessionId}/join-info`,
			),
		);
		expect(joinInfoRes.status).toBe(200);
		const joinInfo = (await joinInfoRes.json()) as JoinInfoResponse;
		expect(joinInfo.session.id).toBe(uniqueUuid);

		const identityRes = await ctx.app.handle(
			new Request("http://localhost/api/v1/player/identity", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ fingerprint: "fp-resolver-ob" }),
			}),
		);
		expect(identityRes.status).toBe(200);
		const { token } = (await identityRes.json()) as { token: string };

		const claimRes = await ctx.app.handle(
			new Request(`http://localhost/api/v1/sessions/${sessionId}/claim`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${token}`,
				},
				body: JSON.stringify({ role: "ob" }),
			}),
		);
		expect(claimRes.status).toBe(200);
		const claim = (await claimRes.json()) as ClaimDto;
		expect(claim.sessionId).toBe(uniqueUuid);
		expect(claim.role).toBe("ob");
	});
});
