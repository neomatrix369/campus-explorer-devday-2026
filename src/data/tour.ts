export interface TourStop {
  title: string;
  campusId: string;
  buildingId: string;
  floor: string | null;
  hour: number;
  narration: string;
}

export const TOUR_STOPS: TourStop[] = [
  { title: 'Welcome to London', campusId: 'ucl-bloomsbury', buildingId: 'ucl-wilkins', floor: null, hour: 16.5, narration: 'Welcome to CampusExplorer. We are starting in the UCL main quad. Look around the three dimensional campus, then choose a building to inspect a quieter floor.' },
  { title: 'A floor for every mood', campusId: 'ucl-bloomsbury', buildingId: 'ucl-student-centre', floor: '3', hour: 20.5, narration: 'The UCL Student Centre has different kinds of study spaces across its floors. Level three is shown here as a quiet option, with seat and noise figures clearly marked as estimates.' },
  { title: 'A library after dark', campusId: 'kcl-strand', buildingId: 'kcl-maughan', floor: '2', hour: 21.5, narration: 'Across town at King’s College London, the Maughan Library is a striking place to focus. Check official access and booking details before setting out.' },
  { title: 'South Kensington', campusId: 'imperial-south-ken', buildingId: 'imp-central-library', floor: '2', hour: 14.5, narration: 'At Imperial College London, the Central Library sits close to the Queen’s Tower. The map shows a schematic campus view and a ranked list of study floors.' },
  { title: 'An LSE study stop', campusId: 'lse-aldwych', buildingId: 'lse-library', floor: '2', hour: 18.25, narration: 'The London School of Economics library is our next stop. Use the time slider to compare a different hour, and the floor inspector to see estimated quietness and amenities.' },
  { title: 'Explore your own route', campusId: 'ucl-east', buildingId: 'ucl-marshgate', floor: '2', hour: 19, narration: 'We finish at UCL East. Switch campuses, ask for a study spot, or download a schematic map. The official university source stays one click away for verification.' },
];
