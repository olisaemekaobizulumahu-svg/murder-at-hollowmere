# Building Murder at Hollowmere with ChatGPT

There are two ways to use these prompts.

- **Way 1: rebuild it from scratch.** Paste **Prompt 1** (the design brief) into a new ChatGPT chat,
  then **Prompts 2 to 7** one at a time, in order. Each one asks for one file. Save each file into
  the folder layout shown in Prompt 1, then run it with `node server.js`.
  ChatGPT writes its own version of the code, so it won't match this project line for line, and it
  will need a few rounds of "here's the error, fix it". Prompt 8 is a checklist for those rounds.
- **Way 2: start from the finished code.** Upload `murder-at-hollowmere.zip` to ChatGPT and paste
  **Prompt 10**. Use this to explain, change or deploy the version that's already built and tested.

Prompt 9 covers putting it online once it works.

Tips:
- Use a model that can write long code (a "thinking" or coding model if you have one).
- If a reply gets cut off, say: *"Continue exactly where you stopped, inside the same code block."*
- Keep everything in one chat so ChatGPT remembers the brief.

---

## Prompt 1: the design brief (paste first)

```
You are a senior full-stack game developer. We're going to build a complete, working multiplayer
web game together, one file at a time. Read this whole brief, then reply only with: (1) a short
summary of the architecture in your own words, (2) any questions, and (3) "Ready for file 1".
Don't write code yet.

# The game: "Murder at Hollowmere"
A family murder mystery in the style of the classic deduction board game, played together from
separate phones and computers, in any web browser, with no accounts. Story: Great-Uncle Ambrose
gathered the whole family at Hollowmere Manor to read out his new will. At 11:47 the hall clock
stopped, and so did Ambrose. Someone at this reunion did it. Work out who, how and where before
anyone else does.

## Project requirements (must all be met)
- At least two players can join from separate devices.
- The game has real rules a player can follow without anyone explaining them (rules are shown in
  the page).
- It runs as a real website at a public URL (Node server deployed to a free host).

## Cards (18): use these exact ids, names, short names, emoji and one-line notes
Who (relatives):
- philippa, "Aunt Philippa", "Philippa", 👒, "Ran the house for thirty years. The new will gives it to someone else."
- rupert, "Cousin Rupert", "Rupert", 🎩, "Charming, broke, and owes money to the wrong people."
- beatrice, "Nana Beatrice", "Beatrice", 🧶, "Ambrose's little sister. Has never forgiven him for 1962."
- desmond, "Uncle Desmond", "Desmond", 🔧, "An inventor. Ambrose laughed at every one of his ideas."
- imogen, "Cousin Imogen", "Imogen", ✒️, "Writes mystery novels and has been taking notes all weekend."
- hollis, "Hollis", "Hollis", 🍳, "Philippa's husband and the family cook. Hears everything."
How (methods):
- cocoa, "Poisoned Cocoa", "Cocoa", ☕, "His nightly mug, left to cool on the landing."
- soup, "Mushroom Soup", "Soup", 🍄, "Foraged that morning. Not every mushroom was the friendly kind."
- shears, "Garden Shears", "Shears", ✂️, "Missing from the potting shed since teatime."
- foil, "Fencing Foil", "Foil", 🤺, "Taken from the trophy wall. The safety tip turned up in a vase."
- wasps, "Jar of Wasps", "Wasps", 🐝, "Everyone knew about his allergy."
- clock, "Grandfather Clock", "Clock", 🕰️, "Stopped at 11:47. Something heavy hit it first."
Where (rooms; the short name is the same as the full name unless one is given):
- greenhouse, "Greenhouse", 🌿, "Orchids, a dripping tap, and fresh footprints in the soil."
- cellar, "Wine Cellar", "Cellar", 🍷, "Dim, cold, and one bottle short."
- attic, "Attic", 🕸️, "Trunks of old letters that someone has been reading."
- boathouse, "Boathouse", 🛶, "Down by the lake. The rowing boat was untied."
- music, "Music Room", 🎻, "Someone was playing at half past eleven. Nobody admits to it."
- gallery, "Portrait Gallery", "Gallery", 🖼️, "Ambrose's own portrait has been knocked crooked."

## Rules
- 2 to 6 seats. Seats can be people on their own device, computer detectives, or "pass-the-phone"
  players who sit at someone else's device.
- Deal: the server secretly picks one relative, one method and one room for the envelope. The other
  15 cards are shuffled and dealt evenly (floor(15 / holders) each); leftovers are laid face up for
  everyone. With exactly 2 seats, "Fennimore the butler" joins as an extra card holder (5 cards
  each) to keep the puzzle interesting. He never takes turns, only answers questions.
- A random seat goes first. On your turn:
  1. Ask a question: pick one relative, one method and one room (you may include your own cards).
  2. The others answer in seat order starting from your left (Fennimore last). The first one who
     holds any of the three must secretly show you exactly one of them. Everyone sees that a card
     was shown and by whom; only you see which. Someone holding none of them passes automatically.
  3. If nobody can show, each of the three is in your hand or in the envelope.
  4. End your turn, or accuse.
- Accusing: at the start of your turn or after your question, name a relative, method and room.
  All three right: you win and the envelope is revealed to everyone. Any wrong: you're out of the
  running, you privately see the envelope, you take no more turns but must still show cards when
  asked. One accusation each. If every detective is out, the culprit gets away.

## Architecture (important)
- One Node.js server, `server.js`, using only built-in modules (http, fs, path, crypto, zlib).
  No npm packages. Node 18 or newer. Listens on process.env.PORT (default 8080).
- The server is the referee. It deals, keeps the envelope, every hand, and which card each "show"
  was. It runs the computer detectives and all timers. Clients never receive another seat's cards
  or the answer. This is the whole point: nobody can peek, not even the host.
- Shared rules file `public/rules.js` (cards + pure helpers) works in both Node (module.exports)
  and the browser (window.HM).
- Page: `public/index.html` (markup + CSS), `public/app.js` (all client code, no inline scripts),
  `public/three.min.js` (three.js r128, served locally).
- Identity without accounts: each browser makes a random player id `u_` + 20 letters/digits and a
  32-character secret, stored in localStorage. The server registers the id on first use with a
  SHA-256 hash of the secret (trust on first use) and checks it on every request.
- Talking to the server:
  - `POST /api/act` with JSON `{op, pid, key, code, ...}` returns `{ok:true,...}` or
    `{ok:false, error:"friendly message"}`.
  - `POST /api/stream` with `{pid, key, code}` returns a server-sent event stream read with fetch()
    (not EventSource, so the secret isn't in the URL). Events: `state` (this device's view of the
    table), `tables` (your cases, when on the home page), `missing`, `nudge`. Comment pings every
    20 s. The client reconnects with backoff and treats 50 s of silence as a dead connection.
- Per-device view: `{g: public table, mine: {hands: {seat: cards} for seats this device controls,
  dec: {logEntryNumber: {card}} for shows to or by its seats, and {solution} for its own wrong
  accusation}, online: [player ids with the table open], me}`. The public table never includes
  hidden data. At game over it adds `solution` and `allHands`.
- Table codes: 4 letters from ABCDEFGHJKLMNPQRSTUVWXYZ. Invite links are `?t=CODE`.
- Ops: create, join, unjoin, addbot {lvl: rookie|sharp}, addlocal {name}, kick, start, ask, show,
  pass, end, accuse, away {v}, leave (for good), handover, endcase, rematch, nudge.
  Validate everything server-side: only your own seats, only legal moves, only cards you hold.
- Never let a game stall:
  - Someone holding none of the asked cards passes automatically after about 1 s.
  - A seat marked away: the server shows a card for them (preferring one they've already shown that
    asker) and skips their turns.
  - Page closed: after 30 s the server answers for them. After 90 s on their own turn it skips the
    turn and marks them away. Reconnecting clears automatic away.
  - Idle: answer for them after 3 minutes; mark them away after 5 minutes on their own turn.
  - Host gone for 60 s: hosting passes to another person who has the table open.
  - Accusations are judged by the server after a short ~2.4 s "opening the envelope" pause.
  - Leaving for good lays your cards face up for everyone and takes you out of the running.
  - Make all these times environment variables.
- Computer detectives (server-side, same delays as a person thinking, ~1–3 s):
  - They reason only from what a player in their seat would know.
  - Rookies use their own hand, face-up cards and cards shown to them.
  - Sharp ones also use every pass, other players' hand sizes, and "X showed Y a card for these
    three" constraints.
  - Both accuse only when certain. Sharp ones prefer to re-show a card the asker has already seen.
- Persistence: save all tables to `DATA_DIR/state.json` (atomic write, debounced) and reload on
  start. Clear finished tables after 2 days, idle lobbies after 2 days and stuck games after 7 days.
- Safety for a public site:
  - Rate limits per IP and per player, including wrong table codes, new tables per hour and new
    devices per hour.
  - 8 KB body limit, and names cleaned to 16 characters.
  - Cap open streams per IP.
  - Security headers: CSP with script-src 'self', X-Frame-Options DENY, nosniff and no-referrer.
  - Gzip and ETag for static files.
  - A `/healthz` route.

## Page design
- Mood: an old manor on a stormy night, a card table, ivory playing cards, brass and wax-seal red.
  Fonts from Google Fonts: "IM Fell English" (display) and "IM Fell English SC" (small caps
  eyebrows), "Alegreya Sans" (body), and "Courier Prime" (case log, like a police report).
- Light theme tokens: bg #e7e2ea, surface #f6f3f7, surface-2 #ece6ef, ink #231a29,
  muted #665a6e, line #d1c6d6, brass #83600f, seal #972630, who #8b2c3a, how #2b674b,
  where #2c4b7a, card #fbf6ea. Seat colours #a3303c #28688a #7c5a0e #5a3f86 #2b6e4b #9c437f.
  Board stage gradient #3a2a45 → #120c17.
- Dark theme (prefers-color-scheme): bg #15101a, surface #211a27, surface-2 #2a2131, ink #ede5f0,
  muted #a697ad, line #3b3043, brass #d8b060, seal #e0656c, who #ee8b99, how #7cc6a0,
  where #93b3e8. Seat colours #ef8792 #7cc0e2 #dcb45c #b39ae6 #7cc6a0 #e597cb.
- Home page:
  - Big 3D board as the hero, with the title "Murder at *Hollowmere*" over it.
  - A join box with "Your name at the table", "Start a new case" and "Or join with a table code".
    It sits on the board on wide screens and just below the board on narrow ones.
  - Then the story, "Your cases" (tables you're seated at, with "Your move" badges), "How to play"
    rules cards, and "The family and the evidence" cast list.
- Lobby:
  - Big table code, and an "Invite the family" box with the link plus Copy and Share buttons.
  - Guest list with seat colours, online dots and host/you tags.
  - Host-only buttons: "+ Rookie" and "+ Sharp" computer detectives, and "Deal the cards".
  - "+ Player on this device" for pass-the-phone.
  - A name field with "Take a seat" for visitors.
- Table:
  - A row of seat chips showing name, card count and status (Your turn / Checking cards… /
    Thinking… / Away / Out).
  - The 3D board, then the action panel and your hand as a fan of ivory cards.
  - Tabs for Notebook, Case log and How to play. On wide screens the notebook sits in a right
    column.
- Action panel:
  - On your turn, "Question the family": Who/How/Where chip groups, a live sentence ("Was it
    Uncle Desmond, with the Garden Shears, in the Attic?"), "Ask the family" and
    "Make an accusation…".
  - While answering, the matching cards appear as buttons, tagged "shown before" where it applies.
  - The question view shows the three cards plus each answerer's status (★ showed / ✕ couldn't /
    … checking).
  - After a show, the shown card flips over in 3D for the asker.
  - Accusing takes two steps: "Seal my accusation" then "Yes, I accuse".
  - Short coaching lines teach new players what to do.
- Notebook: a grid of the 18 cards by every card holder. It fills itself in from your hand, face-up
  cards, cards shown to you, passes, and revealed hands. Tap a blank cell to cycle ✓ / ✕ / ? (saved
  in localStorage). Rows that must be in the envelope turn gold; cleared rows are struck through.
- Phones:
  - A bottom "dock" appears when it's your move and the panel is scrolled off screen. It shows
    "Show Eve a card" with the cards, or "Your turn" with Ask, or End turn / Accuse.
  - Pass-the-phone: a full-screen privacy curtain ("Grandma Rose's move. Hand the device to Grandma
    Rose…" / "I'm Grandma Rose, show my cards") hides cards between players on the same device.
- Leaving:
  - "Back to the hall" opens a sheet with "Leave for now" (marks you away), "Leave this game for
    good" (confirm first), "Make them host" (pick someone) and "End the case…" (host only).
  - Banners: "You're marked away… [I'm back]", "Eve is away, so the game skips her turns…",
    "Lost touch with the manor. Reconnecting…".
- Settings popover:
  - Sound: a two-note chime made with Web Audio when it's your move or someone nudges you.
  - Follow the action: the camera moves to each question.
  - Battery saver: on by default on phones.
  - "Copy my private link": an `#me=pid.key` link that lets you continue as yourself on another
    device.
