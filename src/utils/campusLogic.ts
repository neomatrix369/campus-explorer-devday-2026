import type { CampusBuilding, FloorZone, QuietType } from '../data/campusData.ts';

export interface StudyPreference {
  maxNoise?: number;
  minSeats?: number;
  type?: QuietType | 'Any';
  sockets?: boolean;
  water?: boolean;
  openNow?: boolean;
  search?: string;
}

export interface RankedSpot {
  building: CampusBuilding;
  floor: FloorZone;
  occupancy: number;
  seatsFree: number;
  noise: number;
  score: number;
  open: boolean;
}

export interface Recommendation {
  headline: string;
  explanation: string;
  match: RankedSpot | null;
  criteria: string[];
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function formatHour(hour: number): string {
  const minutes = Math.round(((hour % 24 + 24) % 24) * 60);
  return `${String(Math.floor(minutes / 60) % 24).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

export function isOpenAt(building: CampusBuilding, hour: number): boolean {
  if (!building.hours) return true;
  const h = (hour % 24 + 24) % 24;
  const [start, end] = building.hours;
  return start <= end ? h >= start && h < end : h >= start || h < end;
}

export function estimatedOccupancy(floor: FloorZone, hour: number): number {
  const h = (hour % 24 + 24) % 24;
  const midday = Math.exp(-Math.pow((h - 14) / 4.6, 2));
  const evening = Math.exp(-Math.pow((h - 20) / 3.5, 2));
  const night = Math.exp(-Math.pow((h - 2) / 3, 2));
  const rhythm = 0.36 + 0.55 * midday + 0.25 * evening + 0.08 * night;
  return clamp(Math.round(floor.baseOccupancy * rhythm * 100), 8, 96);
}

export function estimatedNoise(floor: FloorZone, occupancy: number): number {
  return Math.round(floor.noiseDba + (occupancy - 50) * (floor.type === 'Group' ? 0.16 : 0.07));
}

export function occupancyBand(occupancy: number): 'quiet' | 'moderate' | 'busy' {
  if (occupancy < 45) return 'quiet';
  if (occupancy < 71) return 'moderate';
  return 'busy';
}

export function buildingOccupancy(building: CampusBuilding, hour: number): number {
  if (!building.floors.length) return 0;
  const total = building.floors.reduce((sum, floor) => sum + floor.seats, 0);
  if (!total) return 0;
  return Math.round(building.floors.reduce((sum, floor) => sum + floor.seats * estimatedOccupancy(floor, hour), 0) / total);
}

export function rankStudySpaces(buildings: CampusBuilding[], hour: number, preference: StudyPreference = {}): RankedSpot[] {
  const search = preference.search?.trim().toLowerCase() ?? '';
  return buildings.flatMap(building => building.floors.flatMap(floor => {
    const open = isOpenAt(building, hour);
    const occupancy = estimatedOccupancy(floor, hour);
    const seatsFree = Math.round(floor.seats * (1 - occupancy / 100));
    const noise = estimatedNoise(floor, occupancy);
    const haystack = `${building.name} ${building.shortCode} ${building.category} ${floor.name}`.toLowerCase();
    if (preference.openNow !== false && !open) return [];
    if (preference.type && preference.type !== 'Any' && floor.type !== preference.type) return [];
    if (preference.sockets && !floor.sockets) return [];
    if (preference.water && !floor.water) return [];
    if (preference.maxNoise && noise > preference.maxNoise) return [];
    if (preference.minSeats && seatsFree < preference.minSeats) return [];
    if (search && !haystack.includes(search)) return [];
    const score = Math.round((75 - noise) * 1.55 + seatsFree * .31 + (floor.sockets ? 5 : 0) + (building.hours === null ? 7 : 0) - occupancy * .18);
    return [{ building, floor, occupancy, seatsFree, noise, score, open }];
  })).sort((a, b) => b.score - a.score || a.noise - b.noise);
}

export function parseStudyQuery(query: string): StudyPreference {
  const lower = query.toLowerCase();
  const groupSize = lower.match(/(?:group of|for)\s+(\d+)/);
  const silent = /silent|no talking|deep focus/.test(lower);
  const group = /group|chat|talk|collaborat/.test(lower);
  return {
    type: silent ? 'Silent' : group ? 'Group' : /quiet|calm|focus/.test(lower) ? 'Quiet' : 'Any',
    minSeats: groupSize ? Number(groupSize[1]) : 1,
    sockets: /socket|outlet|charging|power|plug/.test(lower),
    water: /water|refill/.test(lower),
    openNow: true,
  };
}

export function spotCriteria(spot: RankedSpot): string[] {
  const criteria = [spot.floor.type.toLowerCase(), `${spot.seatsFree} estimated seats free`, `${spot.noise} dB estimated noise`];
  if (spot.floor.sockets) criteria.push('sockets');
  if (spot.floor.water) criteria.push('water');
  return criteria;
}

export function explainStudySpot(spot: RankedSpot, hour: number): string {
  return `${spot.floor.name} has ${spotCriteria(spot).join(', ')} at ${formatHour(hour)}. Check the official campus page before travelling.`;
}

export function recommendStudySpot(query: string, buildings: CampusBuilding[], hour: number): Recommendation {
  const preference = parseStudyQuery(query);
  const matches = rankStudySpaces(buildings, hour, preference);
  const fallback = matches.length ? matches : rankStudySpaces(buildings, hour);
  const match = fallback[0] ?? null;
  if (!match) return { headline: 'No study spaces found', explanation: 'Try another campus or time.', match: null, criteria: [] };
  const criteria = spotCriteria(match);
  const explanation = explainStudySpot(match, hour);
  return { headline: `${match.building.name} · ${match.floor.level}`, explanation, match, criteria };
}

export function sunState(hour: number): { phase: 'day' | 'dusk' | 'night'; sky: string; light: number; windowGlow: number } {
  const h = (hour % 24 + 24) % 24;
  if (h < 6 || h >= 19.5) return { phase: 'night', sky: '#1b263a', light: .5, windowGlow: .8 };
  if (h < 8 || h >= 17.5) return { phase: 'dusk', sky: '#c7ced8', light: 1.1, windowGlow: .38 };
  return { phase: 'day', sky: '#e8edf0', light: 1.65, windowGlow: .02 };
}
