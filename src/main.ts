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
import { reloadToLatest, watchForUpdate } from './platform/update';
import { BOT_FLIGHT_MS, GameView } from './render/gameView';
import { mountSensorCheck } from './render/sensorCheck';
import { SettingsView, type ReadoutRow } from './render/settingsView';
import { StartView } from './render/startView';
import { mountLogsPanel } from './render/logsPanel';
import { persistStorage, Profiles } from './settings/profiles';
import { posterHtml } from './render/posterView';
import { backfillStats } from './stats/backfill';
import { addRound, type Records, type Stats } from './stats/stats';
import { logFileName, RoundRecorder, type RoundLog } from './telemetry/roundLog';
import { shareJson } from './telemetry/share';
import { deviceId, flush, getKey, getLabel, onStatus, randomId, saveRound, status } from './telemetry/upload';
import {
  APP_VERSION,
  aimConfig,
  DEFAULT_SETTINGS,
  duelConfig,
  gestureConfig,
  settingsText,
  type Settings,
} from './settings/settings';

const sensors = new MotionSensors();
const audio = new AudioEngine();
const awake = new ScreenAwake();
const gestures = new GestureDetector();
const aim = new AimTracker();
// Saved gunslingers; the first run turns the pre-v0.7 settings and loadout into "Player 1".
const profiles = new Profiles();
let settings: Settings = profiles.active.settings;
let loadout: Loadout = profiles.loadout();

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

/** Shows the active gunslinger everywhere (after a switch, create, delete or restore). */
function applyProfile() {
  const p = profiles.active;
  loadout = profiles.loadout();
  applySettings({ ...p.settings });
  settingsView.setValues(settings);
  settingsView.setProfileName(p.name);
  game.setPaint(p.paint);
  start.setProfiles(profiles.list, p);
  start.setPoster(posterHtml(p));
}
applyProfile();
// Rounds played before v0.7.2 come from the logs on this phone (once).
void backfillStats(profiles).then((n) => {
  if (n) start.setPoster(posterHtml(profiles.active));
});

// Ask the browser to keep saved data; on iPhone Safari (not from the Home Screen) explain the week limit once.
void persistStorage();
const TIP_KEY = 'high-moon-tip-homescreen';
const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;
const iOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
try {
  start.showTip(iOS && !standalone && !localStorage.getItem(TIP_KEY));
} catch {
  // Storage blocked: skip the tip.
}
start.onTipDone = () => {
  try {
    localStorage.setItem(TIP_KEY, '1');
  } catch {
    // Storage blocked: the tip comes back next visit.
  }
};
const sensorScreen = document.createElement('div');
sensorScreen.className = 'hidden';
app.appendChild(sensorScreen);
let sensorMounted = false;

let duel: DuelState | null = null;
let motionOn = false;
let lastFlickAt = -Infinity;
/** One lowering of the phone often counts as both a dip and a flick; only the first one reloads. */
let lastReloadGestureAt = -Infinity;
const RELOAD_GESTURE_GAP_MS = 700;
function reloadGesture(t: number, source: 'dip' | 'flick') {
  if (t - lastReloadGestureAt < RELOAD_GESTURE_GAP_MS) return;
  lastReloadGestureAt = t;
  dispatch({ type: 'reload', now: t }, source);
}
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
  // All-time stats for the gunslinger who played (a round closed mid-duel counts as "left").
  const stats = profiles.active.stats;
  game.setRecords(recordLines(addRound(stats, log), stats));
  profiles.save();
  start.setPoster(posterHtml(profiles.active));
  showLogStatus();
  void saveRound(log);
}

