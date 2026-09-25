// Wires sensors, game rules, sound and screens together.
import './style.css';
import { AudioEngine } from './audio/audio';
import { createDuel, step } from './game/duel';
import type { Action, DuelState, Effect, Loadout } from './game/types';
import { WEAPONS } from './game/weapons';
import { AimTracker } from './input/aim';
import { GestureDetector } from './input/gestures';
import { MotionSensors } from './input/motion';
import { installRotateOverlay, ScreenAwake, vibrate } from './platform/platform';
import { BOT_FLIGHT_MS, GameView } from './render/gameView';
import { mountSensorCheck } from './render/sensorCheck';
import { SettingsView, type ReadoutRow } from './render/settingsView';
import { StartView } from './render/startView';
import { mountLogsPanel } from './render/logsPanel';
import { loadLoadout, saveLoadout } from './settings/loadout';
import { logFileName, RoundRecorder, type RoundLog } from './telemetry/roundLog';
import { shareJson } from './telemetry/share';
import { deviceId, flush, getKey, getLabel, onStatus, randomId, saveRound, status } from './telemetry/upload';
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
let loadout: Loadout = loadLoadout();

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

const start = new StartView(app, loadout);
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

// Test log for the current round (events, raw aim samples, errors); saved on the
// phone and uploaded when the round ends. See src/telemetry.
const recorder = new RoundRecorder();
/** The last finished round, kept in memory so Share works straight from the tap. */
let lastLog: RoundLog | null = null;
const n1 = (v: number) => v.toFixed(1);
const logsPanel = mountLogsPanel(settingsView.el.querySelector('#st-logs')!);

function logExtras() {
  return { sensorHz: sensors.orientationHz(), spikes: aim.spikes, pauses: aim.resumes };
}

function finishLog(s: DuelState) {
  const log = recorder.finish(s, performance.now(), logExtras());
  if (!log) return;
  lastLog = log;
  showLogStatus();
  void saveRound(log);
}

function showLogStatus() {
  if (!lastLog) return;
  const flagged = lastLog.flag ? 'Flagged. ' : '';
  const where = !getKey()
    ? 'Log saved on this phone (no upload key).'
    : status.busy
      ? 'Log saved. Uploading...'
      : status.waiting
        ? `Log saved. ${status.waiting} waiting to upload.`
        : 'Log saved and uploaded.';
  game.setLogStatus(flagged + where);
}
onStatus(showLogStatus);

// Errors go into the round's log so Claude sees them.
window.addEventListener('error', (e) => recorder.error(`${e.message} @${e.filename}:${e.lineno}`));
window.addEventListener('unhandledrejection', (e) => recorder.error(`unhandled: ${String(e.reason)}`));
// Closing or switching away mid-round saves what was recorded so far.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden' && duel && duel.phase !== 'over' && recorder.log) {
    const partial = structuredClone(recorder.log);
    partial.result = 'abandoned';
    partial.durationMs = recorder.ms(performance.now());
    void saveRound(partial);
  }
});

function show(screen: 'start' | 'game' | 'sensors' | 'settings') {
  start.show(screen === 'start');
  game.show(screen === 'game');
  settingsView.show(screen === 'settings');
  sensorScreen.classList.toggle('hidden', screen !== 'sensors');
  document.body.classList.toggle('in-game', screen === 'game');
}

// ---- Game rules <-> effects ----

