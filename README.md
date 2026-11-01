# Murder at Hollowmere — v1.4 Animated Cinematic Beta

**An original cross-device murder mystery game with a real Node.js server.** Solve the sealed suspect/method/scene combination with 2–8 human or AI detectives. The original Three.js manor board, secret hands, card questioning and accusations remain the core experience.

## What's playable

- **Four themed mysteries:** Murder at Hollowmere, Death on the Midnight Express, The Masquerade Murder and Secrets of Blackthorn Island. Each has its own premise, 18 themed suspect/method/location names, 54 additional descriptions across the three new cases, and cinematic opening atmosphere. They share the 18-slot deduction engine and existing 3D board geometry; they are *not* four entirely separately modelled environments.
- **Actual moving animated cinematic scenes:** Five automatically advancing, original Canvas-rendered acts show an approach to the estate/train/ball/island, the gathering, stopped-clock blackout, discovery and sealed case evidence. Weather, characters, doors, clock hands, carriage, camera motion, subtitles, pause/skip, replay, optional synthesised ambience and speech narration are included. Additional cinematic discoveries and a final reveal also remain. **This is stylised in-browser motion graphics, not prerecorded film or performance-captured 3D acting.** First-turn server timers include a 42-second cinematic grace period, released early when all detectives finish/skip the film.
- **Turn timers:** Host chooses unlimited, 30, 60 or 120 seconds. Server enforces decision time, not merely a decorative countdown; card-answer wait is treated separately.
- **Text conversation:** Room chat, private chat and a separate spectator lounge. Chat reporting and host muting. Private messages and predictions remain server-filtered.
- **Experimental voice:** Opt-in peer-to-peer microphone calls using WebRTC signaling through the game server. HTTPS/permission required, and STUN-only calls may fail without a TURN relay.
- **Optional accounts:** Usernames and scrypt-hashed passwords, XP, account levels, achievements, lifetime stats, provisional ranked rating, friends, friendship requests and friend game invitations. Existing guest play still works. **Active game seats are tied to the browser's private key; logging into the account on another device does not move an active seat automatically. Use Settings → Copy my private link carefully.**
- **Matchmaking:** Casual and account-required ranked lobbies, with automatic match start after two or more players have assembled and a waiting period. Not yet skill-based global queueing.
- **Early tournament support:** Private invite codes, membership and tournament points from completed eligible games. No automated brackets/scheduling/prize fulfillment.
- **Community mysteries:** Authenticated users can create 18-card themed case drafts, play their own drafts and submit for manual moderation. Publication to public discovery requires a server moderator key; no automatic content moderation or creator payouts.
- **Spectator predictions:** Spectators can seal one private combination per game and see a separate ranked prediction result at the final reveal.
- **Game fairness:** Private hands, progressive hints, deduction scoring, one accusation per detective, final unsolved-score honour and server-side authority. Wrong accusations do not disclose the envelope during continued play.

## Run on your own computer

Requires Node.js **18+** (Node.js 22 recommended) and Python 3 for rebuilding browser assets.

```sh
npm test
npm start
```

Open **http://localhost:8080**. To edit browser sources in `src/`, run `npm run build`. `public/index.html` and `public/app.js` are generated and included for hosts where Python is unavailable at deploy time. You can also build a container with the included Dockerfile.

## How to publish through GitHub and Render

The code is ready to *upload*, but **this ZIP has not been published to GitHub or deployed to a public URL**. GitHub access may be connected in ChatGPT, but the connector must also have access to an actual repository. Current inspection found no accessible repositories.

1. Create an empty repository named `murder-at-hollowmere` at https://github.com/new. Set it **private** initially while assessing account security and compliance. Give your ChatGPT GitHub connection access to that repository.
2. Upload **the files inside this project folder**, including `public/`, `src/`, `tests/`, `.github/`, `render.yaml`, `server.js` and `package.json`. Do **not** upload `data/`, secrets, test databases or `.env` files.
3. In Render, create a new **Web Service** connected to the repository. Choose Node.js, `npm install` as build command, `npm start` as start command, and `/healthz` as health-check endpoint. The included `render.yaml` is a free **ephemeral beta** configuration.
4. For persistent accounts, friends, tournaments and ongoing games use a plan/storage service that preserves `DATA_DIR` across deploys and restarts. Free ephemeral filesystems can wipe *all* accounts, passwords, XP and game states; never promise lasting account data on that configuration.
5. Set a long, secret `CASE_MODERATOR_KEY` server environment variable to approve community submissions. Do **not** commit it to GitHub.
6. Verify the live HTTPS URL, conduct two-network multiplayer tests and full physical-device QA before distributing widely.

