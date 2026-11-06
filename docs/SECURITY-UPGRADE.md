# Security and technology integration

This fork ports the security and runtime work from [Razzia 4.0.2, commit 8345663](https://github.com/Ralex91/Razzia/tree/8345663f7f47a8d466964fcf5b642cc7a4ed90fb), reviewed on 2026-11-06. The upstream source was compared against GoHoot's shared ancestor rather than replacing GoHoot's quiz model and UI.

## Architecture

- `packages/common` defines question, result, role, session, and Socket.IO contracts with shared Zod validators.
- `packages/socket` serves the Hono HTTP API and `/ws` Socket.IO transport. Both use the same account, permission, quiz, upload, result, and game services. Signed sessions establish identity; browser-supplied client IDs never grant access.
- `packages/web` uses React, Vite, Motion, Radix UI, dnd-kit, and TanStack Query. Account login, quiz editing/loading, game creation/join tickets, and solo results use the typed HTTP client. Existing management actions retain validated Socket.IO compatibility handlers. Live rounds remain Socket.IO based.
- `config` persists JSON accounts, settings, quizzes, results, trash, uploads, upload ownership, and token revocations. Games, timers, rate-limit counters, and connected players remain in memory. There is no database.
- Docker runs nginx on port 3000 and the Node service on internal port 3001 under s6 supervision. nginx proxies the API, WebSocket, and media requests. Native development uses Vite's equivalent proxies.

## Upstream security mapping

| Area                     | Integrated behavior                                                                                                                                                                                                                                                                                               |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Signed identity          | HS256 sessions, separate short-lived join tickets, server-generated subjects, purpose/expiry validation, authenticated reconnects and manager actions. The fork adds persistent logout revocation and account session versions for password/role changes.                                                         |
| Manager access           | Account roles are read from current server data for every protected request or packet. Quiz ownership, result access, account administration, solo eligibility, media ownership, and host ownership are enforced on both transports.                                                                              |
| Input validation         | Shared schemas validate credentials, question formats, IDs, media URLs, game options, timings, navigation, and answer indices. HTTP and Socket.IO body limits and bounded rate-limit counters reject excessive requests.                                                                                          |
| Storage traversal        | IDs are looked up in scanned records, independently of random new filenames. File reads reject symlinks. Writes use temporary files and atomic rename. Legacy IDs and filenames remain readable.                                                                                                                  |
| Uploads                  | Actual file signatures determine media types and extensions. ImageMagick has resource/time limits and a restrictive Docker policy. SVG support is retained with sandbox response headers. Uploaded media is served through checked paths with MIME/nosniff headers and range support.                             |
| Round integrity          | Explicit phases restrict start, answer, abort, leaderboard, and next actions. Stable identities prevent duplicate submissions across reconnects; answer bounds and duplicate indices are checked. Pending answers survive socket replacement. Shuffled questions use their own timings.                           |
| Results and privacy      | Scoring is computed on the server, including solo results. Public podium payloads contain names and points. Full reports stay on the authenticated manager/result paths. Recorded correctness and per-question points support consistent exports.                                                                 |
| Lifecycle                | Timers settle on abort and dispose, empty games expire, disconnected hosts have a lobby reconnect grace period, handler failures are caught, and shutdown disposes games.                                                                                                                                         |
| Runtime and dependencies | Node 24, pnpm 11 catalogs/lockfile, TypeScript 7, Vite 8, Rolldown, Motion 14, unified Radix UI, dnd-kit, TanStack Query, Vitest, and Playwright. ExcelJS replaces the vulnerable legacy XLSX package while retaining `.xlsx` downloads. Explicit dependency overrides cover advisories found during integration. |
| Container and CI         | Pinned base-image digests and action revisions, Alpine security updates, s6, protected build context, security headers, lint/type/format/unit/browser checks, and scheduled Docker Scout scanning.                                                                                                                |

Relevant upstream history includes [path/creation protections](https://github.com/Ralex91/Razzia/commit/1ca35f5), [independent filenames](https://github.com/Ralex91/Razzia/commit/791e7f8), [signed tokens](https://github.com/Ralex91/Razzia/commit/63a1d34), [environment secrets](https://github.com/Ralex91/Razzia/commit/e86588c), [HTTP API migration](https://github.com/Ralex91/Razzia/commit/7d8290f), [join tickets](https://github.com/Ralex91/Razzia/commit/561dcd4), [phase/reconnect protections](https://github.com/Ralex91/Razzia/commit/818e450), [pending answers](https://github.com/Ralex91/Razzia/commit/4aae08b), [payload validation](https://github.com/Ralex91/Razzia/commit/7d94843), and [public podium minimization](https://github.com/Ralex91/Razzia/commit/75b19a7).

## Preserved GoHoot features

The integration retains admin/quizmaster/analyst/quizzer accounts, signup, reset requests and notifications, quiz ownership/filtering, quiz/true-or-false/slide/puzzle questions, multiple correct answers, double points, classic and accuracy scoring with dense ties, shuffling, double time, hidden player text, custom presentation layouts, cropping and media conversion, wallpaper and audio controls, player/host reconnects, attendance history, private solo replay, Excel reports, and trash/restore. The responsive Users/configuration layout is retained.

Upstream's additional question formats, category system, and surveys are separate product features and are not substituted for the fork's formats. Existing Socket.IO management events remain compatibility paths with the same authentication and validation; arbitrary client-authored solo-result submission is disabled in favor of the server-scored HTTP route.

## Upgrade an existing installation

1. Stop running games and back up the entire `config` directory. Keep the backup private. The service updates account hashes and removes legacy plaintext manager credentials as described below.
2. Copy `.env.example` to `.env`. Set `MANAGER_PASSWORD` to a strong password of at least 8 characters and `JWT_SECRET` to a persistent random value of at least 32 characters. Configure `ALLOW_SIGNUP` as desired.
3. Run `docker compose up -d --build` from this checkout. To run without Docker, install Node 24, run `npm install -g pnpm@11.28.7`, `pnpm install --frozen-lockfile`, and `pnpm dev`.
4. Sign in at `/manager`. On a new instance, `admin` uses `MANAGER_PASSWORD`. Existing custom account passwords remain valid; legacy PBKDF2 hashes are upgraded to scrypt after successful login. The old built-in `admin/admin` credential is blocked and replaced by the configured password when the administrator signs in. Setting the environment variable does not silently reset an existing custom administrator password.
5. Existing quiz IDs, ownership, results, and trash remain in place. Legacy quiz files lacking an explicit ID keep their filename identity. New files use independent random filenames; use the `id` inside a record to reference it. Invalid legacy quizzes remain visible and can be repaired in the editor.

A non-default legacy `game.json` manager password can bootstrap an admin when no account exists. Once an administrator exists, the plaintext field is removed while other settings remain. Unreadable account files cause startup to fail rather than overwriting accounts. New and reset passwords require at least 8 characters; existing short custom passwords can still sign in so users can change them.

Signed tokens are stored in localStorage with a SameSite=Strict cookie backup (Secure on HTTPS), retaining the fork's recovery behavior without trusting an unsigned client ID. HTTP authorization still uses an explicit bearer token.

Old unsigned browser identities are replaced on first connection, so users need to sign in again. Password resets, password changes, role changes, and account deletion invalidate older account tokens. `MANAGER_PASSWORD` is a bootstrap/migration setting; subsequent account password changes belong in the UI. Changing `JWT_SECRET` invalidates all sessions. Running games are not persisted across server/container restarts.

Keep `TRUST_PROXY=false` for a directly exposed native Node server. Compose sets it to true because nginx supplies the client address and the Node port is not published. Serve public deployments through HTTPS. The persistent `config` volume and `.env` are excluded from Git and the Docker build context.

## Verification

`pnpm test` covers credential migration, token forgery/revocation, role and ownership boundaries, traversal/symlink rejection, upload signatures and bounds, server-side solo scoring, answer integrity, live reconnects, phase gating, public payloads, and spreadsheet compatibility. The symlink test runs on Linux and is skipped on Windows without symlink privileges.

`pnpm test:e2e` builds the application and exercises real browser login, user controls at 320–1920 px widths, password resets, all four solo formats, keyboard ordering, Excel downloads, quiz editing/reordering and trash/restore, and a live host/guest reconnect-and-score flow. It creates isolated temporary test data and does not use the real `config` directory. Install Chromium first with `pnpm --filter @razzia/e2e exec playwright install chromium`. `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` may point to an existing compatible browser.

Run `pnpm types`, `pnpm lint`, `pnpm format`, `pnpm audit --prod`, and `docker build -t gohoot:local .` alongside those tests. Audit and container scanner results are snapshots of published advisories, not guarantees against unknown vulnerabilities.

## Container scan assessments, 2026-11-06

The local Linux/amd64 image built and passed nginx/API authentication, same-origin WebSocket, upload, and mobile-browser smoke checks. Its raw Docker Scout report identified two high/critical findings. Both were checked against primary sources before adding narrowly scoped [OpenVEX assessments](../docker/vex/alpine-3.24.vex.json):

| Finding         | Installed package           | Evidence and assessment                                                                                                                                                                                                                                                                                                                                                 |
| --------------- | --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CVE-2026-107891 | Alpine 3.24 `musl 1.2.6-r3` | [Alpine's security database](https://secdb.alpinelinux.org/v3.24/main.json) lists this exact version as fixed. The [3.24.3 release announcement](https://www.alpinelinux.org/posts/alpine-3.21.9-3.22.7-3.23.7-3.24.3-released/) confirms the backport. Scout's `1.2.6-r6` threshold comes from the edge branch. The installed stable package already contains the fix. |
| CVE-2026-4738   | Alpine 3.24 `zlib 1.3.2-r1` | The [zlib advisory](https://zlib.net/) identifies `contrib/infback9/inftree9.c`. Alpine's [package build recipe](https://raw.githubusercontent.com/alpinelinux/aports/3.24-stable/main/zlib/APKBUILD) builds the standard shared library; the installed package lists only `libz.so.1` and `libz.so.1.3.2`. The optional contrib code is absent from this runtime.      |

The stable Alpine repositories were refreshed and checked; replacing core libraries with edge packages was unnecessary. The VEX file applies only to these exact package versions in the listed GoHoot image products. Other CVEs and package versions remain subject to the scan gate. CI preserves the raw SARIF report and applies the reviewed assessments only to the failure gate. The local gate reported zero remaining fixable high/critical findings with VEX applied. Review the evidence whenever the image's packages or build change.

Docker Scout requires Docker Hub authentication (`docker login`) and can send image metadata to its service. `pnpm docker:scout` builds a local image, displays the raw overview, and runs the VEX-aware gate.
