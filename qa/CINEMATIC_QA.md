# Cinematic v1.4 QA — browser and actual devices

## What changed

Version 1.4 replaces the static chapter cards with an **original animated Canvas 2D film sequence**. It is drawn at runtime, with moving characters and props, camera motion, weather, blackout, doors and evidence. This is not pre-rendered video footage or performance-captured 3D actors.

## Opening film (all four official cases)

1. Create a fresh room and join from two devices.
2. Start the investigation. Both devices should show a five-act opening automatically: arrival, gathering, blackout, discovery, investigation.
3. Watch the whole sequence on one device. The image should change continuously, not only when pressing Next Scene. The sequence automatically advances and closes.
4. On the other device, press **Skip film**. Its film should close while the first device keeps watching.
5. Check **Pause**, **Play**, **Next scene** and **Narrate**. Sound off/on must work following a user gesture, without starting audio automatically.
6. If a timed room was chosen, a player's turn must not expire during the opening film. When everybody finishes or skips, the turn timer should reset to its full duration.
7. In the game panel select **Replay story cinematics**. Replay must not reset the cards, solution, turn, scores or room.
8. Test every official case: Hollowmere, Midnight Express, Masquerade and Blackthorn Island. The opening establishing scene should reflect its theme.
9. For accessibility, enable Reduce Motion on the device. The film should be paused by default and offer a manual Next Scene/Skip route.

## Target hardware

- Chrome desktop Windows, desktop macOS Chrome/Safari; check WebGL board and film canvas are both visible.
- Android Chrome and iPhone Safari in portrait and landscape; check controls, caption fit, button accessibility and thermal/performance behaviour.
- Test two **different networks** (e.g. Wi-Fi and mobile data), then a third player if available.

## What does not count as a pass

- A screenshot of a static title card.
- Film animation in Chromium emulation alone. Real devices are still required for release sign-off.
- A passing test build without observing the actual deployed revision and verifying both devices' turns and hands remain private.

## Limitations

The illustration is a stylised real-time 2D cinematic. Photorealistic cutscenes, fully modelled 3D actors, professionally recorded voice performances and a commissioned orchestral score remain future production work. Optional audio in v1.4 is synthesised ambience; optional narration uses the browser's speech synthesiser.
