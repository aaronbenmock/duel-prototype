// Wires sensors, game rules, sound and screens together.
import './style.css';
import { AudioEngine } from './audio/audio';
import { createDuel, step } from './game/duel';
import type { Action, DuelState, Effect } from './game/types';
import { AimTracker } from './input/aim';
import { GestureDetector } from './input/gestures';
import { MotionSensors } from './input/motion';
import { installRotateOverlay, ScreenAwake, vibrate } from './platform/platform';
import { BOT_FLIGHT_MS, GameView } from './render/gameView';
import { mountSensorCheck } from './render/sensorCheck';
import { SettingsView, type ReadoutRow } from './render/settingsView';
import { StartView } from './render/startView';
import {
  APP_VERSION,
  aimConfig,
  DEFAULT_SETTINGS,
  duelConfig,
  gestureConfig,
  loadSettings,
  saveSettings,
  settingsText,
  type Settings,
} from './settings/settings';

const sensors = new MotionSensors();
const audio = new AudioEngine();
const awake = new ScreenAwake();
const gestures = new GestureDetector();
const aim = new AimTracker();
let settings: Settings = loadSettings();

/** Pushes settings into the aim tracker, gesture detector and sound. */
function applySettings(s: Settings) {
  settings = s;
  aim.config = aimConfig(s);
  gestures.config = gestureConfig(s);
  audio.enabled = s.sound;
  game.showZones = s.showHitZones;
  game.showReloadButton = s.showReloadButton;
}

const app = document.getElementById('app')!;
installRotateOverlay();

const start = new StartView(app);
const game = new GameView(document.body);
const settingsView = new SettingsView(app, settings);
applySettings(settings);
const sensorScreen = document.createElement('div');
sensorScreen.className = 'hidden';
app.appendChild(sensorScreen);
let sensorMounted = false;

let duel: DuelState | null = null;
let motionOn = false;
let lastFlickAt = -Infinity;
let settingsReturn: 'start' | 'game' = 'start';

// Aim log: raw sensor angles and crosshair position for the current round,
// so a tracking problem on the phone can be copied and diagnosed.
const aimLog: string[] = [];
const LOG_MAX = 1500;
let logStart = 0;
const n1 = (v: number) => v.toFixed(1);

function show(screen: 'start' | 'game' | 'sensors' | 'settings') {
  start.show(screen === 'start');
  game.show(screen === 'game');
  settingsView.show(screen === 'settings');
  sensorScreen.classList.toggle('hidden', screen !== 'sensors');
  document.body.classList.toggle('in-game', screen === 'game');
}

// ---- Game rules <-> effects ----

function dispatch(action: Action) {
  if (!duel) return;
  const { state, effects } = step(duel, action);
  duel = state;
  effects.forEach(play);
}

function play(e: Effect) {
  switch (e.type) {
    case 'ready':
      audio.ready();
      vibrate(40);
      break;
    case 'draw':
      audio.draw();
      vibrate(200);
      break;
    case 'shot':
      audio.shot();
      game.kick();
      game.playerShot(e.zone, e.aim);
      if (e.zone === 'face') audio.headshot();
      else if (e.zone) audio.hit();
      else audio.miss();
      vibrate(30);
      break;
    case 'empty':
      audio.empty();
      break;
    case 'reload':
      audio.reload();
      game.reloadAnim();
      break;
    case 'botShot':
      audio.botShot();
      if (duel) game.botShot(duel, e.zone);
      if (e.zone) {
        // Land the splat sound and buzz when the paint arrives.
        setTimeout(() => {
          audio.hurt();
          vibrate(250);
        }, BOT_FLIGHT_MS);
      }
      break;
    case 'foul':
      audio.foul();
      vibrate([100, 60, 100]);
      break;
    case 'victory':
      audio.victory();
      break;
    case 'defeat':
      audio.defeat();
      break;
  }
}

function newRound() {
  aimLog.length = 0;
  gestures.reset();
  aim.unlock();
  duel = createDuel(duelConfig(settings), (Math.random() * 2 ** 32) >>> 0, performance.now());
  show('game');
}

