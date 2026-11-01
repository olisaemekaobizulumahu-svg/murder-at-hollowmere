# Mandatory physical-device and deployment QA checklist

**Not yet executed on physical devices.** Fill a fresh copy for each tested model. Never mark an item passed based on a desktop emulator or screenshot alone.

Tester/date: __________  Device model/OS: __________  Browser/version: __________  Network: Wi-Fi / cellular / hotspot  Hosted HTTPS URL: __________

| Functional check | Pass / Fail / Blocked | Recording, screenshot or issue |
|---|---|---|
| Landing home loads; create/join works; no clipped controls or horizontal scroll | | |
| 3D board actually renders, zooms/touches correctly; no overheating or unreasonable battery drain | | |
| Cinematic intro starts, progresses, skips, and narration respects sound/permission/accessibility | | |
| One full original case on two separate physical devices | | |
| All four story case selections show correct distinct card names/notes/intro | | |
| Eight devices can join, ninth seat rejected | | |
| Server timer skips an expired turn; pauses correctly for answers | | |
| Reconnect, app background/foreground and Wi-Fi-to-cellular transitions preserve player privacy | | |
| Private hand/score/hints unseen by other detectives or spectators | | |
| Spectator predictions remain hidden and score only after final reveal | | |
| Public/private/spectator chat separation and reporting/muting | | |
| Voice: iOS Safari → Android Chrome, microphone permission, speaker, mute, end, ICE reconnect | | |
| Usernames/passwords function on HTTPS; session re-login; failed-login rate limits | | |
| Friends, invitations, casual matching and two registered users in ranked lobby | | |
| XP/achievements/tournament points persist after planned server restart | | |
| Community draft creation → review → approved selection | | |
| Correct and incorrect accusations; no secret reveal until game end | | |
| Portrait/landscape rotation, large text, screen reader, reduced motion, keyboard navigation | | |
| Moderation logs and account storage are private; no secrets in browser response | | |

For network tests, run on **different networks**, not just two tabs in the same browser. Store bug reproduction steps, severity, expected and actual behaviour. A safe public launch requires independent security and performance review.
