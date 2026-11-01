# CampusExplorer 3D FX

Find a quiet study space on a navigable, schematic 3D map of UCL, King's, Imperial and LSE.

## What it does

Switch between seven London campuses, preview a time of day, compare estimated study floors, inspect a building, and ask for a recommendation. A guided tour, optional soundscape, photo capture and contact sheet, PDF and GeoJSON exports, and a local map lab support exploration. The light interface was informed by user-supplied FindUCL screenshots; see [credits](docs/CREDITS.md).

The geometry, occupancy, noise, amenities and access hours are **demo estimates**, never live campus data or a confirmed booking. Each campus links to its official university map so students can verify details before travelling.

## Run it

Use Node 22.

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). If port 3000 is in use, run `PORT=3001 npm run dev` and open port 3001. The app works without an API key. Optionally copy `.env.example` to `.env` and set `AI_API_KEY` and `AI_MODEL` for model-written recommendations and neural tour speech. Set `AI_INPUT_USD_PER_M` and `AI_OUTPUT_USD_PER_M` to show a cost estimate from returned token usage; without rates the app labels model cost as unpriced. Keys stay on the server.

```bash
npm test
npm run lint
npm run build
```

## Use it

**Core journey:** choose UCL Bloomsbury, ask for “quiet seat with charging and water”, inspect the suggested floor in 3D, then open the official campus map to verify details before travelling. Drag to rotate, scroll to zoom, or move the time slider to compare estimates. The Map lab also accepts GeoJSON polygons, building JSON, or a written description for an illustrative three-floor building. Imports stay in browser memory for the session.

## Learn more

- [Combined AI Studio prompt](AI_STUDIO_PROMPT.md)
- [Architecture and data limits](docs/ARCHITECTURE_AND_USER_GUIDE.md)
- [Asset and code credits](docs/CREDITS.md)
- [Under-90-second demo storyboard](demo-video/storyboard.json)
- Official maps: [UCL](https://maps.ucl.ac.uk/downloads/), [King's Strand](https://www.kcl.ac.uk/assets/pdf24/strand-campus-map-2025.pdf), [Imperial](https://www.imperial.ac.uk/study/visit/undergraduate/open-days/campus-map/), [LSE](https://www.lse.ac.uk/lse-information/campus-map)

Built with Codex at the DevDay Exchange London Community Hackathon on 1 November 2026. One concrete Codex contribution: it implemented the floor-ranking fallback and the schematic PDF/GeoJSON export path, then verified them with nine logic tests and browser journeys at 1280 px and 390 px. See `src/utils/campusLogic.ts`, `src/utils/mapExports.ts`, and `scripts/ui-qa.mjs`.
