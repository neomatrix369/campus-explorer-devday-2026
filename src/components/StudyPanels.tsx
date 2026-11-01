import { useState } from 'react';
import { ArrowUpRight, BatteryCharging, BookOpen, Droplets, MapPin, Search, Sparkles, X } from 'lucide-react';
import type { CampusBuilding, CampusProfile, FloorZone } from '../data/campusData.ts';
import { formatHour, buildingOccupancy, estimatedNoise, estimatedOccupancy, occupancyBand, rankStudySpaces, type Recommendation } from '../utils/campusLogic.ts';
import { FloorStackSvg } from './FloorExplorer.tsx';

interface LeftProps {
  campus: CampusProfile;
  hour: number;
  recommendation: Recommendation | null;
  usageText: string;
  loading: boolean;
  onAsk: (query: string) => void;
  onSelect: (id: string, floor?: string) => void;
  mobileOpen: boolean;
  onClose: () => void;
}

const examples = ['Find a quiet spot now', 'Quiet study for 2 hours', 'Group of 4, need to talk', 'Quiet seat with charging and water'];

export function LeftRail({ campus, hour, recommendation, usageText, loading, onAsk, onSelect, mobileOpen, onClose }: LeftProps) {
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [duration, setDuration] = useState('2');
  const [studyType, setStudyType] = useState('Quiet');
  const [needsSocket, setNeedsSocket] = useState(false);
  const [needsWater, setNeedsWater] = useState(false);
  const top = rankStudySpaces(campus.buildings, hour).slice(0, 4);
  const matching = search.trim() ? campus.buildings.filter(building => building.name.toLowerCase().includes(search.toLowerCase()) || building.shortCode.toLowerCase().includes(search.toLowerCase())) : [];
  const ask = (text: string) => { setQuery(text); onAsk(text); };
  const plan = () => onAsk(`${studyType.toLowerCase()} study for ${duration} hours${needsSocket ? ' with sockets' : ''}${needsWater ? ' and water' : ''}`);

  return <aside className={`left-rail ${mobileOpen ? 'mobile-open' : ''}`} aria-label="Find a study space">
    <div className="mobile-panel-heading"><strong>Find a space</strong><button className="icon-button" onClick={onClose} aria-label="Close finder"><X size={18} /></button></div>
    <div className="search-wrap">
      <Search size={18} aria-hidden="true" />
      <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search a building…" aria-label="Search a building" />
      {search && <button className="clear-search" onClick={() => setSearch('')} aria-label="Clear building search"><X size={15} /></button>}
      {matching.length > 0 && <div className="search-results">{matching.map(building => <button key={building.id} onClick={() => { onSelect(building.id); setSearch(''); }}><MapPin size={14} />{building.name}</button>)}</div>}
      {search && matching.length === 0 && <div className="search-results empty">No matching building on this campus.</div>}
    </div>

    <section className="panel ai-panel">
      <div className="panel-title"><Sparkles size={16} aria-hidden="true" /><h2>Ask where to go</h2></div>
      <form className="ask-row" onSubmit={event => { event.preventDefault(); if (query.trim()) onAsk(query.trim()); }}>
        <input value={query} onChange={event => setQuery(event.target.value)} placeholder="e.g. quiet study for 2 hours" aria-label="Ask for a study space" />
        <button className="primary-button" disabled={loading || !query.trim()}>{loading ? 'Finding…' : 'Ask'}</button>
      </form>
      <div className="example-chips">{examples.map(example => <button key={example} onClick={() => ask(example)}>{example}</button>)}</div>
      {recommendation && <div className="answer-card" role="status">
        <span className="eyebrow">{recommendation.match ? 'Suggested floor · estimated' : 'Your requirements kept'}</span>
        <strong>{recommendation.headline}</strong>
        <p>{recommendation.explanation}</p>
        {usageText && <small className="usage-line">AI usage: {usageText}</small>}
        {recommendation.match && <button className="text-button" onClick={() => onSelect(recommendation.match!.building.id, recommendation.match!.floor.level)}>Show in 3D <ArrowUpRight size={14} /></button>}
      </div>}
    </section>

    <section className="panel planner-panel">
      <div className="panel-title"><BookOpen size={16} aria-hidden="true" /><h2>Plan my study time</h2></div>
      <div className="planner-row">
        <label className="sr-only" htmlFor="duration">Duration</label><select id="duration" value={duration} onChange={event => setDuration(event.target.value)}><option value="1">1 h</option><option value="2">2 h</option><option value="3">3 h</option><option value="4">4 h</option></select>
        <label className="sr-only" htmlFor="study-type">Study style</label><select id="study-type" value={studyType} onChange={event => setStudyType(event.target.value)}><option>Silent</option><option>Quiet</option><option>Group</option></select>
        <button className="primary-button" onClick={plan}>Plan</button>
      </div>
      <div className="check-row"><label><input type="checkbox" checked={needsSocket} onChange={event => setNeedsSocket(event.target.checked)} /> <BatteryCharging size={15} /> Charging</label><label><input type="checkbox" checked={needsWater} onChange={event => setNeedsWater(event.target.checked)} /> <Droplets size={15} /> Water</label></div>
      <p className="helper-text">Compare study floors at the selected time. Access, seating and noise are estimates; check the university source before you travel.</p>
    </section>

    <section className="panel quiet-list">
      <div className="panel-title"><span className="quiet-mark" /><h2>Quietest spots at {formatHour(hour)}</h2></div>
      {top.length ? top.map(spot => <button className="spot-row" key={`${spot.building.id}-${spot.floor.level}`} onClick={() => onSelect(spot.building.id, spot.floor.level)}>
        <span className={`spot-accent ${occupancyBand(spot.occupancy)}`} />
        <span className="spot-copy"><strong>{spot.building.name}</strong><small>Floor {spot.floor.level} · {spot.floor.type} · ~{spot.seatsFree} seats free</small></span>
        <span className="spot-percent">{spot.occupancy}%</span>
      </button>) : <p className="helper-text">No open study space at this time. Move the time slider to compare another hour.</p>}
    </section>
  </aside>;
}

