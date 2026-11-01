# Turn stability QA — Render v1.4.1

These checks apply to the live Node/Render edition (not the separate Netlify function edition).

## Expected results

1. Start a **new** private room with two real devices. Set **No timer**. Start a match. When both players have finished or skipped the opening cinematic, leave the first human's turn untouched for several minutes. The displayed turn must **not** advance on its own.
2. Ask a question and answer or pass using the second player. Only after the first detective clicks **End my turn** should the turn pass to the next eligible detective.
3. Start another room with **30-second turns**. After the opening, do not act. The timer may pass the turn **once**, clearly marking the event as a timer expiration. The next turn receives its own fresh timer.
4. On an untimed room, switch both players to the hall, close both pages or mark both Away. The log must stop accumulating skipped turns. When someone returns, the investigation resumes at the same turn.
5. Mark one detective Away while the other detective remains connected. Their turn may be passed after a measured delay, but the active player's turn must wait for that player to act.
6. Disconnect one detective while keeping the other connected. The disconnected detective's turn may be passed after the reconnect grace period, but they must not be permanently auto-marked Away.
7. Refresh the active player during their own turn; their private hand and turn should stay intact. Refresh on mobile and desktop separately.
8. In the activity log, automatically skipped turns should say whether a timer expired, a detective was offline, or a detective was explicitly Away.
9. Confirm the cinematic and 3D board continue to work.

## Release note

- Automated tests: **27 passed** for v1.4.1 in a controlled local environment.
- Full physical-device testing of the updated Render deployment remains a separate verification step.
- Render free plans may restart or discard local state. This fix prevents stale saved clock values from triggering a skip cascade, but it does not solve persistent-database availability.
