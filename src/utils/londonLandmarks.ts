import type { Map as MapLibreMap } from 'maplibre-gl';
import type { FeatureCollection, Polygon } from 'geojson';
import { CAMPUS_CENTERS, UNIVERSITIES } from '../data/campusData.ts';

const colors: Record<string, string> = { ucl: '#6756df', kcl: '#cc8063', imperial: '#518ca6', lse: '#83a567' };

export function addLondonCampusLandmarks(map: MapLibreMap): void {
  const features: FeatureCollection<Polygon>['features'] = UNIVERSITIES.flatMap(university => university.campuses.map(campus => {
    const [lon, lat] = CAMPUS_CENTERS[campus.id];
    const dx = .0014;
    const dy = .0009;
    return {
      type: 'Feature' as const,
      properties: { campus: campus.id, color: colors[university.id], height: 1200 },
      geometry: { type: 'Polygon' as const, coordinates: [[[lon - dx, lat - dy], [lon + dx, lat - dy], [lon + dx, lat + dy], [lon - dx, lat + dy], [lon - dx, lat - dy]]] },
    };
  }));
  const data: FeatureCollection<Polygon> = { type: 'FeatureCollection', features };
  map.addSource('campus-landmarks', { type: 'geojson', data });
  map.addLayer({ id: 'campus-landmarks', type: 'fill-extrusion', source: 'campus-landmarks', maxzoom: 14,
    paint: { 'fill-extrusion-color': ['get', 'color'], 'fill-extrusion-height': ['get', 'height'], 'fill-extrusion-opacity': .72 },
  });
}