- Nudge: after you've waited 12 s for someone, a "Nudge Eve" button appears. It sends a toast,
  a chime and a vibration (only after the page has been tapped) to that player's devices.
- Game over:
  - Big reveal of the three envelope cards flipping over, with "It was …, with the …, in the …".
  - Everyone's cards laid face up.
  - "New case, same family" takes everyone to a new lobby automatically.
- Accessibility:
  - 44 px touch targets.
  - aria-live announcements for your move.
  - Visible focus.
  - prefers-reduced-motion turns off animation.
  - The board has a text caption.
  - The game still works if WebGL fails.

## 3D board (three.js r128, purely visual; the game works without it)
- The scene:
  - A round manor on a stormy night: six wedge-shaped rooms in a ring around a round
    checkerboard hall.
  - Each room has its own floor colour and pattern: greenhouse green tiles, cellar flagstones,
    attic and boathouse planks, music room red carpet, gallery parquet.
  - Each room has simple props: plant pots, wine barrels, trunks, a rowing boat on water, a piano,
    framed portraits.
  - The sealed envelope lies on a table in the middle of the hall.
- The pieces:
  - Six lathe-turned pawns in the relatives' colours: philippa #8d4b98, rupert #3a4058,
    beatrice #d67fa0, desmond #d08f2c, imogen #2f938b, hollis #e9dfc8.
  - Six floating brass medallions with the method emoji on them.
  - Each question makes the named relative and method hop into the named room.