/** Results-screen lines for records the round broke. */
function recordLines(r: Records, s: Stats): string[] {
  const lines: string[] = [];
  if (r.fastestDraw && s.fastestDrawMs != null) lines.push(`Fastest draw yet! ${(s.fastestDrawMs / 1000).toFixed(2)} s`);
  if (r.fastestWin && s.fastestWinMs != null) lines.push(`Fastest win yet! ${(s.fastestWinMs / 1000).toFixed(1)} s`);
  if (r.bestStreak) lines.push(`New best streak: ${s.bestStreak} wins in a row`);
  return lines;
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
      // Recoil guns move the gun with the kick itself; others play the fixed kick animation.
      if (!WEAPONS[weapon].recoil) game.kick();
      if (e.last) {
        audio.lastRound();
        game.lastRound();
      }
      game.playerShot(e.zone, e.aim, e.damage, weapon, e.pellets, e.travelMs, e.charged);
      vibrate(30);
      // Travelling bolts report their hit when they land (boltHit).
      if (e.travelMs > 0) break;
      if (e.zone === 'face') audio.headshot();
      else if (e.zone) audio.hit();
      else audio.miss();
      break;
    }
    case 'empty':
      // Tapping a gun that can't fire: a dry click, and for an empty or overheated gun a clear prompt.
      audio.empty();
      if (e.reason === 'empty') game.needAction('RELOAD');
      if (e.reason === 'overheated') game.needAction('OVERHEATED');
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
    case 'boltHit':
      game.boltHit(e.zone, e.aim, e.damage, duel?.player.weapon ?? loadout.weapon);
      if (e.zone === 'face') audio.headshot();
      else if (e.zone) audio.hit();
      else audio.miss();
      break;
    case 'ventPerfect':
      audio.ventPerfect();
      game.ventResult(true);
      vibrate([30, 30, 30]);
      break;
    case 'ventJam':
      audio.ventJam();
      game.ventResult(false);
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
    map: duel.map,
    profile: { id: profiles.active.id, name: profiles.active.name },
  });
  recorder.event(now, 'target', n1(duel.target.x), n1(duel.target.y));
  game.setLogStatus('');
  game.setRecords([]);
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
        reloadGesture(s.t, 'dip');
      }
      // Tilt-to-move: sideways tilt becomes a sidestep (skip if unchanged).
      // No stepping while aiming is paused: tilt readings are meaningless then.
      const lean = settings.tiltMove && !aim.suspended ? gestures.leanValue() : 0;
      if (Math.abs(lean - duel.player.lean) > 0.01) dispatch({ type: 'lean', now: s.t, value: lean });
      const flag = aim.suspended ? 'P' : aim.lastWasSpike ? 'S' : aim.settling ? 'C' : '';
      recorder.aimRow([recorder.ms(s.t), n1(s.alpha), n1(s.beta), n1(s.gamma), n1(aim.raw.x), n1(aim.raw.y), n1(aim.current.x), n1(aim.current.y), flag, n1(gestures.roll), duel.player.x.toFixed(2), duel.bot.x.toFixed(2), duel.bot.mode[0]].map(String).join(','));
      break;
    }
  }
});

sensors.onMotion((s) => {
  const flick = gestures.updateMotion(s);
  if (flick) lastFlickAt = s.t;
  // A down-up flick also reloads, at any ammo count (an accidental reload does no harm).
  if (flick && duel?.phase === 'aim') reloadGesture(s.t, 'flick');
});

// Game clock. Runs on a timer (not animation frames) so DRAW fires on time
// even if the browser slows down drawing.
setInterval(() => {
  // The crosshair position goes along so the bot can react to being aimed at.
  if (duel && duel.phase !== 'over') dispatch({ type: 'tick', now: performance.now(), aim: duel.phase === 'aim' && !aim.suspended ? aim.current : undefined });
}, 10);

// ---- Screen input ----

game.onFire = (t) => {
  // Use the aim from slightly before the tap (the look-back setting), so the
  // thumb press doesn't move the shot.
  // No shooting while the gun is lowered (aiming paused).
  // While venting a heat gun, a tap is the timed-vent attempt (even with the phone still lowered).
  if (duel?.phase === 'aim' && duel.player.venting) {
    dispatch({ type: 'ventTap', now: t });
  } else if (duel?.phase === 'aim' && !aim.suspended) {
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
// Revolver ready again after a kick: a soft hammer click, the rhythm cue.
game.onSettled = (weapon) => {
  // The scattergun's pump is already in its blast sound.
  if (weapon === 'star-revolver') audio.cock();
};
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
  profiles.update({ alien: l.creature, gun: l.weapon });
};
start.onSwitchProfile = (id) => {
  profiles.switchTo(id);
  applyProfile();
};
start.onNewProfile = () => {
  const name = window.prompt('Name for the new gunslinger', profiles.nextName());
  if (name == null) return;
  profiles.create(name);
  applyProfile();
};
start.onRenameProfile = (name) => {
  profiles.update({ name });
  applyProfile();
};
start.onPaint = (paint) => {
  profiles.update({ paint });
  game.setPaint(paint);
};
start.onDeleteProfile = () => {
  const p = profiles.active;
  if (profiles.list.length <= 1) return;
  if (!window.confirm(`Delete ${p.name}? Their picks and settings will be gone from this phone.`)) return;
  profiles.remove(p.id);
  applyProfile();
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
  profiles.update({ settings: { ...s } });
};
settingsView.onReset = () => {
  applySettings({ ...DEFAULT_SETTINGS });
  profiles.update({ settings: { ...settings } });
  settingsView.setValues(settings);
};
settingsView.onExport = () => profiles.exportCode();
settingsView.onImport = (code) => {
  const r = profiles.importCode(code);
  if ('error' in r) return r.error;
  applyProfile();
  const s = (n: number) => (n === 1 ? '' : 's');
  return `Restored ${r.restored} gunslinger${s(r.restored)}.` + (r.skipped ? ` ${r.skipped} didn't fit (8 at most): delete some and restore again.` : '');
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
// A newer build is live: offer a reload (checked on the start screen only, never mid-duel).
let latest = '';
watchForUpdate(() => start.visible, (v) => {
  latest = v;
  start.showUpdate(v);
});
start.onUpdate = () => reloadToLatest(latest);
// Upload anything left over from earlier sessions.
void flush();

// Expose for debugging in the browser console.
(window as unknown as Record<string, unknown>).__duel = { get state() { return duel; }, dispatch, newRound, gestures, aim };
