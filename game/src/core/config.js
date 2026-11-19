// Every tuning number, colour and place name in one file. The city is built from the grid
// below; the camera shows a fixed 1280x720-ish window of it and everything is drawn in world
// units, so nothing depends on the size of the browser window.

export const GAME_NAME = 'VELVET COAST';
export const GAME_TAGLINE = 'Episode One · Palm Static';

/** Fixed simulation step: 60 updates a second whatever the display's refresh rate. */
export const STEP = 1 / 60;

export const WORLD = {
  width: 5700,
  height: 5700,
  /** The shoreline: everything north of this is water. */
  coastY: 380,
  /** Sand between the coast and the first sea-front street. */
  beachY: 648,
};

export const CITY = {
  originX: 260,
  originY: 700,
  block: 470,
  cols: 12,
  rows: 11,
  roadHalf: 52,
  sidewalk: 30,
};

export const FOOT = {
  radius: 11,
  speed: 178,
  sprintSpeed: 286,
  accel: 1500,
  friction: 9,
  enterRange: 96,
};

export const DRIVE = {
  /** Car body, in world units: a sedan is 48 long and 25 wide. */
  length: 48,
  width: 25,
  accel: 470,
  maxSpeed: 455,
  reverseMax: 150,
  brake: 780,
  drag: 0.55,
  turn: 2.65,
  grip: 6.2,
  handbrakeGrip: 1.15,
  /** How much the car slides before a hard stop (smoke and skid marks). */
  skidThreshold: 55,
};

export const CAR_SIZE = { length: 46, width: 21 };

export const TRAFFIC = {
  count: 30,
  pedCount: 78,
  cruise: 138,
  cruiseJitter: 26,
  laneOffset: 26,
  lookAhead: 108,
  keepGap: 76,
  lightCycle: 15,
};

export const POLICE = {
  maxCars: 5,
  spawnDistance: 760,
  chaseSpeed: 430,
  ramDamage: 7,
  bulletDamage: 11,
  bustRange: 62,
  /** Seconds out of sight before the heat starts falling. */
  evadeSeconds: 7.5,
  sightRange: 980,
};

export const CRIME = {
  kill: 1.0,
  carjack: 0.62,
  gunshot: 0.3,
  copCar: 1.2,
  ramPolice: 0.5,
};

export const ECON = {
  startCash: 320,
  wastedFee: 250,
  pickup: 60,
  courierReward: 250,
  missionReward: [380, 720, 980, 1450, 2600],
};

export const PALETTE = {
  deep: '#07070f',
  seaFar: '#241a3c',
  seaMid: '#5a2b58',
  seaNear: '#1b4a63',
  sand: '#c9a578',
  sandDark: '#a8845c',
  asphalt: '#1a1a26',
  asphaltLight: '#232333',
  sidewalk: '#2f2f3f',
  sidewalkEdge: '#3c3c50',
  park: '#14322c',
  neonPink: '#ff2d78',
  neonCyan: '#3ff0ff',
  neonAmber: '#ffb340',
  neonViolet: '#a25bff',
  neonGreen: '#4dff9e',
  cash: '#7dff9a',
  wanted: '#ffd24a',
  marker: '#ffd24a',
  player: '#f5e6d0',
  blood: '#b3173a',
  hudInk: '#f4f1ea',
  hudDim: 'rgba(244,241,234,0.55)',
};

/** Shop and venue names that light up the facades. All invented for this city. */
export const NEON_NAMES = [
  'MOTEL SOL', 'SALT & STATIC', 'VELVET liquors', 'CASA LUNA', '24H', 'PALM TAXI',
  'NOIR', 'TIDES', 'MARIGOLD', 'RUM BAR', 'LA PLAYA', 'STARLITE', 'DUNA', 'HALO',
  'GOLD COAST', 'SIRENA', 'ARCADE', 'MERCER', 'TABU', 'CAFE OLA', 'BODEGA', 'VICE',
];

export const CASH_LABELS = ['CHUMP CHANGE', 'DROP', 'STASH', 'PACKAGE'];

/** The named places missions refer to; each is snapped to a street corner in city.js. */
export const PLACES = {
  home: { col: 2, row: 2, label: 'SAFEHOUSE' },
  pier: { col: 8, row: -1, label: 'PIER 9' },
  depot: { col: 1, row: 8, label: 'DOCKSIDE DEPOT' },
  marina: { col: 4, row: -1, label: 'MARINA' },
  tower: { col: 9, row: 4, label: 'RADIO TOWER' },
  club: { col: 6, row: 6, label: 'CLUB HALO' },
  observatory: { col: 9, row: 9, label: 'HILLTOP' },
};

export const SAVE_KEY = 'velvet-coast.save.v1';

export const FONT = '"Segoe UI", "Helvetica Neue", Arial, sans-serif';
export const FONT_MONO = '"SF Mono", "Consolas", "Menlo", monospace';