# Detective selection and AI — v1.7.2

## Automated checks

- Different browser identities join the same room as different chosen detectives.
- A duplicate claimed portrait is rejected by the server and not silently substituted.
- One human cannot change another human's selected detective.
- Host can change an AI's detective, but other players cannot.
- Three AI difficulty levels (Rookie, Sharp, Master) and an eight-seat cap work.
- All eight detective identities are distinct at a full table; default auto-assign also stays unique.
- Host can start an investigation with AI; character changes are disabled after the deal.
- The actual HTTP `/api/act` endpoint handles online joins, character changes, and AI additions.
- The generated browser interface contains the pre-seat portrait picker, online pick controls, and AI options.

## Visual smoke checks

- The host sees a **Choose detective** shortcut in the lobby; **+ Computer detective** appears for the host when seats remain.
- Clicking **Change portrait** on the home screen scrolls to the character roster; a home selection carries into a newly created or joined game.
- An invited player who has not taken a seat sees eight portraits, with taken characters disabled.
- Selecting a portrait does not erase the already typed name in the **Take a seat** form.
- Once seated, each player's own character can be changed in the lobby; other humans' choices are reserved.
- Host can choose a specific portrait and press **+ Rookie AI**, **+ Sharp AI**, or **+ Master AI**.
- AI appears under its chosen detective name, with an AI difficulty badge and matching portrait.
- Try the same flow on two physical devices; it must not rely on one browser's local storage.
- A deployed Render service should return `1.7.2` from `/version` before checking production.

**Browser testing note:** Our local Chromium navigation sandbox blocked local HTTP navigation. Static desktop/mobile lobby rendering confirmed no horizontal overflow, but real-device interaction testing on Render remains necessary.
