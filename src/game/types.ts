// Game state and actions. Nothing here knows about sensors, audio or the screen,
// so a future multiplayer mode can drive the same rules from network messages.

export type Phase = 'holster' | 'ready' | 'draw' | 'aim' | 'over';
export type Result = 'victory' | 'defeat' | 'foul';
export type HitZone = 'face' | 'torso' | 'limb' | 'tail' | null;

/** Aim positions are in "aim units": degrees of phone rotation from the draw pose (right and up are positive). */
export interface Vec2 {
  x: number;
  y: number;
}

export interface BotConfig {
  /** Seconds after DRAW before the bot's first shot (random in range). */
  firstShotMin: number;
  firstShotMax: number;
  /** Seconds between bot shots (random in range). */
  intervalMin: number;
  intervalMax: number;
  /** Chance each bot shot hits (0 to 1). */
  hitChance: number;
  /** Share of bot hits that land on the face (0 to 1). */
  headshotShare: number;
  /** Seconds the bot needs to reload after six shots. */
  reloadTime: number;
  /** Chance a shot hits is multiplied by this while the bot itself is walking, and by dashHitFactor mid-dash. */
  movingHitFactor: number;
  dashHitFactor: number;
  /** How far (m) the bot moves either side of its start spot. 0 = stands still. */
  moveRange: number;
  /** Walking speed, m/s. */
  walkSpeed: number;
  /** Share of moves that are dashes: short fast bursts. */
  dashChance: number;
  dashSpeed: number;
  dashDistMin: number;
  dashDistMax: number;
  /** Share of walks that turn back part-way (a juke). */
  jukeChance: number;
  /** Seconds it stands still between moves (random in range). */
  plantMin: number;
  plantMax: number;
  /** A planted bot fires this many seconds after stopping (if its next shot wasn't due sooner). */
  plantShotDelay: number;
  /** If your crosshair stays on a planted bot this long (ms), it may dash away (this chance). 0 = never. */
  reactMs: number;
  reactChance: number;
}

/** What the player picked before the duel. */
export interface Loadout {
  creature: string;
  weapon: string;
}

export interface DuelConfig {
  /** Milliseconds between READY and DRAW (random in range). */
  drawDelayMin: number;
  drawDelayMax: number;
  bot: BotConfig;
}

export interface Shooter {
  hp: number;
  rounds: number;
  shots: number;
  hits: number;
  /** Face hits (critical). */
  headshots: number;
}

export interface PlayerState extends Shooter {
  /** Gun id (see weapons.ts). */
  weapon: string;
  /** The player's alien (looks only; shows as the hand holding the gun). */
  creature: string;
  /** While reloading: when the next round goes in. null = not reloading. */
  reloadNextAt: number | null;
  /** When the last shot was fired (for the gun's cooldown). */
  lastShotAt: number | null;
  /** Recoil: the crosshair's kick right after the last shot (aim units), when it happened, and how many quick shots in a row. */
  recoil: { x: number; y: number; at: number | null; string: number };
  /** Choke (spread guns): how long the crosshair has been held steady (ms), and where it was last tick. */
  steadyMs: number;
  lastAim: (Vec2 & { t: number }) | null;
  /** Heat guns: 0 to 100; locked while overheated (until cooled to 0) or venting. */
  heat: number;
  overheated: boolean;
  venting: boolean;
  /** The current vent: when it started, how long it should take (ms), and the timed-tap result so far. */
  vent: { startAt: number; durationMs: number; tapped: boolean; jammed: boolean } | null;
  /** Zaps left with the perfect-vent damage bonus. */
  charged: number;
  /** Bolts still flying (aim units, where they were aimed), each landing at arriveAt. */
  bolts: Bolt[];
  /** Sideways position in meters (right is positive), from tilt-to-move. */
  x: number;
  /** Current movement input, -1 (full left) to 1 (full right). */
  lean: number;
  /** Actual sideways speed over the last tick, m/s. */
  vx: number;
}

