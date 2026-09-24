// Milestone 1 screen: permission button plus live sensor readouts.
import type { AudioEngine } from '../audio/audio';
import type { MotionSensors } from '../input/motion';
import { barrelInEarthFrame, upInPhoneFrame } from '../input/quat';
import { canVibrate, vibrate, type ScreenAwake } from '../platform/platform';

const f = (n: number | null | undefined, d = 1) => (n == null || Number.isNaN(n) ? '--' : n.toFixed(d));

/** Rough pose guess from which way "up" points in the phone's frame. */
function poseLabel(up: [number, number, number]): string {
  const [, y, z] = up;
  if (y < -0.75) return 'top pointing down (holster-like)';
  if (y > 0.75) return 'upright (aim-like)';
  if (Math.abs(z) > 0.75) return z > 0 ? 'flat, screen up' : 'flat, screen down';
  return 'in between';
}

export function mountSensorCheck(root: HTMLElement, sensors: MotionSensors, audio: AudioEngine, awake: ScreenAwake) {
  root.innerHTML = `
    <h1>DUEL PROTOTYPE</h1>
    <p class="sub">Milestone 1: sensor and sound check</p>
    <button id="enable">Enable Motion</button>
    <button id="beep" class="secondary hidden">Play test beep again</button>

    <div id="status" class="panel"><div class="grid">
      <span class="k">Motion permission</span><span class="v" id="perm">not asked</span>
      <span class="k">Audio</span><span class="v" id="aud">not started</span>
      <span class="k">Silent-mode audio</span><span class="v" id="sess">--</span>
      <span class="k">Screen awake</span><span class="v" id="wake">--</span>
      <span class="k">Vibration</span><span class="v">${canVibrate ? 'supported' : 'not supported'}</span>
      <span class="k">Secure (HTTPS)</span><span class="v ${window.isSecureContext ? 'ok' : 'err'}">${window.isSecureContext ? 'yes' : 'NO'}</span>
    </div></div>

    <div id="denied" class="panel help hidden">
      <h2 class="err">Motion access was blocked</h2>
      <p>iPhone remembers "Don't Allow" for this site. To reset it:</p>
      <ol>
        <li>Close this Safari tab.</li>
        <li>Open the <b>Settings</b> app, then <b>Apps</b>, then <b>Safari</b>, then <b>Advanced</b>, then <b>Website Data</b>.</li>
        <li>Search <b>github.io</b>, swipe left on it, tap <b>Delete</b>.</li>
        <li>Reopen the game link and tap <b>Enable Motion</b>, then <b>Allow</b>.</li>
      </ol>
      <p>If that doesn't work: Settings, Apps, Safari, <b>Clear History and Website Data</b> (this signs you out of websites).</p>
      <p>On Android Chrome: tap the icon left of the address bar, then <b>Permissions</b> or <b>Site settings</b>, and turn <b>Motion sensors</b> on.</p>
    </div>

    <div id="nodata" class="panel help hidden">
      <h2 class="warn">No sensor data yet</h2>
      <p>This device or browser isn't sending motion data. A laptop won't have sensors. On a phone, check that motion access is allowed (see steps above) and that you're on the https link.</p>
    </div>

    <div class="panel"><h2>Orientation</h2><div class="grid">
      <span class="k">Updates / sec</span><span class="v" id="oHz">--</span>
      <span class="k">alpha (turn)</span><span class="v" id="oA">--</span>
      <span class="k">beta (tilt fwd)</span><span class="v" id="oB">--</span>
      <span class="k">gamma (tilt side)</span><span class="v" id="oG">--</span>
      <span class="k">quaternion</span><span class="v" id="oQ">--</span>
      <span class="k">barrel pitch</span><span class="v" id="oP">--</span>
      <span class="k">barrel heading</span><span class="v" id="oH">--</span>
      <span class="k">pose</span><span class="v" id="oPose">--</span>
    </div></div>

    <div class="panel"><h2>Motion</h2><div class="grid">
      <span class="k">Updates / sec</span><span class="v" id="mHz">--</span>
      <span class="k">reported interval</span><span class="v" id="mInt">--</span>
      <span class="k">accel x y z</span><span class="v" id="mA">--</span>
      <span class="k">accel peak (1s)</span><span class="v" id="mPk">--</span>
      <span class="k">with gravity</span><span class="v" id="mG">--</span>
      <span class="k">rotation rate</span><span class="v" id="mR">--</span>
    </div></div>
  `;

  const $ = (id: string) => root.querySelector<HTMLElement>('#' + id)!;
  const enableBtn = $('enable') as HTMLButtonElement;
  const beepBtn = $('beep');

  enableBtn.addEventListener('click', () => {
    // Everything that needs the tap happens synchronously first.
    audio.unlock();
    const permission = sensors.request();
    void awake.acquire();
    audio.beep();
    vibrate(80);

    $('perm').textContent = 'asking...';
    permission.then((result) => {
      permResult = result;
      beepBtn.classList.remove('hidden');
      if (result === 'granted') {
        enableBtn.textContent = 'Motion enabled';
        enableBtn.disabled = true;
      }
      // If nothing arrives within 2 seconds, say so.
      setTimeout(() => {
        if (!sensors.orientation && !sensors.motion) $('nodata').classList.remove('hidden');
      }, 2000);
    });
  });

  beepBtn.addEventListener('click', () => {
    audio.unlock();
    audio.beep();
    vibrate(80);
  });

  let peak = 0;
  let peakAt = 0;
  sensors.onMotion((s) => {
    if (!s.acc) return;
    const mag = Math.hypot(s.acc.x, s.acc.y, s.acc.z);
    if (mag > peak || s.t - peakAt > 1000) {
      peak = mag;
      peakAt = s.t;
    }
  });

  let permResult: string | null = null;

  const render = () => {
    if (permResult) {
      // Data arriving is the real proof of access, whatever the browser said.
      const receiving = !!(sensors.orientation || sensors.motion);
      const perm = $('perm');
      perm.textContent = receiving ? 'granted' : permResult;
      perm.className = 'v ' + (receiving || permResult === 'granted' ? 'ok' : 'err');
      $('denied').classList.toggle('hidden', receiving || permResult === 'granted');
      if (receiving) $('nodata').classList.add('hidden');
    }

    const aud = $('aud');
    aud.textContent = audio.state;
    aud.className = 'v ' + (audio.state === 'running' ? 'ok' : '');
    $('sess').textContent = audio.sessionStatus === 'playback' ? 'requested' : audio.sessionStatus;
    $('wake').textContent = awake.status;

    const o = sensors.orientation;
    $('oHz').textContent = String(sensors.orientationHz());
    if (o) {
      $('oA').textContent = f(o.alpha) + '°';
      $('oB').textContent = f(o.beta) + '°';
      $('oG').textContent = f(o.gamma) + '°';
      $('oQ').textContent = o.q.map((v) => f(v, 2)).join(' ');
      const b = barrelInEarthFrame(o.q);
      $('oP').textContent = f((Math.asin(Math.max(-1, Math.min(1, b[2]))) * 180) / Math.PI) + '°';
      $('oH').textContent = f((Math.atan2(b[0], b[1]) * 180) / Math.PI) + '°';
      $('oPose').textContent = poseLabel(upInPhoneFrame(o.q));
    }

    const m = sensors.motion;
    $('mHz').textContent = String(sensors.motionHz());
    if (m) {
      $('mInt').textContent = f(m.intervalMs, 0) + ' ms';
      $('mA').textContent = m.acc ? `${f(m.acc.x)} ${f(m.acc.y)} ${f(m.acc.z)}` : 'n/a';
      $('mPk').textContent = f(peak) + ' m/s²';
      $('mG').textContent = m.accG ? `${f(m.accG.x)} ${f(m.accG.y)} ${f(m.accG.z)}` : 'n/a';
      $('mR').textContent = m.rot ? `${f(m.rot.alpha, 0)} ${f(m.rot.beta, 0)} ${f(m.rot.gamma, 0)}` : 'n/a';
    }
    requestAnimationFrame(render);
  };
  requestAnimationFrame(render);
}
