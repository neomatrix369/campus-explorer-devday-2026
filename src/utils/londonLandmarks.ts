import type { FeatureCollection, Polygon } from 'geojson';
import type { Map as MapLibreMap } from 'maplibre-gl';
import { CAMPUS_CENTERS, UNIVERSITIES, type CampusBuilding } from '../data/campusData.ts';

type BuildingProperties = { campusId: string; buildingId: string; name: string; color: string; height: number };

function offsetMeters(center: [number, number], east: number, north: number): [number, number] {
  const metresPerDegree = 111_320;
  return [center[0] + east / (metresPerDegree * Math.cos(center[1] * Math.PI / 180)), center[1] + north / metresPerDegree];
}

function buildingCorners(center: [number, number], building: CampusBuilding): [number, number][] {
  const [x, z] = building.position;
  const [width, , depth] = building.dimensions;
  const halfWidth = width / 2;
  const halfDepth = depth / 2;
  const corners: [number, number][] = [
    [x - halfWidth, z - halfDepth], [x + halfWidth, z - halfDepth],
    [x + halfWidth, z + halfDepth], [x - halfWidth, z + halfDepth],
    [x - halfWidth, z - halfDepth],
  ];
  return corners.map(([east, north]) => offsetMeters(center, east, north));
}

export function londonCampusBuildings(): FeatureCollection<Polygon, BuildingProperties> {
  const features = UNIVERSITIES.flatMap(university => university.campuses.flatMap(campus =>
    campus.buildings.map(building => ({
      type: 'Feature' as const,
      properties: {
        campusId: campus.id,
        buildingId: building.id,
        name: building.name,
        color: building.color,
        height: building.dimensions[1],
      },
      geometry: { type: 'Polygon' as const, coordinates: [buildingCorners(CAMPUS_CENTERS[campus.id], building)] },
    }))));
  return { type: 'FeatureCollection', features };
}

export function addLondonCampusLandmarks(map: MapLibreMap, onBuildingSelect: (campusId: string, buildingId: string) => void): void {
  map.addSource('campus-buildings', { type: 'geojson', data: londonCampusBuildings() });
  map.addLayer({
    id: 'campus-buildings', type: 'fill-extrusion', source: 'campus-buildings', minzoom: 14,
    paint: {
      'fill-extrusion-color': ['get', 'color'],
      'fill-extrusion-height': ['get', 'height'],
      'fill-extrusion-opacity': 0.88,
    },
  });
  map.addLayer({
    id: 'campus-building-outlines', type: 'line', source: 'campus-buildings', minzoom: 14,
    paint: { 'line-color': '#392c88', 'line-width': 2, 'line-opacity': 0.9 },
  });
  map.on('click', 'campus-buildings', event => {
    const properties = event.features?.[0]?.properties as BuildingProperties | undefined;
    if (properties) onBuildingSelect(properties.campusId, properties.buildingId);
  });
  map.on('mouseenter', 'campus-buildings', () => { map.getCanvas().style.cursor = 'pointer'; });
  map.on('mouseleave', 'campus-buildings', () => { map.getCanvas().style.cursor = ''; });
}
