import { useEffect, useRef, useState } from 'react';
import { LngLatBounds, Map as MapLibreMap, Marker, NavigationControl, setWorkerUrl } from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import 'maplibre-gl/dist/maplibre-gl.css';
import { CAMPUS_CENTERS, UNIVERSITIES } from '../data/campusData.ts';

setWorkerUrl(workerUrl);

const campuses = UNIVERSITIES.flatMap(university => university.campuses.map(campus => ({ ...campus, university: university.shortName })));
const styleUrl = import.meta.env.VITE_LONDON_STYLE_URL || 'https://tiles.openfreemap.org/styles/liberty';

function createCampusMarker(campus: typeof campuses[number], index: number, selectedCampus: string, onSelect: (id: string) => void): Marker {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `campus-map-marker${campus.id === selectedCampus ? ' selected' : ''}`;
  button.textContent = `${index + 1} ${campus.university}`;
  button.dataset.index = String(index + 1);
  button.title = `${campus.university} · ${campus.name}`;
  button.setAttribute('aria-label', `Explore ${campus.university}, ${campus.name}`);
  button.addEventListener('click', () => onSelect(campus.id));
  const offset: [number, number] = campus.id === 'kcl-strand' ? [-12, 22] : campus.id === 'lse-aldwych' ? [14, -11] : [0, 0];
  return new Marker({ element: button, anchor: 'bottom', offset }).setLngLat(CAMPUS_CENTERS[campus.id]);
}

function createCampusMap(element: HTMLDivElement, selectedCampus: string, onSelect: (id: string) => void, onReady: () => void, onError: () => void): MapLibreMap {
  const map = new MapLibreMap({ container: element, style: styleUrl, center: [-0.13, 51.52], zoom: 10, pitch: 35 });
  map.addControl(new NavigationControl({ showCompass: true }), 'top-right');
  const bounds = new LngLatBounds();
  campuses.forEach((campus, index) => {
    createCampusMarker(campus, index, selectedCampus, onSelect).addTo(map);
    bounds.extend(CAMPUS_CENTERS[campus.id]);
  });
  map.fitBounds(bounds, { padding: 70, maxZoom: 12, duration: 0 });
  map.once('idle', onReady);
  map.on('error', onError);
  return map;
}

export function LondonOverview({ selectedCampus, onSelect }: { selectedCampus: string; onSelect: (id: string) => void }) {
  const host = useRef<HTMLDivElement>(null);
  const selection = useRef(onSelect);
  selection.current = onSelect;
  const [mapReady, setMapReady] = useState(false);
  const [mapFailed, setMapFailed] = useState(false);
  useEffect(() => {
    if (!host.current) return;
    const map = createCampusMap(host.current, selectedCampus, id => selection.current(id), () => setMapReady(true), () => setMapFailed(true));
    const resize = new ResizeObserver(() => map.resize());
    resize.observe(host.current);
    return () => { resize.disconnect(); map.remove(); };
  }, [selectedCampus]);
  return <div className="london-overview">
    <div className="london-map-copy"><strong>Seven campuses across London</strong><span>Choose a marker or campus below to open its 3D view. Zoom in to see city buildings in 3D.</span></div>
    <div className="london-map-frame" data-map-ready={mapReady}><div ref={host} className="london-map" role="img" aria-label="Street map of London with seven university campus markers" />{!mapReady && !mapFailed && <div className="london-map-loading" role="status">Loading London streets…</div>}{mapFailed && <div className="london-map-fallback" role="status">Map data is unavailable. Choose a campus from the list below.</div>}</div>
    <div className="campus-overview-list">{campuses.map((campus, index) => <button key={campus.id} onClick={() => onSelect(campus.id)} aria-pressed={selectedCampus === campus.id}><span><strong>{index + 1}. {campus.university} · {campus.name}</strong><small>{campus.location}</small></span><span>Explore 3D →</span></button>)}</div>
    <p className="helper-text">Campus markers use approximate coordinates. Map data © OpenStreetMap contributors via OpenFreeMap. Check the official university map for walking directions.</p>
  </div>;
}
