# Current cinematic status — Version 1.4

**Implemented:** A five-act, autoplaying animated 2D opening with multiple characters/props, a moving carriage, atmospheric storm, will reading, blackout/clock, discovery, evidence sequence, scene controls, narration and optional procedural ambience. An in-game replay button and a server-side opening-film grace period are included.

**Not implemented:** Pre-rendered video, photorealistic films, motion-captured 3D actors, professional voice acting or a bespoke orchestral soundtrack. Browser emulation does not replace physical device QA. The Render deployment is updated only after a successful GitHub publish and hosting redeploy.

---

# Murder at Hollowmere — v1.3 Release Verification Matrix

The goal is to build a serious multiplayer mystery game; this release is an **expanded beta, not a finished cinematic commercial game**. Source-level and test-level evidence is separated from hardware and hosting verification.

| Feature | Implemented | Verified | Remaining caveats |
|---|---|---|---|
| 2–8 detectives, real multiplayer | Yes | Node HTTP tests | Real networks/phones not signed off |
| Original 3D manor | Yes, inherited | Source inspection and fallback/static visual render | WebGL frame rate and mobile gestures unverified |
| Four complete themed case decks | Four named 18-slot themes with narratives | Selection, card model and rendering | Same deduction engine and generic manor model; no unique 3D environments |
| Animated intro / character / evidence / ending scenes | Browser motion-graphics sequences | Desktop + phone Chromium screenshots and click-through | Not rendered 3D actor cutscenes or cinematic movies; optional synthetic TTS voice |
| Dynamic scripted plot interludes | Yes, after 3rd/7th/12th question | Source/test inspection | Atmospheric events; do not constitute case-solving evidence |
| Adjustable host turn timer | Yes (0/30/60/120) | Server status/deadline test | Physical clock/background handling unverified |
| Text chat: public, private, spectator | Yes | HTTP privacy tests | Basic profanity/mute/report only; moderation queue manual |
| Voice chat | Experimental WebRTC offer/answer/ICE | Source and syntax | No two-device audio/ICE/TURN/permissions test; not launch-certified |
| Optional password accounts | Yes | HTTP register/login tests | No email verification, password recovery or account transfer of live seat |
| Friends and invites | Yes | Friend request/accept tests | Friend invitation rendering; no scalable notification service |
| Casual and ranked matchmaking | Basic | Server matching logic | No global skill-based matching, region queues, anti-smurf controls |
| XP / level / achievements / provisional rating | Yes | Completed-game accounting tests | Local JSON storage, not production-scalable |
| Private tournament codes/points | Early form | API tests | No bracket generator, scheduling, prizes or fraud review |
| Community case drafts/review | Yes | Create/submit/protected review tests | Manual moderator approval; no visual case editor or copyright screening automation |
| Spectator prediction standings | Yes | API secrecy and result tests | Account/leaderboard abuse prevention still needed |
| Browser visual testing | Desktop/tablet/mobile simulated | Three widths, intro controls and injected real server game state | Physical devices and direct live WebGL navigation not executed |
| GitHub publication | No | GitHub connector profile identified; repository list empty | Create and authorize a repository first |
| Public deployment URL | No | Local HTTP /healthz | Hosting credentials and repository needed |
| Durable user-data storage | No | JSON file code inspection | Needs persistent volume and backups for public use |

## Must do before open beta

1. Test live HTTPS multiplayer using actual iOS Safari and Android Chrome over different networks; verify WebGL rendering and reconnection.
2. Add TURN relay and test real voice sessions with permissions, mute and disconnect; alternatively keep voice disabled by default.
3. Deploy on a persistent server with backups; set up privacy policy, password reset and account deletion before collecting durable public accounts.
4. Perform security review of authentication, signaling, moderation, CSRF/CSP and persistent data access. Review card privacy and spectator pathways under adversarial clients.
5. Validate matchmaking latency, player queue abuse, fairness of eight-player short hands and the final investigation design.
6. Replace starter tournament and community-moderation tools with polished, operational systems before enabling mass participation.

## Test command

```sh
npm test
npm run build
```

Keep `data/` outside Git and never commit `.env`, password hashes or production states.


### v1.4.1 — Human turn stability
- Replaced automatic idle forfeits with deliberate actions or configured turn timers.
- Stopped cascading turn skips if everyone is offline or away.
- Preserved turn deadlines during pauses and recovery from cold Render restarts.
- Logged explicit skip causes and added regression tests for reconnect, timing and away/idle behavior.

### v1.4.4 cinematic and automatic narration patch

- Added scene-entry auto-narration with system speech voices, pause/resume and cancellation, browser-autoplay fallback, and compact captions.
- Added three new animated finale shots with staged evidence cards and postgame-only solution data, plus a winner portrait shot when available.
- On portrait mobile screens, all three revealed cards are displayed together, instead of being cropped to one central card.
- Retained the existing 3D manor, detective portrait assets, room codes, multiplayer game engine and turn-stability guard.
- The animation is procedural canvas art, not prerecorded 3D-character footage; narration voice quality and true hands-free playback depend on the player's browser and system policy.

## Version 1.4.5 — Automatic scene-synchronized narration

The cinematic voice starts automatically when each scene appears, and the film waits for the spoken line to finish before advancing. The Narrate button is removed; voice is on by default with an optional Mute control. Ordinary game interactions unlock the browser speech engine before the game starts. Browser autoplay restrictions may still prevent sound until a gesture occurs; captions continue automatically. The existing Render URL is unchanged. Verify /version reports 1.4.5 before testing.
