# Pet Wolly Setup and Operations

This guide explains how to reproduce the Codex-created Pet Wolly demo from a fresh checkout, how the desktop pet and browser scene talk to each other, and how to cleanly stop, reset, tweak, and maintain it.

## What Runs

Pet Wolly has two processes:

1. Web app: the React/Three.js CampusExplorer app served by `server.ts`.
2. Desktop pet: the macOS Swift app in `native-pet/`, run as `DesktopPet`.

The two pieces communicate over localhost:

- The desktop pet polls `GET /api/pet/mode`.
- The web app posts `tour` or `desktop` to `POST /api/pet/mode`.
- The web app posts `POST /api/pet/summon` when the user clicks `Call Woolly`.
- The desktop pet opens the web app with query params such as `?sheepTour=1`.

The bridge is local-only. It is not an OpenAI Dot or OpenAI Pet account integration.

## Current Local State

During development on this Mac, the live `http://localhost:3100` process was still running from the older workspace:

```text
/Users/swami/Documents/ChatGPT/odd hackathon london 2026
```

The renamed, reproducible repo is:

```text
/Users/swami/git-repos/ai-ml-dl-stuff/hackathons/odd-hackathon-london-2026/pet-wolly
```

For future work, run from `pet-wolly` so the documented repo and the live process match.

## Requirements

- macOS 12 or newer for the desktop pet.
- Node.js 22.
- Xcode command line tools:

```bash
xcode-select --install
```

Optional:

- OpenAI API key for model-written study recommendations.
- ElevenLabs API key only when regenerating bundled audio.
- Pillow only when building the native `.app` icon:

```bash
pip3 install pillow
```

## Fresh Setup

From the repo root:

```bash
cd "/Users/swami/git-repos/ai-ml-dl-stuff/hackathons/odd-hackathon-london-2026/pet-wolly"
npm install
```

Optional environment setup:

```bash
cp .env.example .env
```

The app works without `.env`. Add keys only when you need optional model or audio generation.

## Run the Web App

Terminal 1:

```bash
cd "/Users/swami/git-repos/ai-ml-dl-stuff/hackathons/odd-hackathon-london-2026/pet-wolly"
npm run dev
```

Open:

```text
http://localhost:3000
```

If port 3000 is already in use:

```bash
PORT=3100 npm run dev
```

Open:

```text
http://localhost:3100
```

Check the local bridge:

```bash
curl http://localhost:3100/api/pet/mode
```

Expected shape:

```json
{"mode":"desktop","bridgeEpoch":"...","summonId":0}
```

## Run the Desktop Pet

Terminal 2:

```bash
cd "/Users/swami/git-repos/ai-ml-dl-stuff/hackathons/odd-hackathon-london-2026/pet-wolly/native-pet"
CAMPUS_URL=http://127.0.0.1:3100 swift run
```

Use `CAMPUS_URL=http://127.0.0.1:3000` if the web app is on port 3000.

The desktop pet appears as a menu-bar app and a floating pet window. It downloads the eSheep animation on first launch and caches it locally.

## Reproduce the Demo Journey

1. Start the web app.
2. Start the desktop pet with `CAMPUS_URL` pointing at the web app.
3. Open the web app in the browser.
4. Click `Call Woolly` to confirm the desktop pet is polling.
5. From the pet menu, choose `Lead CampusExplorer tour`.
6. Watch Woolly enter the browser scene, lead the 3D tour, then return to the desktop.

Browser-only fallback:

1. Start the web app.
2. Click `Follow Woolly`.
3. Woolly leads the 3D tour inside the browser without the native desktop pet.

## Build the Native App

From `native-pet/`:

```bash
./build-app.sh
open DesktopPet.app
```

This creates:

```text
native-pet/DesktopPet.app
```

The debug command `swift run` does not install a permanent app. It builds under:

```text
native-pet/.build/
```

## Configuration Reference

