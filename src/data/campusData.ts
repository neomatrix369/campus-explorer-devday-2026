export type QuietType = 'Silent' | 'Quiet' | 'Group';
export type BuildingStyle = 'classical' | 'glass' | 'brick' | 'library' | 'tower' | 'modern';

export interface FloorZone {
  level: string;
  name: string;
  type: QuietType;
  seats: number;
  baseOccupancy: number;
  noiseDba: number;
  sockets: boolean;
  water: boolean;
  bookable: boolean;
}

export interface CampusBuilding {
  id: string;
  name: string;
  shortCode: string;
  category: string;
  position: [number, number];
  dimensions: [number, number, number];
  style: BuildingStyle;
  color: string;
  hours: [number, number] | null;
  hoursLabel: string;
  floors: FloorZone[];
  schematic?: boolean;
  footprint?: [number, number][];
  footprintHoles?: [number, number][][];
  sourceGeometry?: { type: 'Polygon'; coordinates: [number, number][][] };
  sourceProperties?: Record<string, unknown>;
  studyUseUnverified?: boolean;
}

export interface CampusProfile {
  id: string;
  name: string;
  location: string;
  sourceUrl: string;
  bookingUrl?: string;
  buildings: CampusBuilding[];
}

export interface UniversityProfile {
  id: string;
  shortName: string;
  name: string;
  campuses: CampusProfile[];
}

interface BuildingSeed {
  id: string;
  name: string;
  code: string;
  category: string;
  x: number;
  z: number;
  w?: number;
  d?: number;
  h?: number;
  style?: BuildingStyle;
  color?: string;
  hours?: [number, number] | null;
  floors?: FloorZone[];
}

const floor = (level: string, name: string, type: QuietType, seats: number, baseOccupancy: number, noiseDba: number, sockets = true, water = false, bookable = false): FloorZone => ({
  level, name, type, seats, baseOccupancy, noiseDba, sockets, water, bookable,
});

function building(seed: BuildingSeed): CampusBuilding {
  const hours = seed.hours === undefined ? [8, 23] as [number, number] : seed.hours;
  return {
    id: seed.id,
    name: seed.name,
    shortCode: seed.code,
    category: seed.category,
    position: [seed.x, seed.z],
    dimensions: [seed.w ?? 15, seed.h ?? 18, seed.d ?? 13],
    style: seed.style ?? 'brick',
    color: seed.color ?? '#ccb9a6',
    hours,
    hoursLabel: hours === null ? '24-hour access assumed for this demo (verify)' : `Hours assumed ${String(hours[0]).padStart(2, '0')}:00–${String(hours[1]).padStart(2, '0')}:00 (verify)`,
    floors: seed.floors ?? [
      floor('G', 'Ground floor commons', 'Group', 48, 0.55, 52, true, true),
      floor('1', 'Quiet study', 'Quiet', 70, 0.44, 42, true, true),
      floor('2', 'Silent reading', 'Silent', 64, 0.36, 33, true, false),
    ],
  };
}

const uclSource = 'https://maps.ucl.ac.uk/downloads/';
const kclSource = 'https://www.kcl.ac.uk/assets/pdf24/strand-campus-map-2025.pdf';
const imperialSource = 'https://www.imperial.ac.uk/study/visit/undergraduate/open-days/campus-map/';
const lseSource = 'https://www.lse.ac.uk/lse-information/campus-map';

