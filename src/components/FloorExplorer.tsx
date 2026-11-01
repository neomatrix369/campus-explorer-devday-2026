import { useEffect, useRef } from 'react';
import { ArrowUpRight, BatteryCharging, Droplets, Volume2, X } from 'lucide-react';
import { FloorScene3D } from './FloorScene3D.tsx';
import { floorLayout } from '../utils/floorLayout.ts';
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
      return <g key={floor.level} role="button" tabIndex={0} aria-label={`Select floor ${floor.level}, ${floor.name}`} onClick={() => onSelect(floor.level)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(floor.level); } }} className={`stack-level ${active ? 'active' : ''}`}>
        <polygon points={`65,${y + 30} 180,${y} 290,${y + 28} 175,${y + 58}`} fill={color} stroke={active ? '#564be3' : '#9f927e'} strokeWidth={active ? 3 : 1} />
        <polygon points={`65,${y + 30} 175,${y + 58} 175,${y + 66} 65,${y + 38}`} fill="url(#stack-side)" opacity=".85" />
        <polygon points={`175,${y + 58} 290,${y + 28} 290,${y + 36} 175,${y + 66}`} fill="#b6a588" opacity=".9" />
        <g transform={`translate(180 ${y + 4}) matrix(1 .25 -1 .26 0 0)`}>
          {Array.from({ length: 12 }, (_, desk) => <rect key={desk} x={desk % 4 * 24 - 82} y={Math.floor(desk / 4) * 26 + 15} width="12" height="9" fill="#94795b" stroke="#fff6dc" strokeWidth="1" />)}
        </g>
        <text x="304" y={y + 31} className="svg-floor-name">{occupancy}%</text>
        <text x="52" y={y + 35} textAnchor="end" className="svg-floor-name">{floor.level}</text>
      </g>;
    })}
  </svg>;
}

function FloorPlan({ building, floor, occupancy }: { building: CampusBuilding; floor: CampusBuilding['floors'][number]; occupancy: number }) {
  const { width, depth, desks, pods } = floorLayout(building, floor, occupancy);
  const scale = Math.min(370 / width, 205 / depth);
  const x = (value: number): number => 240 + value * scale;
  const y = (value: number): number => 142 + value * scale;
  return <svg className="plan-svg" viewBox="0 0 480 300" role="img" aria-label={`Illustrative ${floor.type.toLowerCase()} floor plan with desks and lift core`}>
    <rect width="480" height="300" rx="18" fill="#e8ecee" />
    <rect x={x(-width / 2)} y={y(-depth / 2)} width={width * scale} height={depth * scale} fill="#f2dfbd" stroke="#37404d" strokeWidth="5" />
    <rect x={x(-width * .39)} y={y(-depth * .425)} width={width * .18 * scale} height={depth * .15 * scale} fill="#a6b2c4" />
    <text x={x(-width * .3)} y={y(-depth * .3)} textAnchor="middle" fontSize="9">Lift / stairs</text>
    {floor.type === 'Silent' && <rect x={x(-width * .075)} y={y(-depth * .43)} width={width * .45 * scale} height={.8 * scale} fill="#94795b" />}
    {desks.map((desk, index) => <g key={index}>
      <rect x={x(desk.x) - (desk.group ? 1 : .8) * scale} y={y(desk.z) - (desk.group ? .8 : .425) * scale} width={(desk.group ? 2 : 1.6) * scale} height={(desk.group ? 1.6 : .85) * scale} rx="2" fill="#b99a72" />
      <circle cx={x(desk.x)} cy={y(desk.z + .8)} r="4" fill={desk.occupied ? '#455067' : '#fffaf0'} />
      {desk.group && <circle cx={x(desk.x)} cy={y(desk.z - .95)} r="4" fill={desk.occupied ? '#455067' : '#fffaf0'} />}
    </g>)}
    {pods.map((pod, index) => <g key={index}><rect x={x(pod.x - width * .09)} y={y(pod.z - depth * .09)} width={width * .18 * scale} height={depth * .18 * scale} fill="#c9e0e5" stroke="#76a3ad" strokeWidth="2" /><rect x={x(pod.x) - 6} y={y(pod.z) - 4} width="12" height="8" fill="#b99a72" /></g>)}
    {floor.water && <text x={x(width * .38)} y={y(-depth * .35)} textAnchor="middle" fontSize="16">💧</text>}
    {floor.sockets && <text x={x(width * .28)} y={y(-depth * .35)} textAnchor="middle" fontSize="16">⚡</text>}
    <text x="240" y="278" textAnchor="middle" className="plan-label">{floor.type} study · illustrative layout</text>
  </svg>;
}

