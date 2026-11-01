import { useEffect, useRef, useState } from 'react';
import { LngLatBounds, Map as MapLibreMap, Marker, NavigationControl, setWorkerUrl } from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import 'maplibre-gl/dist/maplibre-gl.css';
import { CAMPUS_CENTERS, UNIVERSITIES } from '../data/campusData.ts';
import { TOUR_STOPS } from '../data/tour.ts';
import { addLondonCampusLandmarks } from '../utils/londonLandmarks.ts';

setWorkerUrl(workerUrl);

const campuses = UNIVERSITIES.flatMap(university => university.campuses.map(campus => ({ ...campus, university: university.shortName })));
const styleUrl = import.meta.env.VITE_LONDON_STYLE_URL || 'https://tiles.openfreemap.org/styles/liberty';

function createWoollyMarker(campusId: string, onSelect: (id: string) => void): Marker {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'london-woolly-marker';
  button.setAttribute('aria-label', 'Woolly on the London map');
  button.title = 'Woolly is exploring London';
  button.dataset.campusId = campusId;
  button.addEventListener('click', () => onSelect(button.dataset.campusId ?? campusId));
  button.innerHTML = '<svg viewBox="0 0 48 48" aria-hidden="true"><ellipse cx="27" cy="27" rx="17" ry="15" fill="#fff1a0" stroke="#24172a" stroke-width="2"/><ellipse cx="17" cy="27" rx="9" ry="10" fill="#ffb783" stroke="#24172a" stroke-width="2"/><circle cx="17" cy="22" r="3" fill="white"/><circle cx="17" cy="22" r="1.5" fill="#24172a"/><circle cx="15" cy="13" r="6" fill="#800080" stroke="#24172a" stroke-width="2"/><circle cx="16" cy="13" r="2" fill="#cb39cb"/><path d="M20 41v4m15-4v4" stroke="#ed8958" stroke-width="4" stroke-linecap="round"/></svg>';
  return new Marker({ element: button, anchor: 'center', offset: [35, -35] });
}

function campusMarkerOffset(campusId: string, overview: boolean): [number, number] {
  const base: [number, number] = campusId === 'kcl-strand' ? [-12, 22] : campusId === 'lse-aldwych' ? [14, -11] : [0, 0];
  return [base[0], base[1] - (overview ? 55 : 0)];
}

function createCampusMarker(campus: typeof campuses[number], index: number, selectedCampus: string, onSelect: (id: string) => void): Marker {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `campus-map-marker${campus.id === selectedCampus ? ' selected' : ''}`;
  button.textContent = `${index + 1} ${campus.university}`;
  button.dataset.index = String(index + 1);
  button.title = `${campus.university} · ${campus.name}`;
  button.setAttribute('aria-label', `Explore ${campus.university}, ${campus.name}`);
  button.addEventListener('click', () => onSelect(campus.id));
  return new Marker({ element: button, anchor: 'bottom', offset: campusMarkerOffset(campus.id, true) }).setLngLat(CAMPUS_CENTERS[campus.id]);
}

function createCampusMap(element: HTMLDivElement, selectedCampus: string, onFocus: (id: string) => void, onBuildingSelect: (campusId: string, buildingId: string) => void, onReady: () => void, onError: () => void): MapLibreMap {
  const map = new MapLibreMap({ container: element, style: styleUrl, center: [-0.13, 51.52], zoom: 10, pitch: 55, bearing: -18 });
  map.on('load', () => {
    if (map.getLayer('building-3d')) map.setPaintProperty('building-3d', 'fill-extrusion-opacity', 0.35);
    addLondonCampusLandmarks(map, onBuildingSelect, onFocus);
  });
  map.addControl(new NavigationControl({ showCompass: true }), 'top-right');
  const bounds = new LngLatBounds();
  const markers = campuses.map((campus, index) => {
    const marker = createCampusMarker(campus, index, selectedCampus, onFocus).addTo(map);
    bounds.extend(CAMPUS_CENTERS[campus.id]);
    return { campus, marker };
  });
  const positionMarkers = (): void => {
    const overview = map.getZoom() < 14;
    markers.forEach(({ campus, marker }) => {
      marker.setOffset(campusMarkerOffset(campus.id, overview));
    });
  };
  map.on('zoom', positionMarkers);
  map.fitBounds(bounds, { padding: 70, maxZoom: 12, duration: 0 });
  positionMarkers();
  map.once('load', onReady);
  map.on('error', onError);
  return map;
}