- Detectives (seats) stand on a terrace around the outside as little figures in seat colours with
  a magnifying glass. Fennimore wears a white shirt and black tie.
  - The current player has a glowing ring.
  - A card flies from the shower to the asker.
  - A red ✕ pops over anyone who passes.
  - Someone who accused wrongly falls over.
  - At the end the envelope opens, three cards rise out of it, and there's confetti.
- Camera:
  - Drag to orbit.
  - It swings behind the current player, and flies to the questioned room or to the envelope.
- Labels and highlights:
  - Name labels as sprites that don't overlap on screen; the more important label wins.
  - Gold rings mark cards your notebook proves are in the envelope.
- Atmosphere:
  - Rain, drifting dust, and rare, soft lightning flashes.
  - Battery saver turns off shadows and rain, caps the frame rate at 30 and lets the board rest when
    nothing moves.
- Interaction:
  - Tap a piece to read its note in the caption. On your turn, tapping a piece picks it for your
    question.
  - Tapping the same spot again cycles to the piece behind.
  - A full-screen button.

## Files we'll make, in this order
1. public/rules.js
2. server.js
3. public/index.html (markup + all CSS)
4. public/app.js part A: identity, connection, state, actions, panels, notebook, dock, curtain,
   settings, events, start-up
5. public/app.js part B: the 3D board module `Stage` (load(), mount(el), sync(game, code),
   setMe, setPick, setKnow, setFollow, setSaver, setSeatHex, onPick)
