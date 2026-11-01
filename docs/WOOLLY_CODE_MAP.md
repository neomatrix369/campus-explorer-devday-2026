# Woolly Code Map

This repo lives in the `pet-wolly` folder for the Codex-created Pet Wolly project. It has two Woolly implementations that work together: the browser 3D pet that leads the CampusExplorer tour, and the native macOS desktop pet that roams outside the browser.

## 3D Woolly inside the Campus world

- `src/components/CampusScene3D.tsx`
  - Owns the 3D Woolly model, shape, colour, texture, movement, camera follow, speech bubbles, tour behaviour, and walking through the campus world.
  - This is the quickest place to change how 3D Woolly looks. The recent pale-gold fleece, curly texture, peach face and legs, purple side horns, and camera sizing changes live here.
- `src/utils/petRoute.ts`
  - Controls Woolly's pathfinding so she walks along paths and avoids buildings.

## Desktop pet Woolly

- `native-pet/Sources/DesktopPet/App.swift`
  - Main macOS desktop pet app entry point.
- `native-pet/Sources/DesktopPet/PetWindow.swift`
  - Floating transparent desktop pet window.
- `native-pet/Sources/DesktopPet/PetModel.swift`
  - Pet state and behaviour model.
- `native-pet/Sources/DesktopPet/PetXML.swift`
  - Parses eSheep-style animation XML.
- `native-pet/Sources/DesktopPet/PetResources.swift`
  - Loads the eSheep-style sprite resources used by the desktop pet.

## Bridge between desktop and browser

- `native-pet/Sources/DesktopPet/App.swift`
  - Sends Woolly actions into the web app, including starting the tour and calling the pet back.
- `src/components/CampusScene3D.tsx`
  - Receives the tour state in the browser and shows Woolly entering, walking inside the 3D world, and returning to the desktop flow.
