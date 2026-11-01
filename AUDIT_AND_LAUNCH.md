# Murder at Hollowmere — Independent audit & launch assessment

Assessment of v1.2.1 (November 2026). This is a **public-beta candidate**, not a complete, production-certified game.

## Verified on supplied source code

- ZIP integrity and JavaScript syntax: passed.
- `npm run build`: passed; generated browser assets matched the source before the patch.
- `npm test`: **17/17** Node tests passed after the v1.2.1 fair-play patch.
- Tests include 2–8 detective deals, ninth-player rejection, AI Master seat, selected detective personas, progressive hint privacy, deduction points, wrong-accusation and final-round rules, multiplayer private-card secrecy.
- The server contains a `/healthz` endpoint and Render `render.yaml` config. This does not verify a cloud deployment.
- Responsive layout: static HTML loaded in Chromium at 390, 820 and 1440 CSS px; document width did not exceed viewport width. This **does not certify interactive gameplay**, WebGL rendering or physical hardware.

## Not verified

- Visual interaction with live multiplayer on physical devices or actual Safari, Firefox, mobile Chrome.
- Cross-device networking through NATs, TLS edge proxies, network interruptions, host handoff and resume on actual hardware.
- WebGL graphics quality, frame rate, touch controls, accessibility or audio on physical devices.
- Public cloud availability, persistent data under a hosted instance, production-scale load, adversarial security, anti-collusion.
- Cinematic cutscenes: they are not included in the build.

## Product completeness

### Implemented

- Browser-based Node multiplayer; 2–8 detective seats with room codes.
- Server-authoritative card hands and sealed envelope; 18-card original mystery.
- Rookie, Sharp and Master AI (Master competitive quality is unbenchmarked).
- Procedural Three.js manor board with lighting, weather effects, camera movements and animated evidence; not full directed cinematics.
- Eight selectable text/icon detective personas (no illustrated character models).
- Four variations of textual opening scene; one case/deck with a randomised solution.
- Questions/accusations, private hints, deduction points and post-game ranking.
- Final opportunity for **last remaining eligible detective** (not a full additional round for every eligible detective).

### Not yet implemented

- Full animated cinematics, branching story events, illustrated playable characters, new full case decks.
- Adjustable turn timers, communication/chat, spectator prediction and rankings.
- Accounts, friends, matchmaking, ranked ladder, persistent XP, achievements, tournaments.
- Community case editor and moderation, multilingual translations, commerce/monetization.

## Priority critique

**P0 / Must fix before a competitive public launch**

1. Incorrect accusations formerly gave players the solution even while others were still playing; **patched in v1.2.1** and covered by an HTTP regression test.
2. Current single-process file-backed persistence is not durable on Render's Free tier, which loses local filesystem changes on spin-down/restart/redeploy. Use a persistent disk on a supported paid plan or migrate to a datastore before treating games/progression as durable.
3. There is no verified abuse/security review for an open public service, no real user accounts and no anti-collusion mechanisms; do not launch ranked tournaments or cash prizes.

**P1 / Fix before general release**

4. With only 15 non-solution cards and eight seats, most players get only 1–2 cards, shortening games and making information unusually sparse. Rebalance using a larger deck or a carefully tested alternative for larger tables.
5. The adopted final-investigation feature differs from the approved design: the implementation grants an extra opportunity to the last eligible detective rather than a final round for every eligible player. The intended rule needs explicit design reconciliation and new tests.
6. Deduction points heavily reward merely asking fresh card triples (+3 each); the Best Detective outcome can reward question quantity rather than correct reasoning. Add quality-based deductions, controlled scoring, and anti-farming rules.
7. Add configurable turn timers, robust reconnect logic testing and onboarding/tutorial before inviting casual public users.
8. Character selection is portraits-free and icon/text only. Additional scenes are story text, not fully scripted 3D cinematic animations.

**P2 / Later-stage scope**

9. Social chat and voice moderation, reputation/XP economy, multi-case content, ranked ladder, internationalisation, and community creation are distinct major product phases.
10. Add accessible controls, WCAG-informed colour contrast and keyboard/touch testing, performance budgets on low-end phones, reduced-motion options and narration/captions.

## Release gates

**Gate 1: Private technical alpha** — Passed the automated 17-test baseline; still requires interactive browser QA.

**Gate 2: Friend-and-family cloud beta** — Connect GitHub + Render, upload this source repository, create a Node **Web Service** with `npm start`, health path `/healthz`; configure durable storage or explicitly accept that games disappear after restarts. Test two actual phones on different networks after deployment.

**Gate 3: Public beta** — Real-device matrix, accessibility and security checks, moderation policy, error telemetry, backup/recovery and legal/privacy review.

**Gate 4: Full intended cinematic product** — Produce and integrate authored cinematics, 3D detective avatars, new cases, audio, social systems and progression; re-test/relaunch.

## Render deployment recipe (after connecting the host)

- The **contents** of the `murder-at-hollowmere` directory must be the **repository root** (including `server.js`, `package.json`, `public`, `render.yaml`).
- Create a Render **Web Service**, not a Static Site. Runtime Node 22, build `npm install`, start `npm start`, health check `/healthz`, bind `0.0.0.0` using Render's `PORT`.
- Consider `TRUST_PROXY=1` only behind a trusted ingress proxy; review IP-based rate limiting when behind your platform's forwarding headers.
- For Free testing, **warn testers that in-progress games may be lost on spin-down/restart**. Free Render services cannot attach persistent disks. For genuine persistence, use a paid instance with an attached disk and set `DATA_DIR` to its mount path, or replace local storage with a managed database.
- After publishing: verify that `/healthz` returns `ok`, check server logs, create a room, join from two different networks, play until accusation, refresh/reconnect, and confirm outcome and state.

## Real-device validation matrix

Use at least: Android Chrome (small 360–390px), iPhone Safari (390px), tablet Safari/Chrome (~820px), Windows Chrome/Edge (1440px), Mac Safari, plus low-bandwidth/offline/restore tests. For each, verify room create/join, 3D stage loading and frame rate, card privacy, hint display, ask/respond, wrong accusation, end scoring, room handoff and keyboard/screen reader affordances. Record screenshots, browser versions, device names, observed frame rates and failures. See `qa/DEVICE_QA_CHECKLIST.md`.
