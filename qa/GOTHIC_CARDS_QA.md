# Murder at Hollowmere v1.7.0 — Gothic Evidence Deck QA

## Visual change

- Eighteen unique **locally bundled** illustrated SVG evidence card assets: six suspects, six methods, six places.
- Victorian Gothic ogive arches, copper/antique-gold inlay, category-coloured illustrated interiors, filigree trim and card-back wax-seal treatment.
- Applied to the main cast/collection gallery, private hands, turn-based show-card decisions, small/compact cards, face-up evidence, accusation reveals, deduction notes, case log, and clue-picker chips.
- All three categories retain the **WHO / HOW / WHERE** labels, distinct colours, legible names, focus styling, and touch-target buttons.
- The original 18 card IDs, four case stories, 2–8 player rules, secret-card logic, AI, timers, cinematic openings, 3D board and game scores are **not modified**.

## Automated verification

- Existing gameplay/turn/server test suite retained.
- Tests assert one unique SVG asset exists for each card ID and contains no executable/remote embeds.
- Source and generated HTML/JS tests assert the same SVG illustrations are used across card sizes and UI surfaces.
- HTTP server test fetches every SVG and validates `image/svg+xml` MIME.
- Production `npm run build` and `npm test` are expected to pass.

## Visual verification and limitations

- A stand-alone representative component fixture (`qa/gothic_cards_preview.html`) was rendered with Chromium using `set_content` and inlined assets: **30 / 30 illustrated card instances loaded**, zero JavaScript errors and no horizontal overflow at 1440px and 390px viewport widths.
- These checks are component-level screenshots, **not a full interactive multiplayer WebGL device test**. Production Render deployment must be verified separately.
- Browser/OS fonts and `prefers-reduced-motion` settings can affect subtle layout and transitions. Decorative graphics do not encode secret cards or provide game hints.