export function LondonOverview({ selectedCampus, onSelect, onBuildingSelect }: { selectedCampus: string; onSelect: (id: string) => void; onBuildingSelect: (campusId: string, buildingId: string) => void }) {
  const host = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const woollyRef = useRef<Marker | null>(null);
  const flightFrame = useRef<number | null>(null);
  const selection = useRef(onSelect);
  selection.current = onSelect;
  const buildingSelection = useRef(onBuildingSelect);
  buildingSelection.current = onBuildingSelect;
  const [focusedCampus, setFocusedCampus] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapFailed, setMapFailed] = useState(false);
  const [flying, setFlying] = useState(false);
  const [cityMessage, setCityMessage] = useState('Woolly is ready to explore.');
  const focusedProfile = campuses.find(campus => campus.id === focusedCampus);
  useEffect(() => {
    if (!host.current) return;
    const focus = (id: string): void => {
      setFocusedCampus(id);
      mapRef.current?.flyTo({ center: CAMPUS_CENTERS[id], zoom: 17, pitch: 60, bearing: -18, duration: 900 });
    };
    const map = createCampusMap(host.current, selectedCampus, focus, (campusId, buildingId) => buildingSelection.current(campusId, buildingId), () => setMapReady(true), () => setMapFailed(true));
    const woolly = createWoollyMarker(selectedCampus, id => selection.current(id)).setLngLat(CAMPUS_CENTERS[selectedCampus]).addTo(map);
    mapRef.current = map;
    woollyRef.current = woolly;
    const resize = new ResizeObserver(() => map.resize());
    resize.observe(host.current);
    return () => { if (flightFrame.current !== null) cancelAnimationFrame(flightFrame.current); resize.disconnect(); woolly.remove(); map.remove(); mapRef.current = null; woollyRef.current = null; };
  }, [selectedCampus]);
  const startFlight = (): void => {
    const map = mapRef.current;
    const woolly = woollyRef.current;
    if (!map || !woolly) return;
    if (flightFrame.current !== null) cancelAnimationFrame(flightFrame.current);
    const route = [selectedCampus, ...TOUR_STOPS.map(stop => stop.campusId)].filter((id, index, stops) => index === 0 || id !== stops[index - 1]);
    let leg = 0;
    let legStarted = 0;
    setFlying(true);
    setCityMessage('Woolly is flying across London…');
    const tick = (time: number): void => {
      if (!legStarted) { legStarted = time; map.easeTo({ center: CAMPUS_CENTERS[route[1]], zoom: 12.5, pitch: 45, duration: 1800 }); }
      const from = CAMPUS_CENTERS[route[leg]];
      const to = CAMPUS_CENTERS[route[leg + 1]];
      const progress = Math.min(1, (time - legStarted) / 1900);
      woolly.setLngLat([from[0] + (to[0] - from[0]) * progress, from[1] + (to[1] - from[1]) * progress]);
      if (progress >= 1) {
        leg++;
        woolly.getElement().dataset.campusId = route[leg];
        if (leg === route.length - 1) { setFlying(false); setCityMessage('Woolly reached UCL East. Choose a campus to explore in 3D.'); flightFrame.current = null; return; }
        legStarted = time;
        const campus = campuses.find(item => item.id === route[leg + 1]);
        setCityMessage(`Flying to ${campus?.university ?? 'the next campus'} · ${campus?.name ?? 'London'}`);
        map.easeTo({ center: CAMPUS_CENTERS[route[leg + 1]], zoom: 12.5, pitch: 45, duration: 1800 });
      }
      flightFrame.current = requestAnimationFrame(tick);
    };
    flightFrame.current = requestAnimationFrame(tick);
  };
  const stopFlight = (): void => {
    if (flightFrame.current !== null) cancelAnimationFrame(flightFrame.current);
    flightFrame.current = null;
    setFlying(false);
    setCityMessage('Woolly is waiting on the London map.');
  };
  const showAllCampuses = (): void => {
    const bounds = new LngLatBounds();
    campuses.forEach(campus => bounds.extend(CAMPUS_CENTERS[campus.id]));
    mapRef.current?.fitBounds(bounds, { padding: 70, maxZoom: 12, duration: 600 });
    setFocusedCampus(null);
  };
  return <div className="london-overview">
    <div className="london-map-copy"><strong>3D London · {campuses.length} campuses</strong><span>{focusedCampus ? 'Illustrative campus buildings appear at this map position. Click a colored building to open its study details.' : 'Enlarged 3D miniatures show all 27 bundled buildings across London. Select one to zoom in; sizes are illustrative.'}</span><button className="secondary-button" onClick={showAllCampuses}>All campuses</button><button className="secondary-button" onClick={flying ? stopFlight : startFlight}>{flying ? 'Stop Woolly' : '🐑 Fly with Woolly'}</button></div>
    <div className="london-map-frame" data-map-ready={mapReady}><div ref={host} className="london-map" role="img" aria-label={`Street map of London with ${campuses.length} university campus markers`} />{!mapReady && !mapFailed && <div className="london-map-loading" role="status">Loading London streets…</div>}{mapFailed && <div className="london-map-fallback" role="status">Map data is unavailable. Choose a campus from the list below.</div>}</div>
    <p className="london-woolly-status" role="status">{cityMessage}</p>
    <div className="campus-overview-list">{focusedProfile ? focusedProfile.buildings.map(building => <button key={building.id} onClick={() => onBuildingSelect(focusedProfile.id, building.id)}><span><strong>{building.name}</strong><small>{building.category} · illustrative position</small></span><span>Open details →</span></button>) : campuses.map((campus, index) => <button key={campus.id} onClick={() => onSelect(campus.id)} aria-pressed={selectedCampus === campus.id}><span><strong>{index + 1}. {campus.university} · {campus.name}</strong><small>{campus.location}</small></span><span>Explore 3D →</span></button>)}</div>
    <p className="helper-text">Campus markers use approximate coordinates. Map data © OpenStreetMap contributors via OpenFreeMap. Check the official university map for walking directions.</p>
  </div>;
}