export function FloorExplorer({ building, campus, selectedFloor, hour, onFloor, onClose }: { building: CampusBuilding; campus: CampusProfile; selectedFloor: string; hour: number; onFloor: (floor: string) => void; onClose: () => void }) {
  const closeButton = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const floor = building.floors.find(item => item.level === selectedFloor) ?? building.floors[0];
  const occupancy = estimatedOccupancy(floor, hour);
  const free = Math.round(floor.seats * (1 - occupancy / 100));
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    closeButton.current?.focus();
    return () => previous?.focus();
  }, []);
  useEffect(() => {
    dialog.current?.querySelector('.floor-tabs button.active')?.scrollIntoView({ block: 'nearest', inline: 'center' });
  }, [floor.level]);
  return <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div ref={dialog} className="floor-modal" onKeyDown={event => {
      if (event.key !== 'Tab') return;
      const focusable = Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], [tabindex="0"]') ?? []);
      const first = focusable[0]; const last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }} role="dialog" aria-modal="true" aria-label={`${building.name} floor explorer`}>
      <div className="floor-modal-header"><div><h2>{building.name}</h2><p>{occupancyBand(occupancy)} on this floor · estimated occupancy</p></div><div className="floor-tabs">{building.floors.slice().reverse().map(item => <button key={item.level} className={item.level === floor.level ? 'active' : ''} onClick={() => onFloor(item.level)}>{item.level} <span>{estimatedOccupancy(item, hour)}%</span></button>)}</div><button ref={closeButton} className="icon-button" onClick={onClose} aria-label="Close floor explorer"><X size={20} /></button></div>
      <div className="floor-modal-body"><section className="floor-visual"><div className="modal-section-heading"><strong>Furnished floor cutaway</strong><span>Drag to rotate · scroll to zoom</span></div><FloorScene3D building={building} selectedFloor={floor.level} hour={hour} onSelect={onFloor} /><p>Illustrative furniture, shared with the 2D plan. {building.floors.some(item => item.level.startsWith('B')) ? 'B levels sit below the street-level rim.' : 'Other levels are faded.'} Choose a floor from the tabs or 3D stack.</p></section>
      <section className="floor-plan-section"><div className="modal-section-heading"><strong>Floor {floor.level} · {floor.name}</strong><span>2D schematic</span></div><FloorPlan building={building} floor={floor} occupancy={occupancy} />
        <div className="plan-legend"><span><i className="legend-desk" /> Desks</span><span><i className="legend-person" /> Occupied estimate</span><span><i className="legend-pod" /> Lift / stairs</span></div>
        <div className="floor-kpis"><div><strong>{occupancy}%</strong><span>occupied est.</span></div><div><strong>~{free}</strong><span>seats free</span></div><div><strong>~{estimatedNoise(floor, occupancy)} dB</strong><span>noise est.</span></div><div><strong>{floor.sockets ? <BatteryCharging size={20} /> : '—'}</strong><span>charging est.</span></div><div><strong>{floor.water ? <Droplets size={20} /> : '—'}</strong><span>water est.</span></div></div>
        <div className="floor-meta"><Volume2 size={17} /><p>Seat and noise figures use time-of-day simulation. Amenities and opening hours are unverified. Confirm with the official university map before travelling.</p></div>
        <div className="floor-links"><a href={campus.sourceUrl} target="_blank" rel="noreferrer">Official campus map <ArrowUpRight size={14} /></a>{campus.bookingUrl && <a href={campus.bookingUrl} target="_blank" rel="noreferrer">Booking information <ArrowUpRight size={14} /></a>}</div>
      </section></div>
    </div>
  </div>;
}
