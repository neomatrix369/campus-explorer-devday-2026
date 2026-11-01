import { CAMPUS_CENTERS, UNIVERSITIES } from '../data/campusData.ts';

export function LondonOverview({ selectedCampus, onSelect }: { selectedCampus: string; onSelect: (id: string) => void }) {
  const campuses = UNIVERSITIES.flatMap(university => university.campuses.map(campus => ({ ...campus, university: university.shortName })));
  const point = (id: string): [number, number] => {
    const [lng, lat] = CAMPUS_CENTERS[id];
    return [40 + (lng + .24) / .24 * 390, 235 - (lat - 51.49) / .06 * 205];
  };
  return <div className="london-overview">
    <p>Seven campuses, one place to start. Choose a campus to explore its buildings and study floors.</p>
    <svg viewBox="0 0 480 290" role="img" aria-label="Schematic locations of seven university campuses across London">
      <rect width="480" height="290" rx="18" fill="#edf0e8" />
      <path d="M0 235Q90 285 140 245T245 230Q270 130 305 170T350 230Q410 275 480 200" fill="none" stroke="#b1d3df" strokeWidth="14" />
      <text x="345" y="262" fill="#527a8b" fontSize="11">River Thames · schematic</text>
      {campuses.map(campus => {
        const [x, y] = point(campus.id);
        return <g key={campus.id} role="button" tabIndex={0} aria-label={`Explore ${campus.university} ${campus.name}`} onClick={() => onSelect(campus.id)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(campus.id); } }}>
          <circle cx={x} cy={y} r={campus.id === selectedCampus ? 10 : 7} fill="#5b4bd8" stroke="white" strokeWidth="3" />
          <text x={x + (campus.id === 'lse-aldwych' ? 12 : 0)} y={y + (campus.id === 'kcl-strand' ? 24 : -14)} textAnchor={campus.id === 'lse-aldwych' ? 'start' : 'middle'} fontSize="11" fontWeight="700" fill="#303445">{campus.university}</text>
        </g>;
      })}
    </svg>
    <div className="campus-overview-list">{campuses.map(campus => <button key={campus.id} onClick={() => onSelect(campus.id)} aria-pressed={selectedCampus === campus.id}><span><strong>{campus.university} · {campus.name}</strong><small>{campus.location}</small></span><span>{campus.buildings.length} buildings →</span></button>)}</div>
    <p className="helper-text">Campus positions are approximate. Open each university’s official map for navigation.</p>
  </div>;
}
