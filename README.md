# CampusExplorer 3D FX

Find a quiet study space on a navigable, schematic 3D map of UCL, King's, Imperial and LSE.

## What it does

Switch between seven London campuses, preview a time of day, compare estimated study floors, inspect a building, and ask for a recommendation. A guided tour, optional soundscape, photo capture, PDF and GeoJSON exports, and a local GeoJSON map lab support exploration. The light interface follows the [supplied FindUCL reference](design/mockup.png).

The geometry, occupancy, noise, amenities and access hours are **demo estimates**, never live campus data or a confirmed booking. Each campus links to its official university map so students can verify details before travelling.

## Run it

Use Node 22.

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). If port 3000 is in use, run `PORT=3001 npm run dev` and open port 3001. The app works without an API key. Optionally copy `.env.example` to `.env` and set `AI_API_KEY` and `AI_MODEL` for model-written recommendations and neural tour speech. Keys stay on the server.

```bash
npm test
npm run lint
npm run build
```

## Use it

Select a university and campus in the header. Drag to rotate the map, scroll to zoom, select a building pin, and choose a floor. The time slider previews estimated changes. The study finder accepts requests such as “quiet seat with charging and water”. The Map lab accepts a GeoJSON `FeatureCollection` of `Polygon` footprints or a building JSON spec. All imported data stays in browser memory for the session.

## Learn more

- [Combined AI Studio prompt](AI_STUDIO_PROMPT.md)
- [Architecture and data limits](docs/ARCHITECTURE_AND_USER_GUIDE.md)
- Official maps: [UCL](https://maps.ucl.ac.uk/downloads/), [King's Strand](https://www.kcl.ac.uk/assets/pdf24/strand-campus-map-2025.pdf), [Imperial](https://www.imperial.ac.uk/study/visit/undergraduate/open-days/campus-map/), [LSE](https://www.lse.ac.uk/lse-information/campus-map)