6. package.json, render.yaml, README.md
Then a test script that plays 20 games through the API and checks that no device ever receives a
card it shouldn't.

Write production-quality code: complete files, no placeholders, no "// rest of code here".
```

---

## Prompt 2: rules.js

```
File 1: public/rules.js. Write the complete file.
- The 18 cards exactly as in the brief, with k = "s" | "m" | "r". CARD map by id, ALL list,
  MAX_SEATS = 6.
- Pure helpers:
  - holdersOf(g): order, plus "butler" if g.butler.
  - nextTurn(g, from): next seat not out.
  - queueFor(g, asker): seats after the asker in order, skipping those who left, then the butler.
  - actor(g): turn/asked → g.turn; asking → g.q.queue[g.q.step]; judging → g.acc.by.
  - matches(hand, cards).
  - seated(g): players sorted by joinedAt.
  - validTrio(cards): exactly [relative, method, room].
- Export with module.exports in Node and as window.HM in the browser (a UMD wrapper).
```

## Prompt 3: server.js

```
File 2: server.js. Write the complete file, following the brief exactly. It's long, so take care.
Include, in this order:
- Config from env:
  - PORT, HOST, DATA_DIR, BOT_PACE.
  - The timers: OFFLINE_ANSWER_MS 30000, IDLE_ANSWER_MS 180000, OFFLINE_TURN_MS 90000,
    IDLE_TURN_MS 300000 and HOST_GONE_MS 60000.
  - MAX_TABLES, TRUST_PROXY, RATE_MULT.
