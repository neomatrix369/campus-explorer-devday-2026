# Credits and provenance

This focused CampusExplorer build and its schematic campus data were created during the 1 November 2026 hackathon with Codex assistance. The data is illustrative and does not reproduce surveyed campus geometry or live availability.

- The user supplied two written briefs and four FindUCL screenshots as design references. The screenshots are not distributed in this public repository. FindUCL's original visual design is credited to its creator; this project uses a distinct implementation and does not claim that reference as original artwork.
- The project concept and name predate this build in the user's [earlier CampusExplorer 3D FX repository](https://github.com/neomatrix369/campus-explorer-3d-fx). This submission narrows that concept to one ask → inspect → verify study-space journey. See the combined brief in `AI_STUDIO_PROMPT.md` for the requested rebuild scope.
- University names and campus context are checked against the official map pages linked in the [README](../README.md). Those maps are linked, not copied into the 3D geometry.
- The app uses React, Three.js, Vite, Express, Lucide and Playwright under their respective open-source licences. Versions are recorded in `package-lock.json`.
- The demo video was produced with the local `app-demo-video` skill template. Its bundled sound kit is CC0, and its bundled fonts are under SIL Open Font License 1.1. The reproducible narration and action sequence is in `demo-video/storyboard.json`.

No OpenAI, university, or FindUCL endorsement is implied.

The macOS desktop pet engine in `native-pet/` is adapted from [DesktopPetMac](https://github.com/iappyx/DesktopPetMac), MIT licensed, with its [LICENSE](../native-pet/LICENSE) included. That port builds on [desktopPet](https://github.com/Adrianotiger/desktopPet). Its sheep animation is downloaded at runtime from the upstream pet catalog and is not bundled here. The original eSheep sprite is credited there to LiL_Stenly; the 3D sheep made for this build echoes its pale yellow wool, peach face, purple curl and orange feet. The tour bridge was made for this build.