function dispatch(action: Action, source?: string) {
  if (!duel) return;
  const wasOver = duel.phase === 'over';
  const { state, effects } = step(duel, action);
  duel = state;
  if (action.type !== 'tick' && action.type !== 'lean' && action.type !== 'fire') {
    recorder.event(action.now, action.type, source ?? null);
  }
  recorder.effects(action.now, effects);
  effects.forEach(play);
  if (!wasOver && duel.phase === 'over') finishLog(duel);
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
    case 'shot': {
      const weapon = duel?.player.weapon ?? loadout.weapon;
      if (e.pellets.length > 1) audio.blast();
      else if (WEAPONS[weapon].heat) audio.zap();
      else audio.shot();
      game.kick();
      game.playerShot(e.zone, e.aim, e.damage, weapon, e.pellets);
      if (e.zone === 'face') audio.headshot();
      else if (e.zone) audio.hit();
      else audio.miss();
      vibrate(30);
      break;
    }
    case 'empty':
      audio.empty();
      break;
    case 'reloadStart':
      audio.reloadOpen();
      game.reloadAnim();
      break;
    case 'reloadRound':
      audio.reloadRound();
      break;
    case 'reloadDone':
      audio.reloadClose();
      break;
    case 'overheat':
      audio.overheat();
      vibrate([60, 40, 60]);
      break;
    case 'ventStart':
      audio.vent();
      game.reloadAnim();
      break;
    case 'ventDone':
    case 'cooled':
      audio.ventDone();
      break;
    case 'botReload':
      audio.botReload();
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
  if (duel && duel.phase !== 'over') finishLog(duel);
  gestures.reset();
  aim.unlock();
  const seed = (Math.random() * 2 ** 32) >>> 0;
  const now = performance.now();
  duel = createDuel(duelConfig(settings), seed, now, loadout);
  recorder.start(now, {
    v: 1,
    id: randomId(),
    app: APP_VERSION,
    device: deviceId(),
    label: getLabel(),
    startedAt: new Date().toISOString(),
    ua: navigator.userAgent,
    screen: {
      w: window.innerWidth, h: window.innerHeight, dpr: window.devicePixelRatio,
      homeScreen: window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true,
    },
    settings: { ...settings },
    seed,
    loadout: { alien: duel.player.creature, gun: duel.player.weapon },
    opponent: { creature: duel.creature, gun: duel.bot.weapon, bot: settings.bot },
  });
  recorder.event(now, 'target', n1(duel.target.x), n1(duel.target.y));
  game.setLogStatus('');
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
        dispatch({ type: 'drawPose', now: s.t });
      }
      break;
    case 'aim': {
      aim.update(s.q, s.t);
      // Dipping the phone to point at the floor reloads (any time the gun isn't full).
      if (aim.takeDip()) {
        lastFlickAt = s.t;
        dispatch({ type: 'reload', now: s.t }, 'dip');
      }
      // Tilt-to-move: sideways tilt becomes a sidestep (skip if unchanged).
      // No stepping while aiming is paused: tilt readings are meaningless then.
      const lean = settings.tiltMove && !aim.suspended ? gestures.leanValue() : 0;
      if (Math.abs(lean - duel.player.lean) > 0.01) dispatch({ type: 'lean', now: s.t, value: lean });
      const flag = aim.suspended ? 'P' : aim.lastWasSpike ? 'S' : aim.settling ? 'C' : '';
      recorder.aimRow([recorder.ms(s.t), n1(s.alpha), n1(s.beta), n1(s.gamma), n1(aim.raw.x), n1(aim.raw.y), n1(aim.current.x), n1(aim.current.y), flag, n1(gestures.roll), duel.player.x.toFixed(2)].map(String).join(','));
      break;
    }
  }
});

sensors.onMotion((s) => {
  const flick = gestures.updateMotion(s);
  if (flick) lastFlickAt = s.t;
  // A down-up flick also reloads, at any ammo count (an accidental reload does no harm).
  if (flick && duel?.phase === 'aim') dispatch({ type: 'reload', now: s.t }, 'flick');
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
    recorder.aimRow(`${recorder.ms(t)},,,,,,${n1(at.x)},${n1(at.y)},F`);
    dispatch({ type: 'fire', now: t, aim: at });
  } else if (duel && duel.phase !== 'over') {
    // Taps that did nothing (before the draw, or while the gun is lowered).
    recorder.event(t, 'tapIgnored', duel.phase, aim.suspended ? 'lowered' : null);
  }
};
game.onReload = () => dispatch({ type: 'reload', now: performance.now() }, 'button');
game.onAgain = () => {
  audio.unlock();
  newRound();
};
game.onFlag = async () => {
  if (!lastLog) return false;
  const note = window.prompt('What felt off? (optional, a few words)', '');
  if (note == null) return false;
  lastLog.flag = { note: note.trim().slice(0, 500), at: new Date().toISOString() };
  showLogStatus();
  await saveRound(lastLog);
  return true;
};
game.onShareLog = () => {
  if (lastLog) void shareJson(`high-moon-${lastLog.startedAt.slice(0, 10)}-${logFileName(lastLog)}`, lastLog);
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

start.onPick = (l) => {
  loadout = l;
  saveLoadout(l);
};
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
  logsPanel.opened();
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
// Upload anything left over from earlier sessions.
void flush();

// Expose for debugging in the browser console.
(window as unknown as Record<string, unknown>).__duel = { get state() { return duel; }, dispatch, newRound, gestures, aim };