- Helpers:
  - crypto.randomInt shuffle and table codes.
  - A Refusal error class.
  - Name cleaning: strip control and bidi characters, max 16 characters.
- Devices map:
  - pid → {h: SHA-256 of the key, seen}.
  - auth() with timingSafeEqual.
  - A rate limit on new devices per IP.
- Tables map. Each table holds public fields plus `secret` = {hands, sol, shown: {n: card},
  wrong: {n: sol}, autoAway}. A runtime map holds timers and last-seen times.
- Views:
  - publicJSON(T) drops `secret`; it adds `solution` and `allHands` only when status is "over".
  - privateFor(T, pid) builds hands and dec for that device's seats. A device controls its own pid
    and every local seat whose `local` is that pid.
- Streams set of {pid, code, res, ip}. broadcast(T) debounced ~15 ms sends each viewer its own view.
  Home streams get "tables".
- Rule functions: startGame, askAs, passStep, showAs, passAs, endTurnAs, skipTurn, accuseAs,
  verdict, leaveForGood, autoShow.
- Computer detectives: deduce(g, me, hand, sharp, dec) as a constraint-propagation solver over
  card × holder (yes/no/unknown). It uses:
  - Face-up cards, its own hand, revealed hands and cards shown to it.
  - For sharp only: passes, hand sizes and "showed one of these three" constraints.
  - Category elimination: if only one card in a category can still be unplaced, it's in the
    envelope.
  Also botQuestion (sharp picks the unknown card with the most unknown holders), botTurn,
  botAfter and botAnswer.
- Scheduler:
  - stateKey(T); plan(T) returns {at, run} as described in the brief; autoStep(T) runs due moves
    or sets a timer of at most 5 s.
  - A 4 s sweep for idle tables.
  - hostCheck(T).
- OPS for every op in the brief, each validating permissions and refusing illegal moves with a
  friendly message.