export const UNIVERSITIES: UniversityProfile[] = [
  {
    id: 'ucl', shortName: 'UCL', name: 'University College London', campuses: [
      { id: 'ucl-bloomsbury', name: 'Bloomsbury', location: 'Gower Street · WC1E', sourceUrl: uclSource, bookingUrl: 'https://library-calendars.ucl.ac.uk/', buildings: [
        building({ id: 'ucl-wilkins', name: 'Main Library (Wilkins)', code: 'WIL', category: 'Library', x: -28, z: 8, w: 28, d: 19, h: 17, style: 'classical', color: '#d9c8ac', floors: [floor('G', 'Main Quad entrance', 'Group', 45, .6, 49), floor('1', 'Main Library reading room', 'Quiet', 90, .52, 39, true, true, true), floor('2', 'Donaldson Reading Room', 'Silent', 76, .44, 29, true, false, true)] }),
        building({ id: 'ucl-student-centre', name: 'Student Centre', code: 'USC', category: 'Study centre', x: 18, z: -11, w: 27, d: 21, h: 29, style: 'glass', color: '#9faeaa', hours: null, floors: [
          floor('B2', 'Lower study lounge', 'Quiet', 72, .39, 40, true, true), floor('B1', 'Bookable quiet study', 'Quiet', 60, .68, 40, true, true, true),
          floor('G', 'Welcome and group tables', 'Group', 80, .88, 60, true, true), floor('M', 'Mezzanine commons', 'Group', 52, .82, 55, true, true),
          floor('1', 'Group study', 'Group', 88, .86, 58, true, true), floor('2', 'Quiet study', 'Quiet', 116, .68, 43, true, true),
          floor('3', 'Quiet study and group rooms', 'Quiet', 120, .59, 39, true, true, true), floor('4', 'Upper silent study', 'Silent', 96, .85, 34, true, true),
        ] }),
        building({ id: 'ucl-cruciform', name: 'Cruciform Hub', code: 'CRU', category: 'Study hub', x: -51, z: -22, w: 21, d: 17, h: 18, style: 'brick', color: '#b27059', hours: null }),
        building({ id: 'ucl-science-library', name: 'Science Library (DMS Watson)', code: 'SCI', category: 'Library', x: 34, z: 25, w: 20, d: 16, h: 16, style: 'library', color: '#c7b7a6', floors: [floor('G', 'Science Library entrance', 'Group', 46, .6, 51), floor('1', 'Science reading room', 'Quiet', 110, .66, 42), floor('2', 'Silent science study', 'Silent', 92, .47, 31)] }),
        building({ id: 'ucl-bartlett', name: '22 Gordon Street (Bartlett)', code: 'BAR', category: 'Faculty study', x: 49, z: -24, w: 17, d: 15, h: 21, style: 'modern', color: '#a4aaa0' }),
        building({ id: 'ucl-roberts', name: 'Roberts Building', code: 'ROB', category: 'Engineering study', x: 48, z: 12, w: 16, d: 16, h: 19, style: 'modern', color: '#c0bcb1' }),
      ] },
      { id: 'ucl-east', name: 'UCL East', location: 'Queen Elizabeth Olympic Park · E20', sourceUrl: uclSource, buildings: [
        building({ id: 'ucl-marshgate', name: 'Marshgate', code: 'MGT', category: 'Study centre', x: -17, z: 4, w: 29, d: 22, h: 26, style: 'modern', color: '#d3bfa7', hours: null }),
        building({ id: 'ucl-one-pool', name: 'One Pool Street', code: 'OPS', category: 'Study hub', x: 23, z: -14, w: 24, d: 21, h: 24, style: 'glass', color: '#a7b6aa' }),
        building({ id: 'ucl-peoples', name: 'People and Nature Lab', code: 'PEO', category: 'Faculty study', x: 33, z: 23, w: 17, d: 15, h: 17, style: 'modern', color: '#b9c6ab' }),
      ] },
    ],
  },
  { id: 'kcl', shortName: "King's", name: "King's College London", campuses: [
    { id: 'kcl-strand', name: 'Strand', location: 'Strand · WC2R', sourceUrl: kclSource, bookingUrl: 'https://www.kcl.ac.uk/library', buildings: [
      building({ id: 'kcl-maughan', name: 'Maughan Library', code: 'MAU', category: 'Library', x: -30, z: -5, w: 27, d: 22, h: 22, style: 'library', color: '#a76e60', hours: null, floors: [floor('G', 'Pennethorne Gallery', 'Quiet', 95, .51, 39), floor('1', 'Round Reading Room', 'Silent', 110, .41, 27), floor('2', 'Rolls Chapel study', 'Silent', 72, .25, 26)] }),
      building({ id: 'kcl-kings', name: "King's Building", code: 'KBG', category: 'Campus hub', x: 11, z: 10, w: 26, d: 17, h: 21, style: 'classical', color: '#d8c4a7' }),
      building({ id: 'kcl-bush', name: 'Bush House', code: 'BHS', category: 'Study hub', x: 37, z: -18, w: 20, d: 17, h: 25, style: 'modern', color: '#cbbba7' }),
      building({ id: 'kcl-strand', name: 'Strand Building', code: 'STR', category: 'Faculty study', x: -10, z: 31, w: 22, d: 15, h: 19, style: 'glass', color: '#abb9b8' }),
    ] },
    { id: 'kcl-waterloo', name: 'Waterloo', location: 'Waterloo Road · SE1 8WA', sourceUrl: 'https://www.kcl.ac.uk/visit/waterloo-campus', buildings: [
      building({ id: 'kcl-franklin-wilkins', name: 'Franklin-Wilkins Building', code: 'FWB', category: 'Study centre', x: -25, z: 0, w: 29, d: 20, h: 21, style: 'modern', color: '#c1bbae' }),
    ] },
    { id: 'kcl-guys', name: "Guy's", location: 'Great Maze Pond · SE1 1UL', sourceUrl: 'https://www.kcl.ac.uk/visit/guys-campus', buildings: [
      building({ id: 'kcl-new-hunt', name: "New Hunt's House", code: 'NHH', category: 'Library', x: 20, z: -20, w: 21, d: 20, h: 23, style: 'brick', color: '#b77a63' }),
      building({ id: 'kcl-guy', name: "Guy's Tower", code: 'GWT', category: 'Campus hub', x: 24, z: 20, w: 16, d: 16, h: 38, style: 'tower', color: '#b9b8b0' }),
    ] },
  ] },
  { id: 'imperial', shortName: 'Imperial', name: 'Imperial College London', campuses: [
    { id: 'imperial-south-ken', name: 'South Kensington', location: 'Exhibition Road · SW7', sourceUrl: imperialSource, bookingUrl: 'https://www.imperial.ac.uk/admin-services/library/use-the-library/book-a-room/', buildings: [
      building({ id: 'imp-central-library', name: 'Central Library', code: 'ASL', category: 'Library', x: -31, z: -1, w: 24, d: 21, h: 23, style: 'library', color: '#d1c0a7', hours: null }),
      building({ id: 'imp-queens-tower', name: "Queen's Tower", code: 'QTW', category: 'Landmark', x: 6, z: 8, w: 10, d: 10, h: 40, style: 'tower', color: '#c9b397', floors: [floor('G', 'Tower lawn study', 'Group', 28, .32, 47, false, false)] }),
      building({ id: 'imp-huxley', name: 'Huxley Building', code: 'HUX', category: 'Faculty study', x: 37, z: -19, w: 21, d: 19, h: 23, style: 'modern', color: '#b5b9b2' }),
      building({ id: 'imp-city-guilds', name: 'City & Guilds Building', code: 'CAG', category: 'Study hub', x: 27, z: 29, w: 22, d: 17, h: 19, style: 'brick', color: '#bb8c72' }),
    ] },
    { id: 'imperial-white-city', name: 'White City', location: 'Wood Lane · W12', sourceUrl: 'https://www.imperial.ac.uk/white-city-campus/find-us/', buildings: [
      building({ id: 'imp-molecular', name: 'Molecular Sciences Research Hub', code: 'MSR', category: 'Study centre', x: -17, z: -6, w: 28, d: 23, h: 29, style: 'glass', color: '#adbfbf' }),
      building({ id: 'imp-uren', name: 'Sir Michael Uren Hub', code: 'URH', category: 'Campus hub', x: 25, z: 17, w: 24, d: 20, h: 27, style: 'modern', color: '#d0bca4' }),
    ] },
  ] },
  { id: 'lse', shortName: 'LSE', name: 'London School of Economics', campuses: [
    { id: 'lse-aldwych', name: 'Aldwych', location: "Houghton Street · WC2A", sourceUrl: lseSource, bookingUrl: 'https://www.lse.ac.uk/library', buildings: [
      building({ id: 'lse-library', name: 'Lionel Robbins Building (Library)', code: 'LRB', category: 'Library', x: -34, z: -12, w: 24, d: 23, h: 23, style: 'library', color: '#c4b49d', hours: null }),
      building({ id: 'lse-centre', name: 'Centre Building', code: 'CBG', category: 'Study centre', x: -3, z: 18, w: 19, d: 16, h: 30, style: 'glass', color: '#b1c0bd' }),
      building({ id: 'lse-marshall', name: 'Marshall Building', code: 'MAR', category: 'Study hub', x: 30, z: 22, w: 24, d: 20, h: 25, style: 'modern', color: '#c8b6a1' }),
      building({ id: 'lse-saw', name: 'Saw Swee Hock Student Centre', code: 'SAW', category: 'Student centre', x: 29, z: -18, w: 19, d: 17, h: 23, style: 'brick', color: '#ae6e61' }),
      building({ id: 'lse-old', name: 'Old Building', code: 'OLD', category: 'Campus hub', x: -10, z: -28, w: 18, d: 18, h: 20, style: 'classical', color: '#c7a68b' }),
    ] },
  ] },
];

export const ALL_BUILDINGS = UNIVERSITIES.flatMap(university => university.campuses.flatMap(campus => campus.buildings));

export function findBuildingLocation(id: string): { university: UniversityProfile; campus: CampusProfile; building: CampusBuilding } | null {
  for (const university of UNIVERSITIES) {
    for (const campus of university.campuses) {
      const match = campus.buildings.find(building => building.id === id);
      if (match) return { university, campus, building: match };
    }
  }
  return null;
}

export const CAMPUS_CENTERS: Record<string, [number, number]> = {
  'ucl-bloomsbury': [-.1340, 51.5246], 'ucl-east': [-.0087, 51.5381],
  'kcl-strand': [-.1163, 51.5115], 'kcl-waterloo': [-.1126, 51.5050], 'kcl-guys': [-.0885, 51.5029],
  'imperial-south-ken': [-.1749, 51.4988], 'imperial-white-city': [-.2363, 51.5162],
  'lse-aldwych': [-.1160, 51.5144],
};
