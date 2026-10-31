# Security Posture & Incident Log

This document tracks the project's dependency-supply-chain security stance and records any material incidents that affected (or could have affected) it.

## Configuration

`bunfig.toml` enforces three supply-chain guards at install time:

```toml
[install]
minimumReleaseAge = 2592000   # 30 days — refuse any package version published in the last 30 days
frozenLockfile = true         # bun install may not mutate bun.lock; use --frozen-lockfile or `bun add` explicitly
registry = "https://registry.npmjs.org/"   # pin the registry to defeat mirror/redirect attacks
```

- `minimumReleaseAge` blocks the first 30 days after a version is published — neutralises a large class of "publish a fresh malicious version and rely on autocomplete" attacks.
- `frozenLockfile` makes `bun.lock` the single source of truth. Drift (e.g. a teammate editing `package.json` without re-locking) is rejected at install time instead of silently re-resolving.
- `registry` pin defeats DNS-poisoning / mirror-substitution attacks that swap `registry.npmjs.org` for a hostile proxy.

CI must always install via `bun install --frozen-lockfile`. The flag is redundant with the bunfig setting for plain `install`, but explicit-in-CI is auditable.

## Audit

`bun audit` is wired into the typecheck gate (see `package.json` `scripts.audit` and `typecheck`). CI fails the build on any `high` or `critical` advisory.

## Incident log

### 2026-05-11 — TanStack npm supply-chain compromise (CVE-2026-45321 / GHSA-g7cv-rxg3-hmpx)

**Status: not affected.**

Between **19:20 and 19:26 UTC on 2026-05-11**, attackers hijacked TanStack's GitHub Actions release pipeline (chain: `pull_request_target` misconfiguration → GitHub Actions cache poisoning → OIDC token extraction from runner memory) and published **84 malicious versions across 42 `@tanstack/*` packages** to npm. The build pipeline was compromised, so the malicious packages carried **valid SLSA provenance attestations** — the first documented case of valid-signature malware on a major registry. The payload exfiltrated AWS/GCP/Azure metadata, GitHub/npm tokens, Kubernetes SA tokens, and SSH keys, and had worm-like propagation across other packages the victim could publish.

Source: <https://github.com/advisories/GHSA-g7cv-rxg3-hmpx>

#### Cross-check against this project's `bun.lock`

| Package installed | Installed version | Published (UTC) | Malicious versions | Result |
|---|---|---|---|---|
| `@tanstack/react-router` | 1.170.17 | 2026-07-01 | 1.169.5, 1.169.8 | ✅ clean (post-patch 1.169.9) |
| `@tanstack/react-router-devtools` | 1.167.0 | 2026-05-15 19:27 | 1.166.16, 1.166.19 | ✅ clean (post-patch 1.166.20) |
| `@tanstack/router-plugin` | 1.168.19 | 2026-07-01 | 1.167.38, 1.167.41 | ✅ clean (post-patch 1.167.42) |
| `@tanstack/router-core` | 1.171.14 | 2026-07-01 | 1.169.5, 1.169.8 | ✅ clean |
| `@tanstack/history` | 1.162.0 | 2026-05-15 19:27 | 1.161.9, 1.161.12 | ✅ clean (post-patch 1.161.13) |
| `@tanstack/router-devtools-core` | 1.168.0 | 2026-05-15 19:27 | 1.167.6, 1.167.9 | ✅ clean (post-patch 1.167.10) |
| `@tanstack/router-generator` | 1.167.18 | 2026-07-01 | 1.166.45, 1.166.48 | ✅ clean (post-patch 1.166.49) |
| `@tanstack/router-utils` | 1.162.2 | 2026-06-05 | 1.161.11, 1.161.14 | ✅ clean (post-patch 1.161.15) |

**Verdict:** no installed TanStack package is on the malicious list. Every install lands strictly above the patched baseline, and several installations occurred as early as **2026-05-15 19:27 UTC** — within ~4 days of the attack window.

#### Caveats and required follow-up

1. **Earliest TanStack install in this repo: 2026-05-15 19:27 UTC**, only ~4 days after the 6-minute attack window. The current `bun.lock` is clean, but any environment (developer machine, CI runner, container build cache) that executed `bun install` against TanStack packages during or immediately after the window must be considered suspect. Audit the relevant machine histories.
2. **Credential rotation is mandatory regardless of version match.** Treat every secret that was reachable from any host that resolved TanStack packages on 2026-05-11 or later as potentially exfiltrated. Rotate: GitHub PATs, npm publish tokens, SSH keys, any cloud provider credentials, any CI secrets.
3. **30-day cooldown does not retroactively defend against this incident.** `minimumReleaseAge = 2592000` only blocks brand-new publishes; it does not retroactively flag already-published malicious versions. Defence-in-depth requires `bun audit` (now wired into CI) plus lockfile drift checks.

#### Procedure if a similar incident hits a package we use

1. Pin the current lockfile SHA in this document.
2. Run `bun audit` and confirm advisory IDs.
3. Cross-reference every `@scope/name` we use against the advisory's affected-versions list.
4. If any version matches, halt CI, rotate every secret reachable from the install environment, then `bun update <pkg>` to the patched version and re-run `bun install --frozen-lockfile`.
5. Append a dated entry here summarising the incident, the cross-check, and the resolution.
