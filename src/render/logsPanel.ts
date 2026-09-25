// Settings > Test logs: phone label, upload key, upload status, Upload now and Share.
import { allRounds } from '../telemetry/store';
import { shareJson } from '../telemetry/share';
import { checkKey, flush, getKey, getLabel, onStatus, refreshCounts, setKey, setLabel, status, type KeyCheck } from '../telemetry/upload';

const KEY_TEXT: Record<KeyCheck | 'checking', string> = {
  ok: 'Uploading is on.',
  none: 'Uploading is off (no key). Rounds are still saved on this phone.',
  rejected: 'GitHub refused this key. Check it was copied fully and has access to high-moon-logs.',
  offline: 'Could not reach GitHub. Will retry when online.',
  checking: 'Checking the key...',
};

export function mountLogsPanel(el: HTMLElement) {
  el.innerHTML = `
    <h2>Test logs</h2>
    <p class="help">Every round is recorded on this phone (the last 30). With an upload key, each one goes
      straight to Claude's private logs folder on GitHub, so you never need to copy anything.</p>
    <p class="log-status" id="lg-status" style="text-align:left"></p>
    <div class="setting"><div class="row"><span>Phone label</span></div>
      <input class="field" id="lg-label" maxlength="24" placeholder="e.g. aaron-iphone" autocomplete="off" autocapitalize="off">
      <p class="help">Shown on your logs so Claude knows whose phone they came from. Stays private.</p>
    </div>
    <div class="setting"><div class="row"><span>Upload key</span><b id="lg-keystate"></b></div>
      <input class="field" id="lg-key" type="password" placeholder="Paste the GitHub key here" autocomplete="off" autocapitalize="off" spellcheck="false">
      <div class="btn-row">
        <button class="secondary small-btn" id="lg-save">Save key</button>
        <button class="secondary small-btn" id="lg-remove">Remove key</button>
      </div>
      <p class="help" id="lg-keyhelp"></p>
    </div>
    <div class="btn-row">
      <button class="small-btn" id="lg-upload">Upload now</button>
      <button class="secondary small-btn" id="lg-share">Share all logs</button>
    </div>`;
  const $ = <T extends HTMLElement>(id: string) => el.querySelector<T>('#' + id)!;
  const label = $<HTMLInputElement>('lg-label');
  const key = $<HTMLInputElement>('lg-key');
  label.value = getLabel();
  label.addEventListener('change', () => setLabel(label.value));

  const showKey = (c: KeyCheck | 'checking') => {
    $('lg-keyhelp').textContent = KEY_TEXT[c];
    $('lg-keystate').textContent = getKey() ? 'saved' : 'none';
    key.value = '';
    key.placeholder = getKey() ? 'Key saved (paste a new one to replace)' : 'Paste the GitHub key here';
  };
  const recheck = () => {
    showKey('checking');
    void checkKey().then((c) => {
      showKey(c);
      if (c === 'ok') void flush();
    });
  };
  $('lg-save').addEventListener('click', () => {
    if (key.value.trim()) setKey(key.value);
    recheck();
  });
  $('lg-remove').addEventListener('click', () => {
    setKey('');
    recheck();
  });
  $('lg-upload').addEventListener('click', () => void flush());

  // Sharing must start straight from the tap (iPhone rule), so the rounds are
  // read ahead of time whenever the panel is shown.
  let cached: unknown[] = [];
  const preload = () => void allRounds().then((rows) => (cached = rows.map((r) => r.log)));
  $('lg-share').addEventListener('click', () => {
    const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
    void shareJson(`high-moon-logs-${stamp}.json`, cached);
  });

  const render = () => {
    const parts = [`${status.saved} round${status.saved === 1 ? '' : 's'} saved on this phone`];
    if (status.busy) parts.push('uploading...');
    else if (status.waiting) parts.push(`${status.waiting} waiting to upload`);
    else if (status.saved) parts.push('all uploaded');
    if (status.lastError) parts.push(status.lastError);
    $('lg-status').textContent = parts.join(' · ');
  };
  onStatus(render);
  render();

  return {
    /** Call when Settings opens. */
    opened() {
      preload();
      void refreshCounts();
      recheck();
    },
  };
}