// ---- Sensors -> game actions ----

sensors.onOrientation((s) => {
  gestures.updateOrientation(s);
  if (!duel) return;
  switch (duel.phase) {
    case 'holster':
      if (gestures.holstered) dispatch({ type: 'holster', now: s.t });
      break;
    case 'ready':
      if (!gestures.holstered) dispatch({ type: 'unholster', now: s.t });
      break;
    case 'draw':
      if (gestures.aimPose) {
        // Lock the aiming reference at the moment of the draw.
        aim.lock(s.q, s.t);
        logStart = s.t;
        dispatch({ type: 'drawPose', now: s.t });
      }
      break;
    case 'aim': {
      aim.update(s.q, s.t);
      // Dipping the phone to point at the floor reloads (any time the gun isn't full).
      if (aim.takeDip()) {
        lastFlickAt = s.t;
        dispatch({ type: 'reload', now: s.t });
      }
      // Tilt-to-move: sideways tilt becomes a sidestep (skip if unchanged).
      // No stepping while aiming is paused: tilt readings are meaningless then.
      const lean = settings.tiltMove && !aim.suspended ? gestures.leanValue() : 0;
      if (Math.abs(lean - duel.player.lean) > 0.01) dispatch({ type: 'lean', now: s.t, value: lean });
      const flag = aim.suspended ? 'P' : aim.lastWasSpike ? 'S' : aim.settling ? 'C' : '';
      if (aimLog.length < LOG_MAX) {
        aimLog.push([Math.round(s.t - logStart), n1(s.alpha), n1(s.beta), n1(s.gamma), n1(aim.raw.x), n1(aim.raw.y), n1(aim.current.x), n1(aim.current.y), flag, n1(gestures.roll), duel?.player.x.toFixed(2) ?? ''].map(String).join(','));
      }
      break;
    }
  }
});

sensors.onMotion((s) => {
  const flick = gestures.updateMotion(s);
  if (flick) lastFlickAt = s.t;
  // A down-up flick also reloads, at any ammo count (an accidental reload does no harm).
  if (flick && duel?.phase === 'aim') dispatch({ type: 'reload', now: s.t });
});

// Game clock. Runs on a timer (not animation frames) so DRAW fires on time
// even if the browser slows down drawing.
setInterval(() => {
  if (duel && duel.phase !== 'over') dispatch({ type: 'tick', now: performance.now() });
}, 10);

// ---- Screen input ----

game.onFire = (t) => {
  // Use the aim from slightly before the tap (the look-back setting), so the
  // thumb press doesn't move the shot.
  // No shooting while the gun is lowered (aiming paused).
  if (duel?.phase === 'aim' && !aim.suspended) {
    const at = aim.at(t - settings.lookbackMs);
    if (aimLog.length < LOG_MAX) aimLog.push(`${Math.round(t - logStart)},,,,,,${n1(at.x)},${n1(at.y)},F`);
    dispatch({ type: 'fire', now: t, aim: at });
  }
};
game.onReload = () => dispatch({ type: 'reload', now: performance.now() });
game.onAgain = () => {
  audio.unlock();
  newRound();
};
game.onCopyLog = async () => {
  const s = duel;
  const header = [
    `# High Moon aim log, app ${APP_VERSION}, ${new Date().toISOString()}`,
    `# ${navigator.userAgent}`,
    `# result=${s?.result} target=${s ? n1(s.target.x) + ',' + n1(s.target.y) : ''} spikes=${aim.spikes} pauses=${aim.resumes}`,
    `# settings: ${Object.entries(settings).map(([k, v]) => `${k}=${v}`).join(' ')}`,
    '# flags: C=re-centering (draw or after a pause), P=aim paused (phone out of aiming pose), S=glitch ignored, F=tap (aim used)',
    'ms,alpha,beta,gamma,rawX,rawY,x,y,flag,tilt,stepX',
  ];
  try {
    await navigator.clipboard.writeText(header.concat(aimLog).join('\n'));
    return true;
  } catch {
    return false;
  }
};
game.onSettings = () => openSettings('game');
game.onMenu = () => {
  duel = null;
  show('start');
};

