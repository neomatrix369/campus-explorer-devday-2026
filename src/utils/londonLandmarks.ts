import type { FeatureCollection, Polygon } from 'geojson';
import type { GeoJSONSource, Map as MapLibreMap } from 'maplibre-gl';
import { CAMPUS_CENTERS, UNIVERSITIES, type CampusBuilding } from '../data/campusData.ts';

type BuildingProperties = { campusId: string; buildingId: string; name: string; color: string; height: number };
type ModelScale = { footprint: number; height: number; colors: 'building' | 'university' };

const localScale: ModelScale = { footprint: 1, height: 1, colors: 'building' };
const cityScale: ModelScale = { footprint: 12, height: 18, colors: 'university' };
const universityColors: Record<string, string> = { ucl: '#6756df', kcl: '#d17155', imperial: '#328ba3', lse: '#79a64c' };

function offsetMeters(center: [number, number], east: number, north: number): [number, number] {
  const metresPerDegree = 111_320;
  return [center[0] + east / (metresPerDegree * Math.cos(center[1] * Math.PI / 180)), center[1] + north / metresPerDegree];
}

function buildingCorners(center: [number, number], building: CampusBuilding, footprintScale: number): [number, number][] {
  const [x, z] = building.position;
  const [width, , depth] = building.dimensions;
  const halfWidth = width / 2;
  const halfDepth = depth / 2;
  const corners: [number, number][] = [
    [x - halfWidth, z - halfDepth], [x + halfWidth, z - halfDepth],
    [x + halfWidth, z + halfDepth], [x - halfWidth, z + halfDepth],
    [x - halfWidth, z - halfDepth],
  ];
  return corners.map(([east, north]) => offsetMeters(center, east * footprintScale, north * footprintScale));
}

export function londonCampusBuildings(scale: ModelScale = localScale): FeatureCollection<Polygon, BuildingProperties> {
  const features = UNIVERSITIES.flatMap(university => university.campuses.flatMap(campus =>
    campus.buildings.map(building => ({
      type: 'Feature' as const,
      properties: {
        campusId: campus.id,
        buildingId: building.id,
        name: building.name,
        color: scale.colors === 'building' ? building.color : universityColors[university.id],
        height: building.dimensions[1] * scale.height,
      },
      geometry: { type: 'Polygon' as const, coordinates: [buildingCorners(CAMPUS_CENTERS[campus.id], building, scale.footprint)] },
    }))));
  return { type: 'FeatureCollection', features };
}

export function londonCampusOverviewBuildings(viewportWidth = 1200): FeatureCollection<Polygon, BuildingProperties> {
  const viewportScale = Math.min(2.4, Math.max(1, 900 / Math.max(1, viewportWidth)));
  return londonCampusBuildings({ ...cityScale, footprint: cityScale.footprint * viewportScale, height: cityScale.height * viewportScale });
}

export function addLondonCampusLandmarks(map: MapLibreMap, onBuildingSelect: (campusId: string, buildingId: string) => void, onCampusFocus: (campusId: string) => void): void {
  map.addSource('campus-overview-models', { type: 'geojson', data: londonCampusOverviewBuildings(map.getContainer().clientWidth) });
  map.on('resize', () => {
    const source = map.getSource('campus-overview-models') as GeoJSONSource | undefined;
    void source?.setData(londonCampusOverviewBuildings(map.getContainer().clientWidth));
  });
  map.addLayer({
    id: 'campus-overview-models', type: 'fill-extrusion', source: 'campus-overview-models', maxzoom: 14,
    paint: {
      'fill-extrusion-color': ['get', 'color'],
      'fill-extrusion-height': ['get', 'height'],
      'fill-extrusion-opacity': ['interpolate', ['linear'], ['zoom'], 12.5, 0.92, 13.4, 0.82, 14, 0],
    },
  });
  map.addSource('campus-buildings', { type: 'geojson', data: londonCampusBuildings() });
  map.addLayer({
    id: 'campus-buildings', type: 'fill-extrusion', source: 'campus-buildings', minzoom: 13.4,
    paint: {
      'fill-extrusion-color': ['get', 'color'],
      'fill-extrusion-height': ['get', 'height'],
      'fill-extrusion-opacity': ['interpolate', ['linear'], ['zoom'], 13.4, 0, 14, 0.88],
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
  map.on('click', 'campus-overview-models', event => {
    const campusId = event.features?.[0]?.properties?.campusId as string | undefined;
    if (campusId) onCampusFocus(campusId);
  });
  map.on('mouseenter', 'campus-overview-models', () => { map.getCanvas().style.cursor = 'pointer'; });
  map.on('mouseleave', 'campus-overview-models', () => { map.getCanvas().style.cursor = ''; });
  map.on('mouseenter', 'campus-buildings', () => { map.getCanvas().style.cursor = 'pointer'; });
  map.on('mouseleave', 'campus-buildings', () => { map.getCanvas().style.cursor = ''; });
}
