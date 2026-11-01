# Architecture and data limits

## How the app works

The React client holds the selected campus, time, floor and effect settings in memory. `src/data/campusData.ts` owns seven campus profiles and 27 named buildings. `src/utils/campusLogic.ts` owns all time-based occupancy estimates and study ranking. The Three.js scene renders this data directly and rebuilds only when the campus changes. It keeps the camera interactive through OrbitControls.

```mermaid
flowchart LR
  student[Student] -->|1. chooses time and preferences| app[React interface]
  app -->|2. ranks floors| logic[Local study logic]
  logic -->|3. selects building and floor| scene[Three.js map]
  app -->|4. optional explanation| server[Node API]
  server -->|5. optional request| model[OpenAI API]
  server -->|6. fallback| logic
```

The local path is the baseline. `POST /api/ai/concierge` accepts a query, campus ID and hour. Without `AI_API_KEY`, it returns the local recommendation. With a key, the server sends only a short list of candidate floors and accepts a structured answer only when its building and floor match that list. Provider failures return the local result. The finder shows query count and model tokens; cost is estimated only when rates are configured. `POST /api/ai/tts` serves only the six known, pre-generated ElevenLabs tour clips; arbitrary input cannot trigger paid generation. The client plays the same bundled MP3s directly, falling back to browser speech. `scripts/generate-audio.ts` is an explicit offline generation step using the server-side ElevenLabs key. The key never reaches the browser.

## What the map means

The bundled buildings are simplified boxes and landmark shapes placed in a stylized campus grid. They are **not** surveyed footprints or a navigable walking route. GeoJSON imports extrude uploaded polygons. Original GeoJSON rings (including holes) and properties are retained separately from the display transform, and exported without relocation. Imported geometry without study data is excluded from ranking. A written description generates three illustrative floors; neither path verifies floor uses, heights or opening hours. The PDF and GeoJSON exports are labelled schematic for the same reason.

The time slider applies a deterministic daily curve to each floor's authored baseline. Free seats are the estimated occupancy percentage applied to the floor capacity. Noise is adjusted from occupancy and study type. No university occupancy feed, microphone reading or student report is connected. Check each university map and booking page before travelling.

## Map sources

The university links in the interface are verified official pages, used for names and campus context:

- [UCL Bloomsbury and UCL East maps](https://maps.ucl.ac.uk/downloads/)
- [King's Strand campus PDF](https://www.kcl.ac.uk/assets/pdf24/strand-campus-map-2025.pdf)
- [Imperial campus map](https://www.imperial.ac.uk/study/visit/undergraduate/open-days/campus-map/) and [White City information](https://www.imperial.ac.uk/white-city-campus/find-us/)
- [LSE campus map and building guide](https://www.lse.ac.uk/lse-information/campus-map)

## Controls and fallback

The scene supports rotate, zoom, building selection and reset. Heatmap colours show occupancy bands, and flow points show an illustrative animation. The time slider controls day, dusk and night lighting. Tour narration, generated sound and optional AI calls start only after user actions. The guided tour has pause, resume, previous, next, replay, voice toggle and exit. Escape closes the floor explorer and tool drawer. The floor dialog traps keyboard focus and restores it on close. H hides or shows panels. Camera transitions and decorative movement respect reduced motion. Sound off also stops confirmation cues.

For a reliable demo, no external map tile service, Google Maps key, database or AI key is required. Imported buildings and captured photos remain in the current browser session; reloading clears them. Photo studio can download individual captures or combine them into a contact sheet.

## Shared owners and remaining limits

- `campusLogic.ts`: query parsing, duration/access constraints, estimates and ranking. The model receives only eligible candidates. Campus/time changes abort pending answers.
- `campusData.ts`: campus profiles and approximate geographic anchors, shared by the London overview and exports.
- `floorLayout.ts`: illustrative furnishings shared by the rotatable Three.js cutaway and SVG plan. These are not architectural interior surveys.
- `data/audio.ts`: audio asset paths and sound prompts; `public/audio/manifest.json` records generation provenance. Playback does not expose the ElevenLabs key.

Compared with the original broad briefs and the app on localhost:3000, this submission still has a schematic 2D London overview rather than a unified geographic 3D city; no satellite tiles, terrain/tide simulation, microphone assistant, PDF/image/CAD ingestion, live occupancy or real reservations. Its UI never claims those unavailable capabilities. The light theme follows the supplied FindUCL references.
