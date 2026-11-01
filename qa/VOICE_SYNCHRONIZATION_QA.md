# Version 1.4.5 narration QA

- Voice is enabled automatically in opening, story discoveries and ending.
- Narration starts at scene entry; a scene cannot end while its narrator is speaking.
- A normal Start/Join/Deal click arms the browser's Web Speech engine; no Narrate button is needed.
- Pause pauses both animation and speech. Next/Skip cancels any previous line. Voice mute is optional.
- Browser autoplay restrictions cannot be bypassed. Captions and timed animation continue if speech is blocked.
- Automated regression tests cover the source and the final scene gating; additional desktop and simulated phone Chromium tests validated the opening and ending.
- Physical audio tests on Safari/Chrome and Render deployment are still needed.
