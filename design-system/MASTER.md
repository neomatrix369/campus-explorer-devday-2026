# CampusExplorer visual system

Visual target: [the supplied FindUCL screenshot](../design/mockup.png).

## Problem
Students need to choose a suitable place before walking across London. The interface must keep the campus legible while exposing trustworthy details about quietness, access and amenities.

## Design
Use an airy, near-white shell around a pastel 3D campus. A compact header holds university, campus, time and atmosphere. A left rail contains search and ranked places. A right inspector opens only after a building is selected. On narrow screens, the map remains the primary view and panels become drawers.

## Decisions
- The supplied screenshots are the visual source. Violet marks actions and selection; sage, amber and clay signal occupancy bands with text labels beside them.
- Use Manrope for headings and DM Sans for reading. Type must remain readable on a phone and at 200% zoom.
- All color, radius, shadow and motion values live in `src/index.css`.
- Campus geometry and occupancy are schematic estimates. Official university links are presented as source material, never as proof of live availability.