| Setting | Where | Purpose | Required |
|---|---|---|---|
| `PORT` | `.env` or shell | Web server port. Defaults to `3000`. | No |
| `AI_API_KEY` | `.env` or shell | Enables OpenAI model-written study recommendation text. | No |
| `AI_MODEL` | `.env` or shell | Model name for recommendation text. Defaults to `gpt-4.1-mini`. | No |
| `AI_INPUT_USD_PER_M` | `.env` or shell | Input token price used only for displayed estimate. | No |
| `AI_OUTPUT_USD_PER_M` | `.env` or shell | Output token price used only for displayed estimate. | No |
| `ELEVENLABS_API_KEY` | `.env` or shell | Used only by `scripts/generate-audio.ts`. | No |
| `ELEVENLABS_VOICE_ID` | `.env` or shell | Voice used when regenerating tour narration. | No |
| `ELEVENLABS_MODEL_ID` | `.env` or shell | ElevenLabs model used when regenerating tour narration. | No |
| `CAMPUS_URL` | shell before `swift run` | Tells the desktop pet which web app URL to control. Defaults to `http://127.0.0.1:3000`. | No |
| Desktop pet size | menu bar `Size` menu | Sets native pet scale from 1x to 4x. Stored in macOS `UserDefaults`. | No |

Never commit `.env` or real API keys.

## Important Local Files

Generated or local-only:

```text
node_modules/
dist/
native-pet/.build/
native-pet/DesktopPet.app
```

Desktop pet caches:

```text
~/Library/Application Support/DesktopPet/Pets/
~/Library/Caches/DesktopPet/
~/Library/HTTPStorages/DesktopPet/
```

The default sheep assets are cached under:

```text
~/Library/Application Support/DesktopPet/Pets/esheep64/
```

## Stop It

Stop the web app with `Ctrl-C` in the terminal running `npm run dev`.

Quit the desktop pet from the menu-bar paw icon using `Quit`.

If you need to identify the web server:

```bash
lsof -nP -iTCP:3000 -iTCP:3100 -sTCP:LISTEN
```

## Uninstall or Reset

Remove local web dependencies and builds:

```bash
rm -rf node_modules dist
```

Remove native debug/release builds:

```bash
rm -rf native-pet/.build native-pet/DesktopPet.app
```

Reset downloaded desktop pets:

```bash
rm -rf "$HOME/Library/Application Support/DesktopPet/Pets"
```

Reset DesktopPet HTTP/cache files:

```bash
rm -rf "$HOME/Library/Caches/DesktopPet" "$HOME/Library/HTTPStorages/DesktopPet"
```

After removing cached pets, the first desktop pet launch needs internet access to download `esheep64` again.

## Tweak Wolly

3D Wolly:

- Appearance, fleece, horns, legs, scale, camera follow and scene behaviour: `src/components/CampusScene3D.tsx`
- Pathfinding and building avoidance: `src/utils/petRoute.ts`
- Tour copy and stops: `src/data/tour.ts`
- Audio paths and prompts: `src/data/audio.ts`
- Browser controls and pet phase state: `src/App.tsx`

Desktop Wolly:

- App entry, bridge polling, menu actions and `CAMPUS_URL`: `native-pet/Sources/DesktopPet/App.swift`
- Floating transparent pet window and native animation state: `native-pet/Sources/DesktopPet/PetWindow.swift`
- Desktop pet model: `native-pet/Sources/DesktopPet/PetModel.swift`
- eSheep XML parsing and sprite loading: `native-pet/Sources/DesktopPet/PetXML.swift`, `native-pet/Sources/DesktopPet/PetResources.swift`
- Speech bubble: `native-pet/Sources/DesktopPet/PetSpeechBubble.swift`

## Verification

Run web checks:

```bash
npm test
npm run lint
npm run build
```

Run the route tests directly:

```bash
node --import tsx --test src/utils/campusLogic.test.ts src/utils/petRoute.test.ts
```

Run native build check:

```bash
cd native-pet
swift build
```

Manual smoke test:

1. Start web app.
2. Start native pet with matching `CAMPUS_URL`.
3. Confirm `Call Woolly` works.
4. Start `Lead CampusExplorer tour`.
5. Confirm desktop pet hides while 3D Woolly leads the tour.
6. Exit tour and confirm the desktop pet returns.

## Maintenance Notes

- Keep setup changes in this file and the short README entry in sync.
- Keep credits in `docs/CREDITS.md` whenever asset, audio or upstream code usage changes.
- Keep source ownership in `docs/WOOLLY_CODE_MAP.md` when files move.
- Do not bundle downloaded upstream pet sprites into this repo unless their license and attribution are explicitly reviewed.
- Do not expose OpenAI or ElevenLabs keys to the browser. Server-side `.env` only.
