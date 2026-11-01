# Automatic narration & cinematic finale QA — v1.4.4

## What changed

- Every cinematic attempts speech synthesis on scene entrance, including the opening, discoveries and ending. A dedicated Narration on/mute control replaces the old click-to-narrate-only action.
- Most desktop browsers allow the request after a game Start / Replay click. Some browser and mobile policies block unprompted sound; the film explicitly displays “Audio blocked by browser — tap Enable narration” and subtitles still show. A one-time user gesture may therefore be required. No implementation can bypass browser autoplay permissions.
- Narration is cancelled between scenes, on Skip, and after the ending; pause/resume also pauses/resumes the speech engine.
- The conclusion has three independent animated canvases: final candlelit gathering, three solution cards revealed one by one, and a closing verdict with the winning detective’s portrait when available. These show only after `game.status === "over"`.
- The original five-scene opening and the multiplayer server logic remain unchanged.
- Long text now uses small, responsive captions, rather than large centered slide headlines. The portrait-mobile evidence shot stacks all three solution cards.

## Automated verification

- `npm test` runs prior gameplay tests plus finale and narration regression checks.
- `python build.py` rebuilds the actual browser assets; `node --check public/app.js` validates syntax.
- `test_cinema_visual_v144.py` (development-only screenshot harness; not needed at runtime) injected a test speech engine into Chromium and verified a speak call on each new scene, UI controls, absence of JS exceptions, responsive overflow and non-cropped titles at 1440×900, 390×844, and 950×360.

## Required manual live verification after Render deploy

1. Open `/version`, confirm `1.4.4`, then hard-refresh. Start a **new** game. In a browser with prior user interaction, the cinematic should narrate without pressing Narrate.
2. If a browser blocks speech, tap **Enable narration** once; browser security does not allow us to force microphone/speaker autoplay. Verify narration then resumes on each scene.
3. Run an actual case through completion and verify a winner; confirm that suspect, method and room reveal only *after* the game has ended.
4. On two physical devices, check pause/resume, skip, landscape layout, music volume and any narration interruptions.
5. Test with accessibility reduced motion, browser silent mode and a browser that lacks speech synthesis (captions should remain usable).

The PNGs in qa/screenshots/ are simulated Chromium previews of the new ending, not proof of audiovisual behavior on real devices.