**Static Netlify hosting alone is not enough**: this app requires a long-lived Node server and state management. For a durable high-traffic launch replace JSON-file storage with a proper database and design multi-instance event distribution. Production voice calls need a TURN relay.

## Security and privacy

- The server stores game state and optional account password **hashes**, private card hands, messages and profiles in `DATA_DIR/state.json`. Protect the folder and back it up securely. Avoid storing production data on an ephemeral free host.
- Secret links in Settings grant possession of a player's active seat: share them only with yourself. Passwords should be used only over HTTPS on an actual deployment.
- Browser microphone permission is voluntary; the game server relays call **signaling**, not the audio media itself.
- Moderation and reporting are basic beta controls, not a complete trust-and-safety platform. Don't run prize-bearing tournaments without an independent security review.
- Community case submissions require a human moderator and are not publicly listed until approval.

## QA status

Version 1.4 adds two automated tests (21 total), including animated scene rendering and fair first-turn timer handling. Desktop and simulated mobile Chromium cinematic screenshots were checked; animations were observed across successive frames, with pause and automatic progression tested. See `qa/CINEMATIC_QA.md` for physical-device sign-off.


`npm test` covers core rules and new platform HTTP flows. Chromium-based offline/static UI smoke tests and synthetic game-state rendering have been run at 390px, 820px and 1440px widths without reported JavaScript errors or horizontal overflow. These **do not replace real-device Chrome/Safari/WebGL/voice testing**. The execution environment blocks direct local HTTP navigation from browser automation. Follow `qa/DEVICE_QA_CHECKLIST.md` on a public test server.

## Source map

- `server.js`: server-side authoritative game logic, SSE, accounts, matchmaking, chat, tournaments and stored case drafts.
- `public/rules.js`: shared 18-card deduction rules and eight detective personas.
- `public/cases.js`: four official case scenarios with themed card names and writing.
- `src/platform.js`, `src/cinema.js`, `src/extra.css`: platform UI, cinema player and original animated story rendering, WebRTC audio, accounts and responsive styles.
- `src/app_top.js`, `src/stage.js`, `src/app_bottom.js`: legacy client and Three.js manor stage.
- `build.py`: regenerates `public/index.html` and `public/app.js`.
- `.github/workflows/ci.yml`: build and test pipeline for when the repository is created.
- `IMPLEMENTATION_STATUS.md`: detailed shipped-versus-unverified checklist.

For developers, the API requires the per-device `pid` and `key` and must be accessed through HTTPS when deployed. Never expose an account password or moderator key in public logs or browser JavaScript.


### Turn-stability repair (1.4.1)

- Human detectives with **No timer** selected do not lose their turn because they have been idle while connected. A player must ask/end/accuse; no silent 5-minute skip.
- A timed turn passes only when its configured countdown expires. The event log identifies the timer as the cause.
- If a detective disconnects but at least one other detective remains online, a 90-second reconnect grace applies before the offline turn can be skipped. A disconnected detective is **not permanently auto-marked away**.
- Explicitly choosing Away skips that detective's turns at a measured pace, only when another active detective is connected.
- If **everyone** is away/offline, game progression and turn countdowns **pause**. Timers resume with their remaining time when an active detective returns.
- A cold server restart resets expired clock timestamps to avoid instant mass skipping on restored rooms. Previous automatic-away flags are cleared on restoration; manual Away choices are preserved.
- For a fresh test, create a new room after the corrected Render deployment. Existing state on a free Render service is not guaranteed to persist between restarts.

## Version 1.4.2 — Detective portraits

Eight original local WebP detective portraits are included in `public/assets/detectives/`. The home roster, lobby seat indicators, visual character picker, active investigator panel and case-winning screen now use the chosen image. The 3D board retains its original stylized pieces, and gameplay is unchanged. See `qa/CHARACTER_PORTRAIT_QA.md` for verification.