export interface BotState extends Shooter {
  /** Gun id (see weapons.ts). */
  weapon: string;
  nextFireAt: number | null;
  reloadUntil: number | null;
  /** Sideways position (m) and where it's heading. */
  x: number;
  destX: number;
  vx: number;
  /** Standing still (and likely to shoot), walking, or dashing. */
  mode: 'plant' | 'walk' | 'dash';
  /** When it starts its next move (while planted). */
  nextMoveAt: number | null;
  /** When a walk turns back (juke), if it will. */
  jukeAt: number | null;
  /** How long the player's crosshair has been on it (ms). */
  onTargetMs: number;
}

/** A paint mark, stored relative to the opponent's torso reference so it moves with him. */
export interface BulletHole extends Vec2 {
  zone: HitZone;
  /** Splat size: 1 for a single blob, smaller for spread-gun blobs. */
  size: number;
  /** When it was fired (ms), so the splat can appear as the paint arrives. */
  t: number;
}

export interface DuelState {
  phase: Phase;
  result: Result | null;
  config: DuelConfig;
  /** Seeded random state, so a round can be replayed or synced later. */
  rng: number;
  /** Which creature sprite and hit-zone map the opponent uses. */
  creature: string;
  /** Which background the round is played on (src/game/maps.ts). */
  map: string;
  /** The opponent's torso reference point, in aim units (before any sidestep). */
  target: Vec2;
  startedAt: number;
  holsteredAt: number | null;
  drawSignalAt: number | null;
  drawnAt: number | null;
  endedAt: number | null;
  lastTickAt: number;
  player: PlayerState;
  bot: BotState;
  holes: BulletHole[];
}

export type Action =
  | { type: 'holster'; now: number }
  | { type: 'unholster'; now: number }
  | { type: 'drawPose'; now: number }
  | { type: 'fire'; now: number; aim: Vec2 }
  | { type: 'reload'; now: number }
  /** A tap while venting a heat gun (the timed-vent attempt). */
  | { type: 'ventTap'; now: number }
  | { type: 'lean'; now: number; value: number }
  /** `aim`: where the crosshair is while aiming (the bot reacts to being aimed at). */
  | { type: 'tick'; now: number; aim?: Vec2 };

export interface Bolt extends Vec2 {
  arriveAt: number;
  /** Damage multiplier (perfect-vent bonus). */
  mult: number;
}

/** Where one paint blob of a shot landed (aim units) and what it hit. */
export interface Pellet extends Vec2 {
  zone: HitZone;
}

export type EmptyReason = 'empty' | 'reloading' | 'overheated' | 'venting' | 'cooldown';

/** Things that happened during a step, for sound, vibration and flashes. */
export type Effect =
  | { type: 'ready' }
  | { type: 'draw' }
  /**
   * `aim`: where the shot went (crosshair, including recoil). `recoil`: how far recoil had moved the crosshair
   * from where the phone pointed. `settled`: fired from a settled gun. `last`: last round before a reload.
   */
  | { type: 'shot'; zone: HitZone; aim: Vec2; damage: number; pellets: Pellet[]; last: boolean; recoil: Vec2; settled: boolean; spread: number; travelMs: number; charged: boolean }
  /** A flying bolt arrived (travelling guns): what it hit. */
  | { type: 'boltHit'; zone: HitZone; aim: Vec2; damage: number }
  | { type: 'ventPerfect' }
  | { type: 'ventJam' }
  /** The trigger clicked without firing, and why. */
  | { type: 'empty'; reason: EmptyReason }
  | { type: 'reloadStart'; missing: number }
  | { type: 'reloadRound' }
  | { type: 'reloadDone' }
  | { type: 'overheat' }
  | { type: 'ventStart' }
  | { type: 'ventDone' }
  | { type: 'cooled' }
  | { type: 'botReload' }
  | { type: 'botShot'; zone: HitZone }
  | { type: 'foul' }
  | { type: 'victory' }
  | { type: 'defeat' };
