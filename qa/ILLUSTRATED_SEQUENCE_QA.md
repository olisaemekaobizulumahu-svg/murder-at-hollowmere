# Hollowmere illustrated cinematic playback — v1.7.1

## Retired visual fallback
The old procedural clock/manor/dossier visuals no longer render while Hollowmere photographic story frames are loading. Artwork failures hold the scene and show **Retry artwork**, leaving **Skip film** available.

## Verified automated checks
- All five opening shots use distinct, locally bundled WebP artwork.
- Scene readiness and a decoded image are required before starting scene timing and auto-narration.
- Late image events cannot restart earlier scenes.
- The ending gathering, evidence reveal, and verdict have separate illustrated scene assets.
- Three other official mysteries preserve their own themed scenes.
- Existing deduction, turn stability, and player privacy tests continue to pass.

## Browser checks
- Chromium desktop: every opening shot entered the correct order, all images decoded, zero JavaScript errors.
- Chromium narrow mobile: scene art rendered; right-side grandfather clock received a specific portrait crop.
- Simulated clock image 404: film stopped on **Retry artwork** and recovered after retry, without displaying the old drawing.
- Finale: illustrated three-scene sequence played in order in narrow mobile Chromium with no JavaScript errors.
- The screenshot previews are from a standalone HTML harness due the test environment blocking navigation to a running local website; this does not substitute for live Render or real-device testing.

## Recommended real-device test after Render deployment
Open the published game, check `/version` = 1.7.1, create a new Hollowmere room, start the case, and confirm all five scenes show photography-style artwork and narration starts automatically if browser sound permits. Test on iOS Safari and Android Chrome.
