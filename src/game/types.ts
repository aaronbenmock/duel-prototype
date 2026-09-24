// Game state and actions. Nothing here knows about sensors, audio or the screen,
// so a future multiplayer mode can drive the same rules from network messages.

export type Phase = 'holster' | 'ready' | 'draw' | 'aim' | 'over';
export type Result = 'victory' | 'defeat' | 'foul';
export type HitZone = 'head' | 'torso' | null;

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
  /** Share of bot hits that are headshots (0 to 1). */
  headshotShare: number;
  /** Seconds the bot needs to reload after six shots. */
  reloadTime: number;
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
  headshots: number;
}

export interface BotState extends Shooter {
  nextFireAt: number | null;
  reloadUntil: number | null;
}

export interface BulletHole extends Vec2 {
  zone: HitZone;
}

export interface DuelState {
  phase: Phase;
  result: Result | null;
  config: DuelConfig;
  /** Seeded random state, so a round can be replayed or synced later. */
  rng: number;
  /** Center of the opponent's torso, in aim units. */
  target: Vec2;
  startedAt: number;
  holsteredAt: number | null;
  drawSignalAt: number | null;
  drawnAt: number | null;
  endedAt: number | null;
  player: Shooter;
  bot: BotState;
  holes: BulletHole[];
}

export type Action =
  | { type: 'holster'; now: number }
  | { type: 'unholster'; now: number }
  | { type: 'drawPose'; now: number }
  | { type: 'fire'; now: number; aim: Vec2 }
  | { type: 'reload'; now: number }
  | { type: 'tick'; now: number };

/** Things that happened during a step, for sound, vibration and flashes. */
export type Effect =
  | { type: 'ready' }
  | { type: 'draw' }
  | { type: 'shot'; zone: HitZone }
  | { type: 'empty' }
  | { type: 'reload' }
  | { type: 'botShot'; zone: HitZone }
  | { type: 'foul' }
  | { type: 'victory' }
  | { type: 'defeat' };
