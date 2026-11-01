import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUpRight, Camera, ChevronDown, Clock3, Compass, Download, FileJson, FileText, Layers3, Map, Menu, Moon, Music2, Pause, Play, RotateCcw, SkipBack, SkipForward, Sparkles, Sun, Volume2, VolumeX, X } from 'lucide-react';
import { ALL_BUILDINGS, UNIVERSITIES, findBuildingLocation, type CampusBuilding, type CampusProfile } from './data/campusData.ts';
import { TOUR_AUDIO } from './data/audio.ts';
import { TOUR_STOPS } from './data/tour.ts';
import { recommendStudySpot, parseStudyQuery, rankStudySpaces, formatHour, sunState, type Recommendation } from './utils/campusLogic.ts';
import { campusGeoJson, campusPdf, downloadBlob, parseBlueprint, parseGeoJsonBuildings, synthesizeBlueprint } from './utils/mapExports.ts';
import { createSoundscape, type SoundMode } from './utils/soundscape.ts';
import { startNarration } from './utils/narration.ts';
import { CampusScene3D, type PetActivity, type PetPhase, type SceneHandle } from './components/CampusScene3D.tsx';
import { BuildingInspector, LeftRail } from './components/StudyPanels.tsx';
import { FloorExplorer } from './components/FloorExplorer.tsx';

const LondonOverview = lazy(() => import('./components/LondonOverview.tsx').then(module => ({ default: module.LondonOverview })));

type ToolPanel = 'none' | 'exports' | 'map-lab' | 'photo' | 'london' | 'view';
type ApiRecommendation = Recommendation & { source?: 'local' | 'local-fallback' | 'model'; usage?: { input_tokens?: number; output_tokens?: number } | null; costUsd?: number | null };

function currentHour(): number {
  const now = new Date();
  return (now.getHours() + Math.round(now.getMinutes() / 15) * .25) % 24;
}

function saveDataUrl(url: string, filename: string): void {
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
}

async function makeContactSheet(photos: string[]): Promise<string> {
  const cellWidth = 600;
  const cellHeight = 380;
  const canvas = document.createElement('canvas');
  canvas.width = cellWidth * 2;
  canvas.height = cellHeight * Math.ceil(photos.length / 2);
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Photo export is unavailable in this browser.');
  context.fillStyle = '#f8f9f8';
  context.fillRect(0, 0, canvas.width, canvas.height);
  await Promise.all(photos.map((source, index) => new Promise<void>((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const scale = Math.min(cellWidth / image.width, cellHeight / image.height);
      const width = image.width * scale;
      const height = image.height * scale;
      const x = index % 2 * cellWidth + (cellWidth - width) / 2;
      const y = Math.floor(index / 2) * cellHeight + (cellHeight - height) / 2;
      context.drawImage(image, x, y, width, height);
      resolve();
    };
    image.onerror = () => reject(new Error('A captured view could not be loaded.'));
    image.src = source;
  })));
  return canvas.toDataURL('image/png');
}

function postPetMode(mode: 'desktop' | 'tour'): void {
  void fetch('/api/pet/mode', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode }) }).catch(() => undefined);
}

