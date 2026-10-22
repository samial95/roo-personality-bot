// All copy and option data. Exact copy from the build spec.

export const PERSONALITIES = ['shy', 'playful', 'dramatic', 'calm'] as const;
export type Personality = (typeof PERSONALITIES)[number];

export const ACCENT: Record<Personality | 'neutral', string> = {
  shy: '#FF8FB1',
  playful: '#FFD43B',
  dramatic: '#FF5A4E',
  calm: '#5EEAD4',
  neutral: '#C9C9CF',
};

export const LABEL: Record<Personality, string> = {
  shy: 'Shy',
  playful: 'Playful',
  dramatic: 'Dramatic',
  calm: 'Calm',
};

export interface Answer {
  p: Personality;
  text: string;
  bubble: string;
}

export interface Question {
  title: [string, string];
  answers: Answer[];
}

export const QUESTIONS: Question[] = [
  {
    title: ["It's Friday night.", 'Where do you find me?'],
    answers: [
      { p: 'shy', text: 'Under a blanket with a book', bubble: 'A blanket fort? Cozy…' },
      { p: 'playful', text: 'Starting a dance-off', bubble: 'Ooh… a dance-off?' },
      { p: 'dramatic', text: 'On a rooftop, narrating my life to the moon', bubble: 'The moon gets me.' },
      { p: 'calm', text: 'Watering plants with lo-fi on', bubble: 'Plants and lo-fi. Mmm.' },
    ],
  },
  {
    title: ['Someone says hi to me.', 'I…'],
    answers: [
      { p: 'shy', text: 'Blush and look at the floor', bubble: 'Oh no. Eye contact.' },
      { p: 'playful', text: 'High-five them with both arms', bubble: 'Up top! Both arms!' },
      { p: 'dramatic', text: 'Gasp. "Finally, someone noticed me!"', bubble: 'Wait. Someone noticed ME?' },
      { p: 'calm', text: 'Nod slowly and smile', bubble: '*slow nod*' },
    ],
  },
  {
    title: ['Pick my', 'superpower.'],
    answers: [
      { p: 'shy', text: 'Invisibility', bubble: "You can't see me now." },
      { p: 'playful', text: 'Infinite bounce', bubble: 'Boing boing boing!' },
      { p: 'dramatic', text: 'A spotlight that follows me everywhere', bubble: 'Lights. On. Me.' },
      { p: 'calm', text: 'A pause button for the world', bubble: 'A pause button… nice.' },
    ],
  },
];

// `later` replaces the bubble after Roo has been on screen a while
export const REVEAL: Record<Personality, { name: string; quote: string; traits: [string, string, string]; bubble: string; later?: string }> = {
  shy: {
    name: 'Roo the Quiet One',
    quote: "Oh… you're still looking at me?",
    traits: ['Quiet observer', 'Easily flustered', 'Secretly hilarious'],
    bubble: '…hi.',
    later: 'Don’t look at me, please.',
  },
  playful: {
    name: 'Roo the Chaos Buddy',
    quote: 'Again! Again! AGAIN!',
    traits: ['Zero chill', 'Professional bouncer', 'Snack-motivated'],
    bubble: 'Wanna see a trick?!',
  },
  dramatic: {
    name: 'Roo the Main Character',
    quote: 'This is the best day of my entire existence.',
    traits: ['Main character energy', 'Gasps often', 'Owns a spotlight'],
    bubble: 'Finally. My moment.',
  },
  calm: {
    name: 'Roo the Zen Unit',
    quote: "Breathe in. Breathe out. We're good.",
    traits: ['Unbothered', 'Plant parent', 'Speaks in lo-fi'],
    bubble: 'Everything is fine.',
  },
};

export const INSTALL_LOG = ['Calibrating feelings', 'Downloading vibes', 'Deleting boring.exe…', 'Done.'];

export interface Option {
  id: string;
  label: string;
  hex?: string;
}

export const BODY_COLORS: Option[] = [
  { id: 'white', label: 'Matte White', hex: '#F2F2F2' },
  { id: 'charcoal', label: 'Charcoal', hex: '#2B2B30' },
  { id: 'sky', label: 'Sky Blue', hex: '#8EC5FF' },
  { id: 'peach', label: 'Peach', hex: '#FFB899' },
  { id: 'lime', label: 'Lime', hex: '#C6F36B' },
  { id: 'lavender', label: 'Lavender', hex: '#C4B5FD' },
];

