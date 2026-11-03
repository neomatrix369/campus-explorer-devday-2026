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

## Execution Lifecycle

This is the exact execution path for the full pet handoff:

1. Start the web app with `npm run dev`.
2. Start the native pet with `CAMPUS_URL` pointing at the web app.
3. The native pet launches as `DesktopPet` and loads the default upstream `esheep64` animation.
4. The native pet polls `GET /api/pet/mode` with the `X-DesktopPet` headers.
5. The web app records the latest desktop-pet poll time.
6. The user clicks `Call Woolly`, or chooses `Call Woolly here` from the desktop pet menu.
7. The web app uses `POST /api/pet/summon` to publish a short-lived summon id.
8. The desktop pet sees that summon id on its next poll and moves to the centre of the current display.
9. The user chooses `Lead CampusExplorer tour` from the desktop pet menu.
10. The desktop pet posts `tour` to `POST /api/pet/mode`.
11. The desktop pet opens the web app with `?sheepTour=1`.
12. The browser starts the 3D pet tour and keeps posting `tour` while the tour is active.
13. The native desktop pet hides while 3D Woolly leads the tour inside the CampusExplorer scene.
14. When the browser tour exits, closes, or times out, the web app posts `desktop`.
15. The native desktop pet sees `desktop` on its next poll and returns to the desktop.

The `tour` mode lease is intentionally short. The browser refreshes it while the tour is active, so a closed tab or crashed browser returns the native pet to desktop mode instead of leaving it hidden.

Execution entry points:

| Entry point | Command or action | Result |
|---|---|---|
| Web app | `npm run dev` | Starts `server.ts` and Vite middleware. |
| Native debug pet | `CAMPUS_URL=http://127.0.0.1:3100 swift run` | Builds and runs `DesktopPet` from `native-pet/.build/`. |
| Native app bundle | `./build-app.sh && open DesktopPet.app` | Builds and opens a local `.app`. |
| Browser-only tour | Click `Follow Woolly` | Runs 3D Woolly without the native desktop pet. |
| Full handoff | Menu-bar or pet menu `Lead CampusExplorer tour` | Desktop pet enters the browser scene and returns after exit. |

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

Right-click the pet and choose **About Pet Wolly…** to see its creator, hackathon origin,
creation date and place, local bridge address, privacy boundary, version and upstream
desktop-pet attribution. The dialog also includes Woolly's short history and clickable
links to the project, creator GitHub profile (`@neomatrix369`), creator site, and upstream
desktop-pet sources.

The same menu includes **Reload Pet Wolly**. It starts the current built app again and then
closes the previous copy, which is useful after you have installed or built an update. It does
not pull source changes or compile a new app; run `./build-app.sh` first when working from this
repository.

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

## Start Pet Wolly at Login (macOS)

The repository includes an opt-in macOS `launchd` setup. It starts two user-level
LaunchAgents after you sign in:

1. `org.petwolly.web` keeps the local web bridge running at `http://127.0.0.1:3100`.
2. `org.petwolly.desktop` waits briefly for that bridge, then starts the built
   `DesktopPet.app` with the matching `CAMPUS_URL`.

They are user agents, not system daemons: Woolly needs access to your signed-in
desktop. They do not depend on Codex, an IDE, or a browser being open.

From the repository root, install and start them now:

```bash
npm run woolly:install-login
```

The installer builds `native-pet/DesktopPet.app` if it does not already exist,
writes the two plists under `~/Library/LaunchAgents/`, and stores logs under
`~/Library/Logs/PetWolly/`. To check the loaded agents:

```bash
npm run woolly:login-status
tail -f ~/Library/Logs/PetWolly/web-error.log
```

To stop automatic startup and unload both agents:

```bash
npm run woolly:uninstall-login
```

The web LaunchAgent restarts the bridge if it exits. The desktop agent starts once
per login; quit Woolly from its menu-bar paw icon as usual.

## Future Login Startup: Windows and Linux

The browser bridge is portable because it is a local Node.js process. The current
desktop pet is **macOS-only**: it is a Swift/AppKit application, so these sections
are a design target, not an installation guide or a claim of current support.

All future platforms should preserve the same bridge contract:

- Start the web bridge before the native pet, on a loopback-only URL such as
  `http://127.0.0.1:3100`.
- Pass that URL to the native pet through `CAMPUS_URL` (or the platform-equivalent
  configuration setting).
- Keep the existing `GET /api/pet/mode`, `POST /api/pet/mode`, and
  `POST /api/pet/summon` endpoints unchanged.
- Use a per-user login mechanism, not a system-wide background service: the pet
  needs the signed-in user's desktop session.

### Windows target

Use two **Task Scheduler** tasks triggered *At log on* for the current user:

1. A bridge task starts the Node.js server and restarts it on failure.
2. A pet task starts a future signed Windows Pet Wolly executable after the bridge
   is reachable, configured with `CAMPUS_URL=http://127.0.0.1:3100`.

The implementation should avoid a Windows Service because services do not safely
own an interactive desktop window. It should use absolute paths to Node.js and the
installed pet executable, write logs under `%LOCALAPPDATA%\\PetWolly\\logs`, and
provide install, status and uninstall commands. The web bridge can be run on
Windows today; the native animated pet requires a Windows implementation first.

### Linux target

Use two **systemd user services** enabled with `systemctl --user enable --now`:

1. `pet-wolly-web.service` runs the Node.js bridge and uses `Restart=on-failure`.
2. `pet-wolly-desktop.service` starts a future Linux desktop-pet executable after
   the bridge is reachable, with the same `CAMPUS_URL` value.

Do not use a system-level unit: the pet needs a graphical user session. The desktop
service must also support the active display stack (Wayland or X11), while logs
should go to the user journal and/or `~/.local/state/pet-wolly/`. The web bridge can
run on Linux today; a native Linux pet must be built and validated before startup
automation is shipped.

### Delivery checklist for either platform

1. Build a native pet that can show a transparent, click-through desktop window.
2. Verify the local bridge handoff, summon, tour and return-to-desktop lifecycle.
3. Package the executable with a trusted signing/distribution path for that OS.
4. Add a user-session startup installer, status command, logs and clean uninstall.
5. Test fresh login, bridge restart, pet exit, offline first-run behaviour and
   browser-only fallback.

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
