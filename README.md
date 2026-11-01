# CampusExplorer 3D FX

Find a quiet study space on a navigable, schematic 3D map of UCL, King's, Imperial and LSE.

[Watch the 70.9-second demo](https://github.com/neomatrix369/campus-explorer-devday-2026/releases/download/v0.1.0/CampusExplorer-DevDay-demo.mp4) · [View the release](https://github.com/neomatrix369/campus-explorer-devday-2026/releases/tag/v0.1.0)

## What it does

Switch between seven London campuses, preview a time of day, compare estimated study floors, inspect a building, and ask for a recommendation. A guided tour, optional soundscape, photo capture and contact sheet, PDF and GeoJSON exports, and a local map lab support exploration. The light interface follows the [supplied FindUCL reference](design/mockup.png).

The geometry, occupancy, noise, amenities and access hours are **demo estimates**, never live campus data or a confirmed booking. Each campus links to its official university map so students can verify details before travelling.

## Run it

Use Node 22.

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). If port 3000 is in use, run `PORT=3001 npm run dev` and open port 3001. The app works without an API key. Optionally copy `.env.example` to `.env` and set `AI_API_KEY` and `AI_MODEL` for model-written recommendations. Set `AI_INPUT_USD_PER_M` and `AI_OUTPUT_USD_PER_M` to show a cost estimate from returned token usage; without rates the app labels model cost as unpriced. Keys stay on the server. Tour narration and soundscapes use bundled ElevenLabs audio; replay needs no API key and spends no credits.

```bash
npm test
npm run lint
npm run build
```

### Regenerate audio (optional)

Set `ELEVENLABS_API_KEY` in your local environment, then run:

```bash
node --import tsx scripts/generate-audio.ts
```

This spends ElevenLabs credits to generate six tour narrations and three short sound assets. Unchanged clips are reused using content fingerprints in `public/audio/manifest.json`. The default narrator is George (British); override `ELEVENLABS_VOICE_ID` and `ELEVENLABS_MODEL_ID` if desired. The public app never calls a paid speech API. Missing audio falls back to browser speech or synthesized ambience.

## Use it

**Core journey:** choose UCL Bloomsbury, ask for “quiet seat with charging and water”, inspect the suggested floor in 3D, then open the official campus map to verify details before travelling. Drag to rotate, scroll to zoom, or move the time slider to compare estimates. Requests retain group size, charging, water, start time and session duration; an impossible request returns “No exact match”. Quiet requests include silent floors. Assumed opening hours must cover the full session, but seats are never guaranteed. The Map lab also accepts GeoJSON polygons, building JSON, or a written description for an illustrative three-floor building. Imports stay in browser memory for the session. GeoJSON export preserves imported polygons, courtyard holes and source properties. Imported footprints without study data are excluded from the finder.

**Explore:** London opens a seven-campus overview. View provides day/dusk/night, trees, surrounding buildings and tour replay controls. Aerial and Street change the camera; Hide panels (or H) clears the view. Floor explorer provides a rotatable furnished cutaway and a matching illustrative 2D plan. Photos captures the view and a day/dusk/night sequence.

### Woolly: desktop to 3D and back

On macOS 12 or newer, start the web app, then run the desktop pet in a second terminal:

```bash
cd native-pet
swift run
```

The sheep downloads its animation from the credited upstream catalog on first launch. It starts at 2× size (80 points for the default sheep); use the menu-bar **Size** menu to choose 1×–4×. Right-click the sheep or use its menu-bar paw icon and choose **Lead CampusExplorer tour**. It leaves the desktop, visibly hops into the 3D scene, and leads the six-stop tour. Exiting shows Woolly walking out before the desktop pet returns. During the tour, **Woolly's quiet pick** finds a study floor and **Surprise me** jumps to another stop. Choose **Exit tour** to bring it back. The menu-bar **Return to desktop** item also restores it. **Find a quiet study spot** in the pet menu opens a recommended place directly. **Hear Woolly sing** plays a short tune from the pet menu or the tour banner. Starting the tour turns on gentle music; use **Lo-fi/Rain/Sound off** to control it. Tour voice is separate and has its own mute button. If the web app runs on another port, use `CAMPUS_URL=http://127.0.0.1:3001 swift run`, replacing 3001 with that port. In a browser without the native app, **🐑 Follow Woolly** runs the same tour.

[Watch the sheep-led 3D tour](demo/woolly-3d-tour.mp4). The clip shows the browser half of the handoff; the native desktop pet runs locally on macOS.

This build uses a local loopback bridge between the two apps. It does not claim direct OpenAI Dot or Pet account integration; no supported API for Dot activity subscriptions or pet embedding was confirmed for this build.

## Learn more

- [Combined AI Studio prompt](AI_STUDIO_PROMPT.md)
- [Architecture and data limits](docs/ARCHITECTURE_AND_USER_GUIDE.md)
- [Asset and code credits](docs/CREDITS.md)
- [Under-90-second demo storyboard](demo-video/storyboard.json)
- Official maps: [UCL](https://maps.ucl.ac.uk/downloads/), [King's Strand](https://www.kcl.ac.uk/assets/pdf24/strand-campus-map-2025.pdf), [Imperial](https://www.imperial.ac.uk/study/visit/undergraduate/open-days/campus-map/), [LSE](https://www.lse.ac.uk/lse-information/campus-map)

Built with Codex at the DevDay Exchange London Community Hackathon on 1 November 2026. One concrete Codex contribution: it implemented the floor-ranking fallback and the schematic PDF/GeoJSON export path, then verified them with sixteen logic tests and browser journeys at 1280 px and 390 px. See `src/utils/campusLogic.ts`, `src/utils/mapExports.ts`, and `scripts/ui-qa.mjs`.
