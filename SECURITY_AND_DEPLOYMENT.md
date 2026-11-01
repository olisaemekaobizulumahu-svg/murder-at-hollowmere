# Deployment, privacy and production hardening

This app currently uses a **single Node process plus local JSON persistence**. Do not run publicly with unprotected persistent player data or prize-bearing competitive features.

## GitHub

The GitHub connection reported a valid authenticated profile but **0 visible repositories** when checked. The connected user must create and authorize an empty repository before code can be pushed. An established repository was not modified during this build.

## Render staging

Use the included `render.yaml` for an **ephemeral beta** only. It starts `npm start`; `/healthz` returns `ok`. For durable data set `DATA_DIR` to a persistent disk path on a compatible paid instance (or refactor to a database). Free ephemeral filesystem loss could destroy user account information, XP, tournaments, chat history and ongoing cases. Render should terminate HTTPS; local HTTP is for development only. Keep `CASE_MODERATOR_KEY` in host environment variables (never frontend code).

Recommended staging configuration: Node 22, HTTPS-only, limited invite testers, daily encrypted backups (if using persistent disk), no real prizes, restrict public account registration until privacy terms and deletion process exist. Give each reporter a single point of contact. Host moderator tools require a secret; community submissions stay non-public until approval.

## Voice

WebRTC signaling is forwarded only to authenticated human peers in the game room. The server does not store audio. A STUN server is configured, but without a TURN relay many combinations of carrier NAT/firewall will fail. Provide explicit opt-in, a secure context, working mute state, disconnect and no microphone use when disabled. Do a live iOS/Android call before promoting voice as reliable.

## Scope of testing

Automated tests cover game rules, account API, timer settings, invitation logic (where explicitly tested), chat visibility and spectator standings. Browser emulation at three screen widths plus cinematic click-through is useful but not physical device sign-off. The execution environment blocks local navigation by Chromium; screenshots were produced by injecting source assets and authentic server-produced state for UI rendering, not by navigating to a publicly deployed site.
