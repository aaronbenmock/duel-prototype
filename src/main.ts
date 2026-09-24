// Wires sensors, game rules, sound and screens together.
import './style.css';
import { AudioEngine } from './audio/audio';
import { createDuel, DEFAULT_CONFIG, step } from './game/duel';
import type { Action, DuelState, Effect } from './game/types';
import { AimTracker } from './input/aim';
import { GestureDetector } from './input/gestures';
import { MotionSensors } from './input/motion';
import { installRotateOverlay, ScreenAwake, vibrate } from './platform/platform';
import { GameView } from './render/gameView';
import { mountSensorCheck } from './render/sensorCheck';
import { StartView } from './render/startView';

const sensors = new MotionSensors();
const audio = new AudioEngine();
const awake = new ScreenAwake();
const gestures = new GestureDetector();
const aim = new AimTracker();

const app = document.getElementById('app')!;
installRotateOverlay();

const start = new StartView(app);
const game = new GameView(document.body);
const sensorScreen = document.createElement('div');
sensorScreen.className = 'hidden';
app.appendChild(sensorScreen);
let sensorMounted = false;

let duel: DuelState | null = null;
let motionOn = false;

function show(screen: 'start' | 'game' | 'sensors') {
  start.show(screen === 'start');
  game.show(screen === 'game');
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
      if (e.zone === 'head') audio.headshot();
      else if (e.zone === 'torso') audio.hit();
      else audio.miss();
      game.flash('muzzle');
      vibrate(30);
      break;
    case 'empty':
      audio.empty();
      break;
    case 'reload':
      audio.reload();
      break;
    case 'botShot':
      audio.botShot();
      if (e.zone) {
        audio.hurt();
        game.flash('hurt');
        vibrate(250);
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
  gestures.reset();
  aim.unlock();
  duel = createDuel(DEFAULT_CONFIG, (Math.random() * 2 ** 32) >>> 0, performance.now());
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
    case 'aim':
      aim.update(s.q, s.t);
      break;
  }
});

sensors.onMotion((s) => {
  const flick = gestures.updateMotion(s);
  // The flick only reloads an empty gun, so an aiming jerk can't reload by accident.
  if (flick && duel?.phase === 'aim' && duel.player.rounds === 0) dispatch({ type: 'reload', now: s.t });
});

// Game clock. Runs on a timer (not animation frames) so DRAW fires on time
// even if the browser slows down drawing.
setInterval(() => {
  if (duel && duel.phase !== 'over') dispatch({ type: 'tick', now: performance.now() });
}, 10);

// ---- Screen input ----

game.onFire = (t) => {
  // Use the aim from 80 ms before the tap, so the thumb press doesn't move the shot.
  if (duel?.phase === 'aim') dispatch({ type: 'fire', now: t, aim: aim.at(t - 80) });
};
game.onReload = () => dispatch({ type: 'reload', now: performance.now() });
game.onAgain = () => {
  audio.unlock();
  newRound();
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

function frame() {
  if (duel) game.render(duel, aim.current, duel.phase === 'aim');
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

show('start');

// Expose for debugging in the browser console.
(window as unknown as Record<string, unknown>).__duel = { get state() { return duel; }, dispatch, newRound, gestures, aim };