export default function App() {
  const [campusId, setCampusId] = useState('ucl-bloomsbury');
  const [customBuildings, setCustomBuildings] = useState<Record<string, CampusBuilding[]>>({});
  const [hour, setPreviewHour] = useState(currentHour);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedFloor, setSelectedFloor] = useState<string | null>(null);
  const [heatmap, setHeatmap] = useState(true);
  const [flow, setFlow] = useState(false);
  const [trees, setTrees] = useState(true);
  const [cityContext, setCityContext] = useState(true);
  const [panelsHidden, setPanelsHidden] = useState(false);
  const [soundMode, setSoundMode] = useState<SoundMode>('off');
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null);
  const [telemetry, setTelemetry] = useState({ queries: 0, modelTokens: 0, costUsd: 0, unknownCost: false, lastSource: 'local' });
  const [finding, setFinding] = useState(false);
  const [floorOpen, setFloorOpen] = useState(false);
  const [toolPanel, setToolPanel] = useState<ToolPanel>('none');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [tourPlaying, setTourPlaying] = useState(false);
  const [tourStarted, setTourStarted] = useState(false);
  const [petTour, setPetTour] = useState(false);
  const [petCallStatus, setPetCallStatus] = useState('');
  const [petPhase, setPetPhase] = useState<PetPhase>('desktop');
  const [petMessage, setPetMessage] = useState<string | null>(null);
  const [petActivity, setPetActivity] = useState<PetActivity | null>(null);
  const [petView, setPetView] = useState<'street' | 'drone'>('street');
  const [tourIndex, setTourIndex] = useState(0);
  const [tourLoop, setTourLoop] = useState(false);
  const [tourVoice, setTourVoice] = useState(true);
  const [photos, setPhotos] = useState<string[]>([]);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState('');
  const [blueprint, setBlueprint] = useState(JSON.stringify({ name: 'New Study Annex', shortCode: 'NSA', position: [2, -36], dimensions: [15, 18, 12], floors: [{ level: '1', name: 'Study commons', type: 'Group', seats: 48 }, { level: '2', name: 'Quiet study', type: 'Quiet', seats: 40 }, { level: '3', name: 'Silent study', type: 'Silent', seats: 36 }] }, null, 2));
  const [description, setDescription] = useState('');
  const [labMessage, setLabMessage] = useState('');
  const sceneRef = useRef<SceneHandle>(null);
  const soundRef = useRef<ReturnType<typeof createSoundscape> | null>(null);
  const lastRequest = useRef(0);
  const pendingRequest = useRef<AbortController | null>(null);
  const petTimer = useRef<number | undefined>(undefined);
  const callTimer = useRef<number | undefined>(undefined);
  const messageTimer = useRef<number | undefined>(undefined);
  const showPetMessage = useCallback((message: string, duration = 5200, activity: PetActivity | null = null): void => {
    window.clearTimeout(messageTimer.current);
    setPetMessage(message);
    setPetActivity(activity);
    messageTimer.current = window.setTimeout(() => { setPetMessage(null); setPetActivity(null); }, duration);
  }, []);
  const invalidateRecommendation = useCallback(() => {
    lastRequest.current++;
    pendingRequest.current?.abort();
    setRecommendation(null);
    setFinding(false);
  }, []);
  const setHour = useCallback((next: number) => {
    invalidateRecommendation();
    setPreviewHour(next);
  }, [invalidateRecommendation]);

  const location = useMemo(() => UNIVERSITIES.flatMap(university => university.campuses.map(campus => ({ university, campus }))).find(item => item.campus.id === campusId)!, [campusId]);
  const university = location.university;
  const campus: CampusProfile = useMemo(() => ({ ...location.campus, buildings: [...location.campus.buildings, ...(customBuildings[campusId] ?? [])] }), [location, customBuildings, campusId]);
  const selected = campus.buildings.find(building => building.id === selectedId) ?? null;
  const phase = sunState(hour).phase;

  useEffect(() => {
    soundRef.current = createSoundscape();
    return () => { window.clearTimeout(petTimer.current); window.clearTimeout(callTimer.current); window.clearTimeout(messageTimer.current); soundRef.current?.dispose(); };
  }, []);

  useEffect(() => {
    if (!petTour) return;
    const heartbeat = window.setInterval(() => postPetMode('tour'), 2500);
    const returnToDesktop = (): void => {
      navigator.sendBeacon('/api/pet/mode', new Blob([JSON.stringify({ mode: 'desktop' })], { type: 'application/json' }));
    };
    window.addEventListener('pagehide', returnToDesktop);
    return () => { window.clearInterval(heartbeat); window.removeEventListener('pagehide', returnToDesktop); };
  }, [petTour]);

  useEffect(() => {
    const handle = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === 'h' && !(event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement)) setPanelsHidden(value => !value);
      if (event.key === 'Escape') { setFloorOpen(false); setToolPanel('none'); setMobileOpen(false); }
      if (event.key === ' ' && tourPlaying && !(event.target instanceof HTMLInputElement)) { event.preventDefault(); setTourPlaying(false); }
      if (event.key === 'ArrowRight' && tourPlaying && !(event.target instanceof HTMLInputElement)) setTourIndex(index => (index + 1) % TOUR_STOPS.length);
    };
    window.addEventListener('keydown', handle);
    return () => window.removeEventListener('keydown', handle);
  }, [tourPlaying]);

  const chooseCampus = useCallback((id: string) => {
    invalidateRecommendation();
    setTourPlaying(false);
    setTourStarted(false);
    setCampusId(id);
    setSelectedId(null);
    setSelectedFloor(null);
    setRecommendation(null);
    soundRef.current?.cue(580);
  }, [invalidateRecommendation]);

  const selectBuilding = useCallback((id: string, floor?: string) => {
    setSelectedId(id);
    setSelectedFloor(floor ?? null);
    sceneRef.current?.focus(id);
    soundRef.current?.cue(670);
    setMobileOpen(false);
  }, []);

  const recordTelemetry = useCallback((result: ApiRecommendation) => {
    setTelemetry(current => ({
      queries: current.queries + 1,
      modelTokens: current.modelTokens + (result.usage?.input_tokens ?? 0) + (result.usage?.output_tokens ?? 0),
      costUsd: current.costUsd + (result.costUsd ?? 0),
      unknownCost: current.unknownCost || (result.source !== 'local' && result.costUsd == null),
      lastSource: result.source ?? 'local',
    }));
  }, []);

  const ask = useCallback(async (query: string) => {
    const trimmed = query.trim();
    if (!trimmed) return;
    const targetUniversity = /\blse\b|economics/i.test(trimmed) ? 'lse' : /\bkcl\b|king'?s/i.test(trimmed) ? 'kcl' : /imperial/i.test(trimmed) ? 'imperial' : /\bucl\b/i.test(trimmed) ? 'ucl' : null;
    const namedCampuses = UNIVERSITIES.flatMap(item => item.campuses).filter(item => trimmed.toLowerCase().includes(item.name.toLowerCase()));
    const targetCampus = namedCampuses[0] ?? (targetUniversity ? UNIVERSITIES.find(item => item.id === targetUniversity)!.campuses[0] : location.campus);
    invalidateRecommendation();
    const requestedHour = parseStudyQuery(trimmed).startHour ?? hour;
    if (requestedHour !== hour) setPreviewHour(requestedHour);
    const targetBuildings = targetCampus.id === campusId ? campus.buildings : [...targetCampus.buildings, ...(customBuildings[targetCampus.id] ?? [])];
    if (targetCampus.id !== campusId) setCampusId(targetCampus.id);
    const local = recommendStudySpot(trimmed, targetBuildings, requestedHour);
    setRecommendation(local);
    setSelectedId(local.match?.building.id ?? null); setSelectedFloor(local.match?.floor.level ?? null);
    const requestId = ++lastRequest.current;
    if (!local.match || (customBuildings[targetCampus.id]?.length ?? 0) > 0) {
      setFinding(false);
      recordTelemetry({ ...local, source: 'local', costUsd: 0 });
      return;
    }
    setFinding(true);
    const controller = new AbortController();
    pendingRequest.current = controller;
    try {
      const response = await fetch('/api/ai/concierge', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: trimmed, campusId: targetCampus.id, hour: requestedHour }), signal: controller.signal });
      if (!response.ok) throw new Error('The recommendation service is unavailable.');
      const result = await response.json() as ApiRecommendation;
      if (requestId !== lastRequest.current) return;
      const match = rankStudySpaces(targetBuildings, requestedHour, parseStudyQuery(trimmed)).find(spot => spot.building.id === result.match?.building.id && spot.floor.level === result.match?.floor.level) ?? local.match;
      setRecommendation({ ...result, match });
      recordTelemetry(result);
      if (match) { setSelectedId(match.building.id); setSelectedFloor(match.floor.level); setTimeout(() => { if (requestId === lastRequest.current) sceneRef.current?.focus(match.building.id); }, 180); }
    } catch { if (requestId === lastRequest.current) { setRecommendation(local); recordTelemetry({ ...local, source: 'local-fallback', costUsd: null }); } }
    finally { if (requestId === lastRequest.current) setFinding(false); }
  }, [campus, campusId, customBuildings, hour, recordTelemetry, location, invalidateRecommendation]);

  const finishPetExit = useCallback((): void => {
    setTourPlaying(false);
    window.speechSynthesis?.cancel();
    setPetPhase('exiting');
    showPetMessage('See you back on the desktop!');
    window.clearTimeout(petTimer.current);
    petTimer.current = window.setTimeout(() => {
      setTourStarted(false);
      setPetTour(false);
      setPetPhase('desktop');
      postPetMode('desktop');
    }, 1300);
  }, [showPetMessage]);

  useEffect(() => {
    if (!tourPlaying) return;
    const stop = TOUR_STOPS[tourIndex];
    const where = findBuildingLocation(stop.buildingId);
    if (!where) return;
    setCampusId(stop.campusId);
    setSelectedId(stop.buildingId);
    setSelectedFloor(stop.floor);
    setHour(stop.hour);
    if (petTour) showPetMessage(stop.narration.split('. ')[0] + '.', 5200, 'wave');
    soundRef.current?.cue(520 + tourIndex * 40);
    const focusTimer = window.setTimeout(() => sceneRef.current?.focus(stop.buildingId), 350);
    let nextTimer: number | undefined;
    const advance = () => { nextTimer = window.setTimeout(() => {
      if (tourIndex === TOUR_STOPS.length - 1 && !tourLoop) {
        if (petTour) finishPetExit();
        else { setTourPlaying(false); setTourStarted(false); }
        return;
      }
      setTourIndex(index => (index + 1) % TOUR_STOPS.length);
    }, 1100); };
    const cancelNarration = tourVoice ? startNarration(stop.narration, TOUR_AUDIO(tourIndex), advance) : () => undefined;
    if (!tourVoice) nextTimer = window.setTimeout(advance, 5500);
    return () => { clearTimeout(focusTimer); if (nextTimer) clearTimeout(nextTimer); cancelNarration(); };
  }, [tourPlaying, tourIndex, tourLoop, tourVoice, petTour, finishPetExit, showPetMessage]);

  const startTour = (loop: boolean) => { invalidateRecommendation(); setToolPanel('none'); setFloorOpen(false); setTourIndex(0); setTourLoop(loop); setTourStarted(true); setTourPlaying(true); };
  const startPetTour = () => {
    window.clearTimeout(petTimer.current);
    setPetView('street');
    setPetTour(true);
    setRecommendation(null);
    setPetPhase('entering');
    showPetMessage('Baa! Follow me into the 3D campus.');
    setCampusId(TOUR_STOPS[0].campusId);
    setSelectedId(TOUR_STOPS[0].buildingId);
    setSelectedFloor(TOUR_STOPS[0].floor);
    startTour(false);
    setTourPlaying(false);
    setSoundMode('lofi');
    soundRef.current?.setMode('lofi');
    soundRef.current?.cue(740);
    window.setTimeout(() => sceneRef.current?.focus(TOUR_STOPS[0].buildingId), 120);
    petTimer.current = window.setTimeout(() => { setPetPhase('touring'); setTourPlaying(true); }, 1500);
    postPetMode('tour');
  };
  const leaveTour = () => {
    if (petTour) finishPetExit();
    else { setTourPlaying(false); setTourStarted(false); }
  };
  const callWoolly = async (): Promise<void> => {
    setPetCallStatus('Calling Woolly…');
    try {
      const response = await fetch('/api/pet/summon', { method: 'POST' });
      setPetCallStatus(response.ok ? 'Woolly is coming!' : 'Start the macOS pet');
    } catch { setPetCallStatus('Pet bridge unavailable'); }
    window.clearTimeout(callTimer.current);
    callTimer.current = window.setTimeout(() => setPetCallStatus(''), 4500);
  };
  const pauseForWoolly = (): void => {
    if (petPhase === 'entering') {
      window.clearTimeout(petTimer.current);
      setPetPhase('touring');
    }
    setTourPlaying(false);
  };
  const speakWoollyLine = (line: string): void => {
    window.setTimeout(() => {
      if (!tourVoice || !('speechSynthesis' in window)) return;
      window.speechSynthesis.cancel();
      const voice = new SpeechSynthesisUtterance(line);
      voice.lang = 'en-GB';
      voice.rate = .9;
      voice.pitch = 1.25;
      window.speechSynthesis.speak(voice);
    }, 100);
  };
  const woollysPick = () => {
    pauseForWoolly();
    const line = 'I will sniff out a cosy study seat!';
    showPetMessage(line, 5200, 'graze');
    speakWoollyLine(line);
    void ask('quiet seat with charging and water');
  };
  const surpriseStop = () => {
    setRecommendation(null);
    showPetMessage('Plot twist! Let us explore somewhere new.', 3200, 'dance');
    setTourPlaying(true);
    setTourIndex(index => (index + 1 + Math.floor(Math.random() * (TOUR_STOPS.length - 1))) % TOUR_STOPS.length);
    soundRef.current?.cue(920);
  };
  const hearWoolly = (): void => {
    setSoundMode('lofi');
    soundRef.current?.setMode('lofi');
    soundRef.current?.sing();
    showPetMessage('La la baa!', 5200, 'dance');
  };
  const woollySays = (): void => {
    if (petPhase === 'exiting') return;
    const lines = [
      'Baa! A quiet corner and a cup of tea sounds perfect.',
      'I found more libraries than grass. London is amazing!',
      'My woolly wisdom: check the official map before you trot over.',
    ];
    const line = lines[Math.floor(Math.random() * lines.length)];
    pauseForWoolly();
    showPetMessage(line, 7000, 'wave');
    speakWoollyLine(line);
  };
  useEffect(() => {
    const url = new URL(window.location.href);
    const tour = url.searchParams.get('sheepTour') === '1';
    const find = url.searchParams.get('sheepFind') === '1';
    if (!tour && !find) return;
    url.searchParams.delete('sheepTour');
    url.searchParams.delete('sheepFind');
    window.history.replaceState(null, '', url);
    if (tour) startPetTour();
    else void ask('quiet seat with charging and water');
  }, []);
  const toggleSound = () => { const next = soundMode === 'off' ? 'lofi' : soundMode === 'lofi' ? 'rain' : 'off'; setSoundMode(next); soundRef.current?.setMode(next); };
  const exportPdf = () => downloadBlob(campusPdf(university, campus, hour) as BlobPart, 'application/pdf', `${campus.id}-schematic-map.pdf`);
  const exportGeo = () => downloadBlob(JSON.stringify(campusGeoJson(campus), null, 2), 'application/geo+json', `${campus.id}-schematic.geojson`);
  const capture = () => { const image = sceneRef.current?.capture(); if (image) setPhotos(current => [image, ...current].slice(0, 12)); };
  const captureBurst = async () => {
    if (photoBusy) return;
    setPhotoBusy(true);
    const original = hour;
    const shots: string[] = [];
    for (const time of [13.5, 18.25, 22]) {
      setHour(time);
      await new Promise(resolve => setTimeout(resolve, 450));
      const image = sceneRef.current?.capture();
      if (image) shots.push(image);
    }
    setHour(original);
    setPhotos(current => [...shots, ...current].slice(0, 12));
    setPhotoBusy(false);
  };
  const addBlueprint = () => {
    try {
      const next = parseBlueprint(blueprint, campus.buildings.length);
      invalidateRecommendation();
      setCustomBuildings(current => ({ ...current, [campusId]: [...(current[campusId] ?? []), next] }));
      setLabMessage(`${next.name} added to ${campus.name} as a schematic building.`);
      setSelectedId(next.id);
    } catch (error) { setLabMessage((error as Error).message); }
  };
  const addDescription = () => {
    try {
      const next = synthesizeBlueprint(description, campus.buildings.length);
      invalidateRecommendation();
      setCustomBuildings(current => ({ ...current, [campusId]: [...(current[campusId] ?? []), next] }));
      setLabMessage(`${next.name} added with three illustrative floors. Confirm its real layout and access with the university.`);
      setSelectedId(next.id);
    } catch (error) { setLabMessage((error as Error).message); }
  };
  const importGeoJson = async (file: File | undefined) => {
    if (!file) return;
    try {
      if (file.size > 2_000_000) throw new Error('Choose a GeoJSON file smaller than 2 MB.');
      const imported = parseGeoJsonBuildings(await file.text(), campus.buildings.length);
      invalidateRecommendation();
      setCustomBuildings(current => ({ ...current, [campusId]: [...(current[campusId] ?? []), ...imported] }));
      setLabMessage(`${imported.length} polygon footprint${imported.length === 1 ? '' : 's'} added as schematic 3D buildings.`);
    } catch (error) { setLabMessage((error as Error).message); }
  };

  return <main className={`app-shell ${panelsHidden ? 'panels-hidden' : ''}`} data-campus={campusId} data-phase={phase} data-pet-playing={petTour && tourPlaying} data-pet-tour={petTour}>
    <header className="topbar">
      <div className="brand"><span className="brand-mark"><Compass size={23} strokeWidth={2.5} /></span><span><strong>CampusExplorer</strong><small>Find a quiet seat before you walk there</small></span></div>
      <nav className="university-tabs" aria-label="University">{UNIVERSITIES.map(item => <button key={item.id} className={university.id === item.id ? 'active' : ''} onClick={() => chooseCampus(item.campuses[0].id)} aria-pressed={university.id === item.id}>{item.shortName}</button>)}</nav>
      <div className="header-actions"><div className="campus-select-wrap"><label className="sr-only" htmlFor="campus-select">Campus</label><select id="campus-select" value={campusId} onChange={event => chooseCampus(event.target.value)}>{university.campuses.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select><ChevronDown size={15} /></div><span className="simulation-chip">Simulated + official map links</span><label className="time-control"><Clock3 size={17} /><span>Time</span><input type="range" min="0" max="23.75" step="0.25" value={hour} onChange={event => setHour(Number(event.target.value))} aria-label="Preview hour" /><strong>{formatHour(hour)}</strong></label><button className="icon-button theme-button" onClick={() => setHour(phase === 'night' ? 13 : 22)} aria-label={phase === 'night' ? 'Show daytime' : 'Show nighttime'}>{phase === 'night' ? <Sun size={18} /> : <Moon size={18} />}</button><button className="icon-button mobile-menu" onClick={() => setMobileOpen(true)} aria-label="Open study finder"><Menu size={21} /></button></div>
    </header>

    <CampusScene3D ref={sceneRef} campus={campus} hour={hour} selectedId={selectedId} selectedFloor={selectedFloor} heatmap={heatmap} flow={flow} trees={trees} context={cityContext} petGuide={petTour && tourStarted} petPhase={petPhase} petMessage={petMessage} petActivity={petActivity ?? (petPhase === 'touring' && !tourPlaying ? 'nap' : 'walk')} petView={petView} petMoving={tourPlaying} onSelect={selectBuilding} />
    <div className="map-attribution">Schematic 3D campus · not a surveyed map <a href={campus.sourceUrl} target="_blank" rel="noreferrer">Official map <ArrowUpRight size={12} /></a></div>
    <LeftRail campus={campus} hour={hour} recommendation={recommendation} usageText={telemetry.queries ? `${telemetry.queries} ${telemetry.queries === 1 ? 'query' : 'queries'} · ${telemetry.modelTokens} model tokens · ${telemetry.unknownCost ? 'some model cost unpriced' : `$${telemetry.costUsd.toFixed(6)} estimated AI cost`} · ${telemetry.lastSource.replace('-', ' ')}` : ''} loading={finding} onAsk={ask} onSelect={selectBuilding} mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
    {selected && <BuildingInspector campus={campus} building={selected} hour={hour} selectedFloor={selectedFloor} onFloor={setSelectedFloor} onExpand={() => setFloorOpen(true)} onClose={() => { setSelectedId(null); setSelectedFloor(null); sceneRef.current?.reset(); }} />}

    <div className="map-title"><span className="eyebrow">Explore in 3D</span><strong>{university.shortName} · {campus.name}</strong><span>{campus.location}</span></div>
    <div className="view-controls"><button onClick={() => petTour ? setPetView('drone') : sceneRef.current?.reset()}><RotateCcw size={16} /> Overview</button><button onClick={() => petTour ? setPetView('drone') : sceneRef.current?.view('aerial')} aria-pressed={petTour && petView === 'drone'}>{petTour ? '🚁 Drone' : 'Aerial'}</button><button onClick={() => petTour ? setPetView('street') : sceneRef.current?.view('street')} aria-pressed={petTour && petView === 'street'}>{petTour ? '🚶 Follow' : 'Street'}</button><button onClick={() => setPanelsHidden(value => !value)} aria-pressed={panelsHidden}>{panelsHidden ? 'Show panels' : 'Hide panels'}</button></div>

    {tourStarted && <div className="tour-banner" role="status">
      <span className="tour-progress">{petTour ? '🐑' : `${tourIndex + 1}/${TOUR_STOPS.length}`}</span>
      <div>
        <small>{tourVoice ? 'Tour voice · ' : ''}{petTour ? petPhase === 'entering' ? 'Woolly is entering 3D' : petPhase === 'exiting' ? 'Woolly is coming home' : tourPlaying ? 'Woolly is leading' : recommendation?.match ? 'Woolly found a quiet spot' : 'Woolly is waiting' : tourPlaying ? 'Guided tour' : 'Tour paused'}</small>
        <strong>{petTour && !tourPlaying && recommendation?.match ? recommendation.match.building.name : TOUR_STOPS[tourIndex].title}</strong>
      </div>
      <button onClick={() => setTourIndex(index => (index - 1 + TOUR_STOPS.length) % TOUR_STOPS.length)} aria-label="Previous tour stop"><SkipBack size={17} /></button>
      <button onClick={() => setTourPlaying(value => !value)} aria-label={tourPlaying ? 'Pause tour' : 'Resume tour'}>{tourPlaying ? <Pause size={17} /> : <Play size={17} />}</button>
      <button onClick={() => setTourIndex(index => (index + 1) % TOUR_STOPS.length)} aria-label="Next tour stop"><SkipForward size={17} /></button>
      <button onClick={petTour ? surpriseStop : () => { setTourIndex(0); setTourPlaying(true); }} aria-label={petTour ? 'Surprise me with a tour stop' : 'Replay tour'}>{petTour ? <Sparkles size={16} /> : <RotateCcw size={16} />}</button>
      <button onClick={() => setTourVoice(value => !value)} aria-label={tourVoice ? 'Mute tour voice' : 'Enable tour voice'}>{tourVoice ? <Volume2 size={16} /> : <VolumeX size={16} />}</button>
      <button onClick={hearWoolly} aria-label="Hear Woolly sing" title="Hear Woolly sing"><Music2 size={16} /></button>
      {petTour && <button onClick={() => setPetView(view => view === 'street' ? 'drone' : 'street')} aria-label={petView === 'street' ? 'Switch to drone view' : 'Switch to street follow'} title={petView === 'street' ? 'Drone view' : 'Street follow'}>{petView === 'street' ? '🚁' : '🚶'}</button>}
      <button onClick={leaveTour} aria-label="Exit tour"><X size={16} /></button>
    </div>}

    <div className="bottom-dock" aria-label="Map controls">{!petTour && <button onClick={() => void callWoolly()} aria-live="polite">{petCallStatus || '🐑 Call Woolly'}</button>}<button onClick={() => setToolPanel(toolPanel === 'london' ? 'none' : 'london')}><Map size={17} /> London</button><button onClick={() => setToolPanel(toolPanel === 'view' ? 'none' : 'view')}><Sun size={17} /> View</button><button className={heatmap ? 'active' : ''} onClick={() => setHeatmap(value => !value)} aria-pressed={heatmap}><Layers3 size={17} /> Heatmap</button><button className={flow ? 'active' : ''} onClick={() => setFlow(value => !value)} aria-pressed={flow}><Sparkles size={17} /> Flow</button><span className="dock-divider" /><button onClick={() => tourStarted ? setTourPlaying(value => !value) : startPetTour()}>{tourPlaying ? <Pause size={17} /> : <Play size={17} />} {tourPlaying ? 'Pause tour' : tourStarted ? 'Resume tour' : '🐑 Follow Woolly'}</button>{petTour && <><button onClick={woollysPick}><Compass size={17} /> Woolly's quiet pick</button><button onClick={hearWoolly}><Music2 size={17} /> Hear Woolly</button><button onClick={woollySays}>☁️ Woolly says</button></>}<button className={soundMode !== 'off' ? 'active' : ''} onClick={toggleSound} aria-label={`Sound: ${soundMode}. Change soundscape`}>{soundMode === 'off' ? <VolumeX size={17} /> : <Music2 size={17} />} {soundMode === 'off' ? 'Sound off' : soundMode === 'lofi' ? 'Lo-fi' : 'Rain'}</button><span className="dock-divider" /><button onClick={() => setToolPanel(toolPanel === 'photo' ? 'none' : 'photo')}><Camera size={17} /> Photos</button><button onClick={() => setToolPanel(toolPanel === 'exports' ? 'none' : 'exports')}><Download size={17} /> Export</button><button onClick={() => setToolPanel(toolPanel === 'map-lab' ? 'none' : 'map-lab')}><Map size={17} /> Map lab</button></div>

    {toolPanel !== 'none' && <div className={`tool-drawer panel ${toolPanel === 'london' ? 'london-drawer' : ''}`} role="dialog" aria-label={toolPanel === 'photo' ? 'Photo studio' : toolPanel === 'exports' ? 'Map exports' : toolPanel === 'london' ? 'London overview' : toolPanel === 'view' ? 'Scene controls' : 'Map lab'}><div className="tool-heading"><strong>{toolPanel === 'photo' ? 'Photo studio' : toolPanel === 'exports' ? 'Take this map with you' : toolPanel === 'london' ? 'Explore London' : toolPanel === 'view' ? 'Make the view yours' : 'Map lab'}</strong><button className="icon-button" onClick={() => setToolPanel('none')} aria-label="Close tools"><X size={18} /></button></div>
      {toolPanel === 'london' && <div className="tool-content"><Suspense fallback={<p className="helper-text">Opening London map…</p>}><LondonOverview selectedCampus={campusId} onSelect={id => { chooseCampus(id); setToolPanel('none'); setPanelsHidden(false); }} onBuildingSelect={(nextCampus, buildingId) => { chooseCampus(nextCampus); setSelectedId(buildingId); setToolPanel('none'); setPanelsHidden(false); }} /></Suspense></div>}
      {toolPanel === 'view' && <div className="tool-content"><p>Choose the light and the detail you want to see.</p><div className="tool-buttons"><button className="secondary-button" onClick={() => setHour(13.5)}>Day</button><button className="secondary-button" onClick={() => setHour(18)}>Dusk</button><button className="secondary-button" onClick={() => setHour(22)}>Night</button></div><div className="scene-options"><label><input type="checkbox" checked={trees} onChange={event => setTrees(event.target.checked)} /> Trees</label><label><input type="checkbox" checked={cityContext} onChange={event => setCityContext(event.target.checked)} /> Surrounding buildings</label><label><input type="checkbox" checked={heatmap} onChange={event => setHeatmap(event.target.checked)} /> Occupancy heatmap</label><label><input type="checkbox" checked={flow} onChange={event => setFlow(event.target.checked)} /> Student flow animation</label><label><input type="checkbox" checked={tourLoop} onChange={event => setTourLoop(event.target.checked)} /> Loop guided tour</label></div><button className="primary-button" onClick={() => startTour(tourLoop)}>Start guided tour</button><p className="helper-text">ElevenLabs narration and ambience are generated assets. Reduced-motion preferences are respected.</p></div>}
      {toolPanel === 'exports'  && <div className="tool-content"><p>Download the current schematic and open the official university map to check details.</p><button className="tool-action" onClick={exportPdf}><FileText size={20} /><span><strong>Vector PDF</strong><small>Buildings, floor counts and estimated occupancy</small></span><Download size={16} /></button><button className="tool-action" onClick={exportGeo}><FileJson size={20} /><span><strong>GeoJSON</strong><small>Approximate building footprints</small></span><Download size={16} /></button><a className="tool-action" href={campus.sourceUrl} target="_blank" rel="noreferrer"><Map size={20} /><span><strong>Official campus map</strong><small>{university.name}</small></span><ArrowUpRight size={16} /></a></div>}
      {toolPanel === 'photo' && <div className="tool-content"><p>Capture the current view or a three-time lighting sequence.</p><div className="tool-buttons"><button className="primary-button" onClick={capture}><Camera size={16} /> Capture view</button><button className="secondary-button" onClick={captureBurst} disabled={photoBusy}>{photoBusy ? 'Capturing…' : 'Day · dusk · night'}</button><button className="secondary-button" disabled={photos.length === 0} onClick={() => void makeContactSheet(photos).then(image => saveDataUrl(image, `campus-explorer-${campus.id}-contact-sheet.png`)).catch(error => setPhotoError((error as Error).message))}>Contact sheet</button></div>{photoError && <p className="lab-message" role="alert">{photoError}</p>}<div className="photo-grid">{photos.map((photo, index) => <button key={`${index}-${photo.slice(-10)}`} onClick={() => saveDataUrl(photo, `campus-explorer-${campus.id}-${index + 1}.png`)} aria-label={`Download photo ${index + 1}`}><img src={photo} alt={`Captured 3D campus view ${index + 1}`} /><span>Download photo {index + 1}</span></button>)}</div>{photos.length === 0 && <p className="empty-state">No photos yet. Capture a view to add it here.</p>}</div>}
      {toolPanel === 'map-lab' && <div className="tool-content"><p>Upload GeoJSON polygons, describe an illustrative three-floor building, or paste a building JSON spec. Imports stay in this browser session.</p><label className="field-label" htmlFor="geojson-file">GeoJSON map file</label><input id="geojson-file" className="file-input" type="file" accept=".geojson,.json,application/geo+json" onChange={event => void importGeoJson(event.target.files?.[0])} /><label className="field-label" htmlFor="building-description">Building description</label><input id="building-description" className="text-input" value={description} onChange={event => setDescription(event.target.value)} placeholder="e.g. Garden study hub" /><button className="secondary-button" onClick={addDescription}>Create illustrative 3D building</button><label className="field-label" htmlFor="blueprint-json">Building JSON</label><textarea id="blueprint-json" value={blueprint} onChange={event => setBlueprint(event.target.value)} spellCheck={false} /><button className="primary-button" onClick={addBlueprint}>Add JSON building to 3D campus</button>{labMessage && <p className="lab-message" role="status">{labMessage}</p>}</div>}
    </div>}

    {floorOpen && selected && <FloorExplorer building={selected} campus={campus} selectedFloor={selectedFloor ?? selected.floors[0].level} hour={hour} onFloor={setSelectedFloor} onClose={() => setFloorOpen(false)} />}
  </main>;
}