interface InspectorProps {
  campus: CampusProfile;
  building: CampusBuilding;
  hour: number;
  selectedFloor: string | null;
  onFloor: (level: string) => void;
  onExpand: () => void;
  onClose: () => void;
}

export function BuildingInspector({ campus, building, hour, selectedFloor, onFloor, onExpand, onClose }: InspectorProps) {
  const occupancy = buildingOccupancy(building, hour);
  const selected = building.floors.find(floor => floor.level === selectedFloor) ?? building.floors[0];
  return <aside className="inspector panel" aria-label={`Details for ${building.name}`}>
    <div className="inspector-heading"><div><span className="eyebrow">{building.category}</span><h2>{building.name}</h2></div><button className="icon-button" onClick={onClose} aria-label="Close building details"><X size={19} /></button></div>
    {building.studyUseUnverified && <p className="inspector-note">Imported geometry only. Study access, seating, amenities and noise are unknown; this building is excluded from recommendations.</p>}
    <div className="status-line"><span className={`status-pill ${occupancyBand(occupancy)}`}>{occupancyBand(occupancy)} · {occupancy}% occupied</span><span className="status-pill neutral">Simulated estimate</span></div>
    <p className="inspector-note">Choose a floor to see its estimated seats, noise and amenities.</p>
    <div className="stack-preview"><FloorStackSvg building={building} selectedFloor={selected.level} hour={hour} onSelect={onFloor} /></div>
    <button className="full-button" onClick={onExpand}>Open floor explorer <ArrowUpRight size={16} /></button>
    <div className="floor-list">{building.floors.slice().reverse().map(floor => <FloorRow key={floor.level} floor={floor} hour={hour} selected={floor.level === selected.level} onClick={() => onFloor(floor.level)} />)}</div>
    <div className="inspector-sources"><strong>Before you go</strong><p>{building.hoursLabel}. These floor details are a demo estimate, not live availability.</p><a href={campus.sourceUrl} target="_blank" rel="noreferrer">Official campus map <ArrowUpRight size={14} /></a>{campus.bookingUrl && <a href={campus.bookingUrl} target="_blank" rel="noreferrer">University booking information <ArrowUpRight size={14} /></a>}</div>
  </aside>;
}

function FloorRow({ floor, hour, selected, onClick }: { floor: FloorZone; hour: number; selected: boolean; onClick: () => void }) {
  const occupancy = estimatedOccupancy(floor, hour);
  const free = Math.round(floor.seats * (1 - occupancy / 100));
  return <button className={`floor-row ${selected ? 'selected' : ''}`} onClick={onClick} aria-pressed={selected}>
    <span className="floor-number">{floor.level}</span>
    <span className="floor-copy"><strong>{floor.name}</strong><small>{floor.type} · ~{free} free · ~{estimatedNoise(floor, occupancy)} dB</small></span>
    <span className="floor-amenities">{floor.sockets && <BatteryCharging size={15} aria-label="Charging" />}{floor.water && <Droplets size={15} aria-label="Water" />}</span>
    <span className="floor-bar"><span style={{ width: `${occupancy}%` }} /></span>
  </button>;
}