export const ACCENT_COLORS: Option[] = [
  { id: 'metal', label: 'Satin Metal', hex: '#C9C9C9' },
  { id: 'gold', label: 'Gold', hex: '#E8C46A' },
  { id: 'rose', label: 'Rose Gold', hex: '#E8A598' },
  { id: 'chrome', label: 'Black Chrome', hex: '#3A3A40' },
];

export const GLOW_COLORS: Option[] = [
  { id: 'auto', label: 'Auto · matches personality' },
  { id: 'white', label: 'White', hex: '#FFFFFF' },
  { id: 'pink', label: 'Pink', hex: '#FF8FB1' },
  { id: 'red', label: 'Red', hex: '#FF5A4E' },
  { id: 'mint', label: 'Mint', hex: '#5EEAD4' },
];

export const FINISHES: Option[] = [
  { id: 'matte', label: 'Matte' },
  { id: 'glossy', label: 'Glossy' },
];

export const COLOR_BUBBLES: Record<string, string> = {
  white: 'Classic. Timeless. Me.',
  charcoal: 'Dark mode activated.',
  sky: 'Ooh. Blue is SO my color.',
  peach: 'Peachy keen!',
  lime: 'Zesty!',
  lavender: 'Fancy and purple.',
};

export const MOVES = ['dance', 'wave', 'spin', 'jump', 'nap', 'surprise'] as const;
export type Move = (typeof MOVES)[number];

export const MOVE_BUBBLES: Record<Move, string> = {
  dance: 'Watch THIS!',
  wave: 'Hiii!',
  spin: 'Wheee—',
  jump: 'Boing!',
  nap: 'zzz…',
  surprise: '!!!',
};

export const SLOTS = ['head', 'antennas', 'face', 'hand', 'ground'] as const;
export type Slot = (typeof SLOTS)[number];

export const SLOT_LABEL: Record<Slot, string> = {
  head: 'Head',
  antennas: 'Antennas',
  face: 'Face',
  hand: 'Hand',
  ground: 'Ground',
};

export const ACCESSORIES: Record<Slot, Option[]> = {
  head: [
    { id: 'none', label: 'None' },
    { id: 'party', label: 'Party hat' },
    { id: 'crown', label: 'Crown' },
    { id: 'headphones', label: 'Headphones' },
    { id: 'beanie', label: 'Beanie' },
    { id: 'flower', label: 'Flower' },
  ],
  antennas: [
    { id: 'caps', label: 'Default caps' },
    { id: 'bulbs', label: 'Bulbs' },
    { id: 'hearts', label: 'Hearts' },
    { id: 'stars', label: 'Stars' },
    { id: 'glow', label: 'Glow balls' },
  ],
  face: [
    { id: 'none', label: 'None' },
    { id: 'blush', label: 'Blush' },
    { id: 'glasses', label: 'Glasses' },
    { id: 'sunglasses', label: 'Sunglasses' },
    { id: 'eyebrows', label: 'Eyebrows' },
  ],
  hand: [
    { id: 'none', label: 'None' },
    { id: 'balloon', label: 'Balloon' },
    { id: 'coffee', label: 'Coffee cup' },
    { id: 'flag', label: 'Tiny flag' },
    { id: 'mic', label: 'Mic' },
  ],
  ground: [
    { id: 'none', label: 'None' },
    { id: 'plant', label: 'Potted plant' },
    { id: 'speaker', label: 'Speaker' },
    { id: 'spotlight', label: 'Spotlight' },
    { id: 'rug', label: 'Rug' },
  ],
};

export const ACCESSORY_BUBBLES: Record<string, string> = {
  party: 'Is it my birthday?!',
  crown: 'Bow, human.',
  headphones: 'Can’t hear you. Vibing.',
  beanie: 'Cozy mode.',
  flower: 'I feel pretty.',
  bulbs: 'Bright idea!',
  hearts: 'Lovebot.',
  stars: 'Star power!',
  glow: 'Glowing up.',
  blush: 'Stop it, you.',
  glasses: 'Very smart now.',
  sunglasses: 'Too cool.',
  eyebrows: 'Expressive!',
  balloon: 'Don’t let go!',
  coffee: 'Fuel.',
  flag: 'Go team!',
  mic: 'Is this on?',
  plant: 'A friend!',
  speaker: 'Turn it up!',
  spotlight: 'Finally.',
  rug: 'Really ties the room.',
};