- Pruning, debounced atomic save to state.json, and load on start (reschedule playing tables).
- Token-bucket rate limits.
- Static file server for /public with gzip, ETag and the security headers. GET / → index.html,
  /healthz → "ok".
- POST /api/act and POST /api/stream as in the brief; a 20 s ping; SIGTERM saves synchronously
  and exits.
Don't use any npm package.
```

## Prompt 4: index.html

```
File 3: public/index.html. Write the complete file: doctype, meta viewport with
viewport-fit=cover, title, description, an inline SVG favicon of a sealed envelope, Google Fonts
links, one <style> block with all CSS from the brief (light and dark tokens, buttons with a pressed
"depth" shadow, cards, chips, notebook table, log, dock, curtain, settings, banners, the board stage
and caption, responsive layout that becomes two columns at 960 px, and phone tweaks under 720 px),
[hidden]{display:none!important}, then the body markup:
- #home: hero stage #stageH with the title overlay and the join box (#nick, #createBtn,
  #joinForm/#joinCode, #homeMsg, a Settings link), the story, #lists (your cases), #rulesHome
  and #castHome.
- #table: a bar with "← Back to the hall", "Murder at Hollowmere", #caseNo and a settings icon
  button; then #tbl, which holds #seats, the board #stageT (with a full-screen button and
  #stageHud), #panel, #hand, a tab bar (Notebook, Case log, How to play), #nb, #log and #rulesT.
- Overlays: #dock, #curtain, #settings, #sr (aria-live), #toast.
- At the end: <script src="rules.js"></script><script src="app.js"></script>. No inline scripts.
Every interactive element uses data-act="…" so one click handler can route it.
```

## Prompt 5: app.js part A

```
File 4: public/app.js, part A: everything except the 3D board. Write complete code.
- Imports from window.HM, a state object S, and helpers: $, esc (HTML-escape every piece of user
  text), localStorage wrapper, toast, announce (aria-live), setHTML that only rewrites when the HTML
  changed.
- Identity: loadIdentity() also accepts a #me=pid.key private link. Also myLink() and
  inviteURL(code).
- api(op, data) for POSTs; move() also blocks double-clicks. connect() reads the fetch stream and
  parses SSE events, reconnects with backoff, and has a watchdog. onState/onGame/onMissing/onNudge.
- Seats: controllerOf, isBot, isLocal, mySeats; the pass-the-phone seat currently "being played"
  is S.as.
- knowledge(g) for the notebook: an auto grid plus a row state per card (held / faceup / env /
  notenv).
- Actions: create, join (open the table if no name yet), takeSeat, leaveSeat, kick, addLocalSeat,
  rematch, nudge, copy and share the invite link.
- buzz(): the title shows "● Your move", plus a chime and vibration when one of your seats needs
  you.
- Renderers that return HTML strings:
  - Home lists, seat chips, the question builder, waiting lines with Nudge.
  - The question view, the play panel for every phase, the accusation, the game-over reveal.
  - The lobby (with invite box and seat form), your hand fan, the notebook, the log lines, the
    rules, the cast.
  - The dock, the curtain, the leave sheet, the settings.
- render() calls Stage.mount/sync/setPick/setKnow.
- An ACT map for every data-act value. bind() covers clicks, forms, settings toggles, tilting cards
  on hover (desktop only), scroll and resize for the dock, a 4 s refresh and visibility reconnect.
- A healthz ping every 4 minutes so free hosts don't fall asleep mid-game.
- boot(): reads ?t=CODE or the last table, applies settings, and starts the Stage.
Leave a clearly marked spot where part B (const Stage = (()=>{…})();) goes, before the event
code that uses it.
```

## Prompt 6: app.js part B (the 3D board)

```
File 5: the Stage module that goes inside public/app.js, as described in the brief's 3D section.
Write it as `const Stage=(()=>{ ... return api; })();`.
- load() injects three.min.js (r128); if WebGL fails, add body.no3d and stop.
- Build everything procedurally:
  - Canvas textures for floor patterns, card faces and the emoji medallions.
  - Lathe-geometry pawns, coin medallions, room props, the hall checkerboard, the envelope with an
    opening flap, and terrace figures.
  - Rain, dust, a moon sprite, and hemisphere + moon + lamp + focus lights.