function enableMotion(then?: () => void) {
  // Must stay synchronous up to sensors.request(): iOS needs the tap.
  audio.unlock();
  start.setMotion('asking');
  sensors.request().then((result) => {
    // Some browsers say "denied" but still send data; give them a moment.
    setTimeout(() => {
      motionOn = result === 'granted' || sensors.orientation != null;
      start.setMotion(motionOn ? 'on' : 'denied');
      if (motionOn) then?.();
    }, result === 'granted' ? 0 : 500);
  });
}

start.onEnable = () => {
  enableMotion();
  audio.beep();
};
start.onStart = () => {
  audio.unlock();
  void awake.acquire();
  if (motionOn) newRound();
  else enableMotion(newRound);
};
function openSettings(from: 'start' | 'game') {
  settingsReturn = from;
  show('settings');
}
start.onSettings = () => {
  // The live readout needs sensors; this tap is a chance to ask for them.
  if (!motionOn) enableMotion();
  openSettings('start');
};
settingsView.onChange = (s) => {
  applySettings(s);
  saveSettings(s);
};
settingsView.onReset = () => {
  applySettings({ ...DEFAULT_SETTINGS });
  saveSettings(settings);
  settingsView.setValues(settings);
};
settingsView.onCopy = async () => {
  try {
    await navigator.clipboard.writeText(settingsText(settings));
    return true;
  } catch {
    return false;
  }
};
settingsView.onBack = () => show(settingsReturn === 'game' && duel ? 'game' : 'start');

start.onSensorCheck = () => {
  if (!sensorMounted) {
    mountSensorCheck(sensorScreen, sensors, audio, awake);
    const back = document.createElement('button');
    back.className = 'secondary';
    back.textContent = 'Back';
    back.addEventListener('click', () => show('start'));
    sensorScreen.prepend(back);
    sensorMounted = true;
  }
  show('sensors');
};

// ---- Drawing ----

const yesNo = (b: boolean) => (b ? 'YES' : 'no');
const moveLabel = (v: number) => (v === 0 ? 'still' : `${v > 0 ? 'right' : 'left'} ${Math.round(Math.abs(v) * 100)}%`);

/** What the detectors currently see. */
function readoutRows(): ReadoutRow[] {
  const now = performance.now();
  const flickAgo = now - lastFlickAt;
  const hz = sensors.orientationHz();
  return [
    ['Game state', duel ? duel.phase : 'not in a duel'],
    ['Holster', yesNo(gestures.holstered), gestures.holstered],
    ['Draw (aim pose)', yesNo(gestures.aimPose), gestures.aimPose],
    ['Reload (dip or flick)', flickAgo < 1500 ? 'DETECTED' : 'no', flickAgo < 1500],
    ['Sideways tilt / move', `${gestures.roll.toFixed(0)}° / ${settings.tiltMove ? moveLabel(gestures.leanValue()) : 'off'}`, gestures.leanValue() !== 0],
    ['Phone top down / up', (gestures.upY >= 0 ? 'up ' : 'down ') + Math.abs(gestures.upY).toFixed(2)],
    ['Sensor updates / sec', motionOn || hz ? String(hz) : 'motion not enabled'],
  ];
}

function frame() {
  if (duel) game.render(duel, aim.current, duel.phase === 'aim' && !aim.suspended);
  if (duel && settings.showReadout) {
    const r = readoutRows();
    game.setReadout(
      `${r[0][1]} | holster ${r[1][1]} | draw ${r[2][1]} | reload ${r[3][1] === 'no' ? 'no' : 'YES'} | step ${duel.player.x.toFixed(1)}m | ${r[6][1]} Hz`,
    );
  } else {
    game.setReadout(null);
  }
  if (!settingsView.el.classList.contains('hidden')) settingsView.setReadout(readoutRows());
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

show('start');

// Expose for debugging in the browser console.
(window as unknown as Record<string, unknown>).__duel = { get state() { return duel; }, dispatch, newRound, gestures, aim };
