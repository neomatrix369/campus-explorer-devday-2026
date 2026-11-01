# CampusExplorer 3D FX · combined AI Studio prompt

Build a functional, self-contained web app for students who want to find a quiet, available place to study before walking there. The app covers University College London, King's College London, Imperial College London and the London School of Economics. Start with a working local demo that needs no API key, then enable optional AI and map ingestion when credentials or files are supplied.

## Source and truth rules

Use these official map resources for names and location context:

- UCL Bloomsbury and UCL East: https://maps.ucl.ac.uk/downloads/
- King's Strand campus: https://www.kcl.ac.uk/assets/pdf24/strand-campus-map-2025.pdf
- Imperial South Kensington and White City: https://www.imperial.ac.uk/study/visit/undergraduate/open-days/campus-map/ and https://www.imperial.ac.uk/white-city-campus/find-us/
- LSE campus map and building guide: https://www.lse.ac.uk/lse-information/campus-map

Accept uploaded vector maps or GeoJSON when present. Extract names, footprints and floors only when supported by the file. If a map is inaccessible, show a schematic approximation and link to the official source. Never present generated geometry, noise, occupancy, opening hours, booking, or amenities as verified. Label simulated values in the UI and explain the estimate method. Do not imply a seat reservation occurred unless an official booking system confirms it.

## Experience

Match the supplied FindUCL screenshots: light shell, white floating panels, violet controls, pastel stone buildings, sage green roofs and parks, warm amber for busy places, and a large navigable 3D city view. Use a four-university selector and campus switcher. Provide a searchable building list and a one-click quiet spot finder. A time slider lets a student preview a different hour, with clear occupancy and noise estimates. A building inspector shows floor-by-floor quietness, free seats, amenities, access guidance and a simple 2D floor plan. Keep the 3D map usable beneath the panels on desktop and mobile.

Render the campus with plain Three.js and OrbitControls. Include recognizable, stylized landmarks, paths, trees, selection halos, useful labels, camera focus and a day/dusk/night cycle. Add optional occupancy coloring, student-flow particles and a soft atmosphere without obscuring the map. Make every effect switchable and respect reduced-motion preferences. Only start sound after a user action. Use the existing ElevenLabs subscription to generate reusable tour narration, ambience and confirmation sounds. Bundle generated audio and retain provenance; do not expose keys or trigger paid generation on every replay. Keep browser/synthesized fallbacks and make mute stop all soundscape cues.

## Finding a place

Rank floor-level study spaces by quietness, estimated seats free, access at the selected hour, amenities and walking proximity. Let a student type requests such as “quiet for two hours with a socket” or “group of four near the library”. Give one concise recommendation, say why it fits, highlight the building in 3D and select the floor. Preserve charging, water, group size and study-style requirements. Parse session duration separately from people and honour explicit start times. Require assumed opening hours to cover the entire session. Return a clear no-exact-match answer rather than silently dropping constraints. Cancel stale answers when campus or time changes. With no API key, parse common intents and use deterministic local ranking. If an API key exists, a server endpoint may improve the explanation; it must choose only a building and floor supplied by the app. Keep credentials server-side and return the local result on provider failure.

## Tours, media and exports

Add Play, Pause, Next and Replay for a short guided tour across all four universities. Use bundled ElevenLabs narration, with browser speech if an audio asset is unavailable. Include a seven-campus London overview, day/dusk/night presets, aerial/street camera views, layer toggles and a hide-panels control. Render a furnished rotatable floor cutaway and a matching 2D plan from the same illustrative layout. Provide a camera photo capture, a vector PDF campus summary and a GeoJSON download of the schematic layout. Give students the official map and booking links for verification. An optional map lab can turn a valid vector building description into a new, clearly marked schematic building.

Provide a photo contact sheet and per-query AI usage telemetry. Show zero model tokens and zero AI cost for local recommendations. When a model is used, show returned token counts and estimate cost only when its current input and output rates have been configured; otherwise label cost as unpriced. Preserve imported GeoJSON geometry, holes and properties separately from display coordinates; do not invent study availability from a footprint. Support a simple written building description as a three-floor illustrative 3D building, alongside JSON blueprints and GeoJSON polygons. Make clear that written descriptions do not establish a surveyed layout.

## Engineering and acceptance

Use React, TypeScript, Three.js, Vite and a small Node server. Keep geometry/data, ranking logic, scene rendering and panels in separate modules. Do not require a Google Maps key. Handle empty/error states and keyboard access. At minimum, verify type checking, production build, ranking tests and browser checks at 1280 px and 390 px. Keyboard focus must stay inside the floor dialog and return to its opener. Browser checks must assert failures for errors and horizontal overflow, not merely print them. All primary controls must work, and the no-key path must be usable end to end.