- sync(g, code) moves pieces into the rooms named by each "ask" in the log (animated hops), and sets
  the camera focus: overview, room, envelope or reveal. It places seat figures and replays new log
  entries: question cards fly in, ✕ marks for passes, a card flies for each show (it flips face up
  if the show was to you), and confetti on a win.
- Pointer:
  - Drag orbits.
  - Tap uses raycasting with tap-cycling.
  - Hovering on desktop highlights.
- Caption at the bottom: a hint or tapped-piece info.
- Label decluttering by screen-space overlap.
- Reduced-motion and battery-saver modes.
- Requests and rendering:
  - requestAnimationFrame only while the board is visible.
  - Battery saver caps the frame rate at 30 and slows to 2 fps when idle.
  - A ResizeObserver keeps the canvas sized.
```

## Prompt 7: deploy files

```
File 6: package.json (name murder-at-hollowmere, "start": "node server.js", engines node >=18,
no dependencies), render.yaml for one free Render web service (runtime node, plan free,
buildCommand npm install, startCommand npm start, healthCheckPath /healthz, NODE_VERSION 22),
a small Dockerfile (node:22-alpine, writable /data volume, non-root user), .gitignore (data/),
and a README.md with: what it is, how to put it online free on Render via GitHub step by step, how
to run it locally, the environment variables table, and how the fairness works.
Then write test.mjs: start the server on a spare port with fast timers, create 20 tables mixing
people (scripted API clients) and computer detectives, play them to the end, and assert:
- No view ever contains another seat's hand, the solution before the end, or a show entry's card
  unless the viewer was part of that show.
- Every card is accounted for exactly once at the end.
- Nobody passed while holding an asked card.
- Bad moves are refused.
- A player whose page closes gets answered for and skipped.
- The game survives a server restart.
```

## Prompt 8: when something breaks (use as often as needed)

```
Here's what happened when I ran it: [paste the error from the terminal or the browser console, or
describe what you saw]. Find the cause, then give me the corrected code. If the fix is small, show
only the changed function(s) and say exactly where they go. If it touches many places, give me the
whole file again.
Before answering, check these too: the stream reconnects after the server restarts; a phone can
join from the invite link; the curtain hides cards on a pass-the-phone seat; no card data leaks into
another device's view; the page works with no WebGL.
```

## Prompt 9: putting it online

```
It works on my computer. Walk me through publishing it so anyone can open it in a browser, with
no credit card: create a public GitHub repository, upload the files through the GitHub website
(no command line), then deploy on Render with render.yaml using
https://render.com/deploy?repo=<my repo URL>. Explain what Render's free plan means for this game
(it sleeps after 15 minutes without visitors and clears unfinished tables), and how I can check
it's working (open /healthz, then play from my phone and my computer at the same time).
```

---

## Prompt 10: work from the finished code (Way 2)

Upload `murder-at-hollowmere.zip`, then paste:

```
I've attached my finished multiplayer web game, "Murder at Hollowmere". Unzip it and read
README.md, server.js, public/rules.js, public/index.html and public/app.js (the page is built from
src/ by build.py; edit src/ and rebuild, or edit public/ directly if I say so).
It's a Node server with no dependencies that deals the cards, keeps the envelope secret, runs the
computer detectives, and streams each device only its own view over server-sent events.
First, give me a short tour: how a move travels from a phone to the server and back, how the
server keeps cards secret, and what each file does.
Then help me with: [what you want — e.g. "add a 7th relative", "change the colours to a Christmas
theme", "explain the computer detectives' logic", "deploy it to Render step by step"].
When you change code, give me complete updated files I can download, and keep the rules,
fairness and tests working.
```
