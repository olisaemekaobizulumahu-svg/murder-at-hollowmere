# Detective portrait integration v1.4.2

Eight original AI-created portraits are bundled in `public/assets/detectives/*.webp`. These were derived from original game-art compositions generated for this project, not linked from a third-party image site. The earlier concept previews in ChatGPT were not actual downloadable assets, so these are visually consistent replacements rather than identical copies.

- Home: eight-card detective roster now contains local image portraits.
- Lobby: every seated player has a portrait thumbnail; players can choose from a visual eight-portrait picker or the accessible dropdown.
- Playing: current player's chosen portrait is displayed next to their detective name.
- End: correct winner's chosen detective portrait is shown in the result.
- 3D pieces remain stylized game tokens; this release does not include animated humanoid 3D character meshes.

## Manual browser checks

1. Open homepage on phone and desktop; verify all eight distinct portraits load without CORS requests.
2. Create a room; click a portrait and confirm the server updates the character and the selected border.
3. Join from a second device; verify lobby portraits update for both and game rules remain unchanged.
4. Start a game and confirm your selected portrait appears near the investigation panel.
5. Complete a game and verify winner's chosen detective portrait appears in final results.
6. Confirm HTML remains scrollable at 390px width and tabs/controls are keyboard accessible.

The portrait images are original AI-generated illustrations, **not identical** to the temporary reference images previously shown in chat.
