import { useEffect, useRef } from 'react';
import { ArrowUpRight, BatteryCharging, Droplets, Volume2, X } from 'lucide-react';
import type { CampusBuilding, CampusProfile } from '../data/campusData.ts';
import { estimatedNoise, estimatedOccupancy, occupancyBand } from '../utils/campusLogic.ts';

export function FloorStackSvg({ building, selectedFloor, hour, onSelect }: { building: CampusBuilding; selectedFloor: string; hour: number; onSelect: (floor: string) => void }) {
  const floors = building.floors.slice().reverse();
  const gap = Math.min(27, 190 / floors.length);
  const startY = (260 - (floors.length - 1) * gap - 66) / 2;
  return <svg className="floor-stack-svg" viewBox="0 0 350 260" role="img" aria-label={`Stack of ${building.name} floors`}>
    <defs><linearGradient id="stack-side" x1="0" x2="1" y1="0" y2="1"><stop stopColor="#c9b792"/><stop offset="1" stopColor="#9f8e73"/></linearGradient></defs>
    {floors.map((floor, index) => {
      const y = startY + index * gap;
      const occupancy = estimatedOccupancy(floor, hour);
      const color = occupancyBand(occupancy) === 'quiet' ? '#b5cb94' : occupancyBand(occupancy) === 'moderate' ? '#e5bd75' : '#dc9b76';
      const active = selectedFloor === floor.level;
      return <g key={floor.level} role="button" tabIndex={0} aria-label={`Select floor ${floor.level}, ${floor.name}`} onClick={() => onSelect(floor.level)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') onSelect(floor.level); }} className={`stack-level ${active ? 'active' : ''}`}>
        <polygon points={`65,${y + 30} 180,${y} 290,${y + 28} 175,${y + 58}`} fill={color} stroke={active ? '#564be3' : '#9f927e'} strokeWidth={active ? 3 : 1} />
        <polygon points={`65,${y + 30} 175,${y + 58} 175,${y + 66} 65,${y + 38}`} fill="url(#stack-side)" opacity=".85" />
        <polygon points={`175,${y + 58} 290,${y + 28} 290,${y + 36} 175,${y + 66}`} fill="#b6a588" opacity=".9" />
        <text x="52" y={y + 35} textAnchor="end" className="svg-floor-name">{floor.level}</text>
      </g>;
    })}
  </svg>;
}

function FloorPlan({ type, occupancy }: { type: string; occupancy: number }) {
  const desks = Array.from({ length: 20 }, (_, index) => ({ x: 116 + (index % 5) * 38, y: 72 + Math.floor(index / 5) * 36 }));
  const pods = Array.from({ length: 6 }, (_, index) => ({ x: 326 + (index % 2) * 38, y: 64 + Math.floor(index / 2) * 60 }));
  return <svg className="plan-svg" viewBox="0 0 480 300" role="img" aria-label="Schematic floor plan with desks, a cafe and group rooms">
    <rect width="480" height="300" rx="18" fill="#e8ecee" />
    <path d="M35 116H98V38H436V238H352V266H35Z" fill="#f2dfbd" stroke="#37404d" strokeWidth="6" strokeLinejoin="round" />
    <path d="M99 48V254M313 48V252" stroke="#b6a47e" strokeWidth="2" strokeDasharray="8 7" />
    <path d="M45 114H96V251H44Z" fill="#e7c68a" opacity=".66" />
    {desks.map((desk, index) => <g key={index}><rect x={desk.x} y={desk.y} width="19" height="12" rx="2" fill="#b99c76" /><circle cx={desk.x + 8} cy={desk.y + 18} r="4" fill={index < occupancy / 7 ? '#45526a' : '#fffaf0'} /></g>)}
    {pods.map((pod, index) => <g key={index}><rect x={pod.x} y={pod.y} width="31" height="42" fill="#e1edf0" stroke="#76a3ad" strokeWidth="2" /><rect x={pod.x + 9} y={pod.y + 13} width="13" height="12" fill="#bac0b8" /><circle cx={pod.x + 15} cy={pod.y + 7} r="3" fill={index < occupancy / 18 ? '#45526a' : '#fffaf0'} /></g>)}
    {Array.from({ length: 10 }, (_, index) => <g key={index}><circle cx={49 + index % 3 * 18} cy={134 + Math.floor(index / 3) * 27} r="8" fill="#fbf5e6" stroke="#c1aa82" /><circle cx={49 + index % 3 * 18} cy={134 + Math.floor(index / 3) * 27 + 11} r="3" fill={index < occupancy / 12 ? '#45526a' : '#fffaf0'} /></g>)}
    <text x="65" y="225" textAnchor="middle" className="plan-label">Café</text>
    <text x="206" y="224" textAnchor="middle" className="plan-label">{type} study</text>
    <text x="373" y="225" textAnchor="middle" className="plan-label">Group rooms</text>
  </svg>;
}

export function FloorExplorer({ building, campus, selectedFloor, hour, onFloor, onClose }: { building: CampusBuilding; campus: CampusProfile; selectedFloor: string; hour: number; onFloor: (floor: string) => void; onClose: () => void }) {
  const closeButton = useRef<HTMLButtonElement>(null);
  const floor = building.floors.find(item => item.level === selectedFloor) ?? building.floors[0];
  const occupancy = estimatedOccupancy(floor, hour);
  const free = Math.round(floor.seats * (1 - occupancy / 100));
  useEffect(() => { closeButton.current?.focus(); }, []);
  return <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="floor-modal" role="dialog" aria-modal="true" aria-label={`${building.name} floor explorer`}>
      <div className="floor-modal-header"><div><h2>{building.name}</h2><p>{occupancyBand(occupancy)} overall · estimated occupancy</p></div><div className="floor-tabs">{building.floors.slice().reverse().map(item => <button key={item.level} className={item.level === floor.level ? 'active' : ''} onClick={() => onFloor(item.level)}>{item.level} <span>{estimatedOccupancy(item, hour)}%</span></button>)}</div><button ref={closeButton} className="icon-button" onClick={onClose} aria-label="Close floor explorer"><X size={20} /></button></div>
      <div className="floor-modal-body"><section className="floor-visual"><div className="modal-section-heading"><strong>3D floor stack</strong><span>Click any level</span></div><div className="large-stack"><FloorStackSvg building={building} selectedFloor={floor.level} hour={hour} onSelect={onFloor} /></div><p>Conceptual floor stack. Building shape and floor layout are schematic.</p></section>
      <section className="floor-plan-section"><div className="modal-section-heading"><strong>Floor {floor.level} · {floor.name}</strong><span>2D schematic</span></div><FloorPlan type={floor.type} occupancy={occupancy} />
        <div className="plan-legend"><span><i className="legend-desk" /> Desks</span><span><i className="legend-person" /> Occupied estimate</span><span><i className="legend-pod" /> Group room</span></div>
        <div className="floor-kpis"><div><strong>{occupancy}%</strong><span>occupied est.</span></div><div><strong>~{free}</strong><span>seats free</span></div><div><strong>~{estimatedNoise(floor, occupancy)} dB</strong><span>noise est.</span></div><div><strong>{floor.sockets ? <BatteryCharging size={20} /> : '—'}</strong><span>charging est.</span></div><div><strong>{floor.water ? <Droplets size={20} /> : '—'}</strong><span>water est.</span></div></div>
        <div className="floor-meta"><Volume2 size={17} /><p>Seat and noise figures use time-of-day simulation. Amenities and opening hours are unverified. Confirm with the official university map before travelling.</p></div>
        <div className="floor-links"><a href={campus.sourceUrl} target="_blank" rel="noreferrer">Official campus map <ArrowUpRight size={14} /></a>{campus.bookingUrl && <a href={campus.bookingUrl} target="_blank" rel="noreferrer">Booking information <ArrowUpRight size={14} /></a>}</div>
      </section></div>
    </div>
  </div>;
}
