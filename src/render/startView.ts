// Start screen with a bottom tab bar:
//   Main Street (your gunslinger, Enable Motion, Draw!), Outfitter (name, alien, gun, paint),
//   Wanted Poster (stats). How to play opens as a sheet; Settings stays top-right.
import { alienName, ALIENS } from '../game/creatures';
import type { Loadout } from '../game/types';
import { WEAPONS } from '../game/weapons';
import { MAX_PROFILES, NAME_MAX, PAINTS, type Profile } from '../settings/profiles';
import { APP_VERSION } from '../settings/settings';
import { isUnlocked, itemsFor, ORIGINAL, ruleText, skinOf, SLOTS, wornItem, type Slot } from '../wardrobe/wardrobe';
import { BUCKLE_FIT, CREATURE_ART, creatureUrl, GUN_ART, ITEM_ART, LOGO_URL, PAINT_ART, paintCss } from './art';
import fxSplatUrl from '../../art/exports/effects/fx_paint-yellow_splat-a.webp';

export type StartTab = 'main' | 'outfit' | 'poster';
const TABS: { id: StartTab; label: string; icon: string }[] = [
  // Small line icons: storefront, hat, poster.
  { id: 'main', label: 'Main Street', icon: '<path d="M3 10h18M5 10v10h14V10M4 10l2-6h12l2 6M10 20v-5h4v5"/>' },
  { id: 'outfit', label: 'Outfitter', icon: '<path d="M2 16c3 2 17 2 20 0M6 15.5 7.5 6c.3-1.5 2-2 3-1l1.5 1 1.5-1c1-1 2.7-.5 3 1l1.5 9.5"/>' },
  { id: 'poster', label: 'Wanted Poster', icon: '<path d="M5 3h14v18H5zM8 7h8M12 10a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5M8 18h8"/>' },
];
const TAB_KEY = 'high-moon-start-tab';

function loadTab(): StartTab {
  try {
    const t = localStorage.getItem(TAB_KEY);
    if (t && TABS.some((x) => x.id === t)) return t as StartTab;
  } catch {
    // Storage blocked: start on Main Street.
  }
  return 'main';
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

export class StartView {
  readonly el: HTMLElement;
  onEnable: () => void = () => {};
  onStart: () => void = () => {};
  onSensorCheck: () => void = () => {};
  onSettings: () => void = () => {};
  onPick: (l: Loadout) => void = () => {};
  onSwitchProfile: (id: string) => void = () => {};
  onNewProfile: () => void = () => {};
  onRenameProfile: (name: string) => void = () => {};
  onDeleteProfile: () => void = () => {};
  onPaint: (id: string) => void = () => {};
  /** Put on an item (null = the original look / nothing in that slot). */
  onWear: (slot: Slot, id: string | null) => void = () => {};
  onTipDone: () => void = () => {};
  onTab: (tab: StartTab) => void = () => {};
  onUpdate: () => void = () => {};
  private loadout: Loadout = { creature: '', weapon: '' };
  private paint = 'yellow';
  private tab: StartTab = loadTab();
  private enableBtn: HTMLButtonElement;
  private statusEl: HTMLElement;
  private sheet: HTMLElement;

  constructor(parent: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'screen start';
    this.el.innerHTML = `
      <button class="secondary gear" id="s-settings" aria-label="Settings">&#9881; Settings</button>

      <section class="tab-page" data-page="main">
        <button class="secondary gear howto-btn" id="s-howto">? How to play</button>
        <h1 class="title"><img class="logo" src="${LOGO_URL}" alt="High Moon"></h1>
        <p class="sub">Beta &middot; v${APP_VERSION}</p>
        <div class="panel tip hidden" id="s-tip">
          <p><b>Keep your gunslingers:</b> iPhone Safari can clear a website's saved data after about a week without a visit. Add High Moon to your Home Screen (Share, then Add to Home Screen) to keep it, or back up in Settings.</p>
          <button class="secondary small-btn" id="s-tip-ok">Got it</button>
        </div>
        <div class="panel slinger">
          <div class="slinger-row">
            <span class="portrait" id="s-portrait"><img alt=""></span>
            <div class="slinger-text">
              <div class="slinger-name" id="s-name"></div>
              <div class="slinger-meta" id="s-meta"></div>
            </div>
          </div>
          <div class="switch-row">
            <select class="field" id="s-profile" aria-label="Switch gunslinger"></select>
            <button class="secondary small-btn" id="s-p-new">+ New</button>
          </div>
        </div>
        <button id="s-enable">Enable Motion</button>
        <button class="draw-btn" id="s-start">Draw!</button>
        <p class="status" id="s-status"></p>
      </section>

      <section class="tab-page" data-page="outfit">
        <h1 class="page-title">Outfitter</h1>
        <div class="panel picker">
          <h2>Name</h2>
          <input class="field" id="s-o-name" maxlength="${NAME_MAX}" autocomplete="off" autocapitalize="words" enterkeyhint="done">
          <h2>Your alien</h2>
          <div class="picks" id="s-aliens">${ALIENS.map((a) => `
            <button class="pick" data-alien="${a.id}"><span class="face"><img src="${CREATURE_ART[a.id].url}" alt=""></span>${a.name}</button>`).join('')}
          </div>
          <h2>Your gun</h2>
          <div class="picks" id="s-guns">${Object.values(WEAPONS).filter((w) => GUN_ART[w.id]).map((w) => `
            <button class="pick" data-gun="${w.id}"><span class="gun"><img src="${GUN_ART[w.id].side}" alt=""></span>${w.name}<span class="note">${w.blurb}</span></button>`).join('')}
          </div>
          <h2>Your paint</h2>
          <div class="paints" id="s-paints">${PAINTS.map((p) => `
            <button class="paint" data-paint="${p}" aria-label="${PAINT_ART[p].name}"><img src="${fxSplatUrl}" alt="" style="filter: ${paintCss(p) || 'none'}"></button>`).join('')}
          </div>
          <p class="help">Aliens and paint are looks only: every alien is just as easy to hit. The opponent's paint is always teal. Changes save straight away.</p>
        </div>
        <div class="panel wardrobe" id="s-wardrobe"></div>
        <button class="secondary small-btn danger" id="s-p-delete">Delete this gunslinger</button>
      </section>

      <section class="tab-page" data-page="poster">
        <h1 class="page-title">Wanted Poster</h1>
        <div id="s-poster"><div class="panel poster-empty"><p>Play a round to start your record.</p></div></div>
      </section>

      <button class="update-bar hidden" id="s-update"></button>

      <nav class="tabbar" id="s-tabs">${TABS.map((t) => `
        <button data-tab="${t.id}"><svg viewBox="0 0 24 24" aria-hidden="true">${t.icon}</svg><span>${t.label}</span></button>`).join('')}
      </nav>

      <div class="sheet hidden" id="s-sheet" role="dialog" aria-label="How to play">
        <div class="sheet-body">
          <div class="settings-head"><h1>How to play</h1><button class="secondary small-btn" data-close>Close</button></div>
          <div class="panel how">
            <ol>
              <li>Tap <b>Draw!</b>, then hang the phone at your hip, top pointing at the floor. Hold still until you hear the ready click.</li>
              <li>Don't move until the loud <b>DRAW</b> sound. Moving early is a foul.</li>
              <li>Raise the phone upright, screen facing you, like aiming a revolver.</li>
              <li>Turn the phone to move the crosshair. Tap anywhere to fire paint. Face = 20, body = 9, arms and legs = 5, tail = 2 (everyone has 100). The hat, Violet's braids and the opponent's gun don't count.</li>
              <li>Tip the phone sideways to sidestep left or right. A moving target is harder for the bot to hit.</li>
              <li>To reload, dip the phone to point at the floor, then raise it again. Rounds go in one at a time (a full cylinder takes about a second) and you can't fire until it's done. Watch for the opponent's RELOADING tag: that's your moment.</li>
              <li>The revolver kicks up and right after each shot, then settles (white pop and a click). Wait for it, or learn to pull down against the kick and fire faster.</li>
              <li>Scattergun: hold steady and the ring shrinks to a tight pattern; each blast kicks hard; you can fire mid-reload once a shell is in. Raygun: bolts take a moment to fly, so aim ahead of a moving target; vent before it overheats, and tap when the vent marker is in the green for a perfect vent.</li>
              <li>Your opponent is a different alien each round, on a random map. Aim feel, detection and bot difficulty are in <b>Settings</b>.</li>
            </ol>
          </div>
          <button class="secondary" id="s-sensors">Sensor check</button>
          <button class="secondary" data-close>Close</button>
        </div>
      </div>`;
    parent.appendChild(this.el);
    const $ = <T extends HTMLElement = HTMLElement>(sel: string) => this.el.querySelector<T>(sel)!;
    this.enableBtn = $<HTMLButtonElement>('#s-enable');
    this.statusEl = $('#s-status');
    this.sheet = $('#s-sheet');

    this.enableBtn.addEventListener('click', () => this.onEnable());
    $('#s-start').addEventListener('click', () => this.onStart());
    $('#s-settings').addEventListener('click', () => this.onSettings());
    $('#s-update').addEventListener('click', () => this.onUpdate());
    $('#s-howto').addEventListener('click', () => this.sheet.classList.remove('hidden'));
    this.sheet.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => this.sheet.classList.add('hidden')));
    $('#s-sensors').addEventListener('click', () => {
      this.sheet.classList.add('hidden');
      this.onSensorCheck();
    });
    const sel = $<HTMLSelectElement>('#s-profile');
    sel.addEventListener('change', () => this.onSwitchProfile(sel.value));
    $('#s-p-new').addEventListener('click', () => this.onNewProfile());
    $('#s-p-delete').addEventListener('click', () => this.onDeleteProfile());
    const name = $<HTMLInputElement>('#s-o-name');
    name.addEventListener('change', () => this.onRenameProfile(name.value));
    name.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') name.blur();
    });
    $('#s-tip-ok').addEventListener('click', () => {
      this.showTip(false);
      this.onTipDone();
    });
    this.el.querySelectorAll<HTMLButtonElement>('.pick').forEach((b) =>
      b.addEventListener('click', () => {
        if (b.dataset.alien) this.loadout.creature = b.dataset.alien;
        if (b.dataset.gun) this.loadout.weapon = b.dataset.gun;
        this.refreshPicks();
        this.onPick({ ...this.loadout });
      }),
    );
    this.el.querySelectorAll<HTMLButtonElement>('.paint').forEach((b) =>
      b.addEventListener('click', () => {
        this.paint = b.dataset.paint!;
        this.refreshPicks();
        this.onPaint(this.paint);
      }),
    );
    // Wardrobe buttons are rebuilt with the gunslinger, so listen on the panel.
    $('#s-wardrobe').addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-slot]');
      if (!b) return;
      const msg = $('#s-w-msg');
      if (b.dataset.locked) {
        msg.textContent = `Locked: ${b.dataset.locked}`;
        return;
      }
      msg.textContent = '';
      this.onWear(b.dataset.slot as Slot, b.dataset.item || null);
    });
    this.el.querySelectorAll<HTMLButtonElement>('#s-tabs button').forEach((b) =>
      b.addEventListener('click', () => this.setTab(b.dataset.tab as StartTab)),
    );
    this.setTab(this.tab);
  }

  get currentTab(): StartTab {
    return this.tab;
  }

  setTab(tab: StartTab) {
    this.tab = tab;
    this.el.querySelectorAll<HTMLElement>('.tab-page').forEach((p) => p.classList.toggle('hidden', p.dataset.page !== tab));
    this.el.querySelectorAll<HTMLButtonElement>('#s-tabs button').forEach((b) => {
      const on = b.dataset.tab === tab;
      b.classList.toggle('on', on);
      b.setAttribute('aria-current', on ? 'page' : 'false');
    });
    window.scrollTo(0, 0);
    try {
      localStorage.setItem(TAB_KEY, tab);
    } catch {
      // Storage blocked: the tab still changes.
    }
    this.onTab(tab);
  }

  /** Shows the active gunslinger (card, switcher, Outfitter). */
  setProfiles(list: readonly Profile[], active: Profile) {
    const $ = <T extends HTMLElement = HTMLElement>(sel: string) => this.el.querySelector<T>(sel)!;
    $<HTMLSelectElement>('#s-profile').replaceChildren(...list.map((p) => new Option(p.name, p.id, false, p.id === active.id)));
    $<HTMLButtonElement>('#s-p-new').disabled = list.length >= MAX_PROFILES;
    $<HTMLButtonElement>('#s-p-delete').disabled = list.length <= 1;
    $('#s-name').textContent = active.name;
    $('#s-meta').innerHTML = `${esc(alienName(active.alien))} &middot; ${esc(WEAPONS[active.gun]?.name ?? '')}`;
    $<HTMLImageElement>('#s-portrait img').src = creatureUrl(active.alien, skinOf(active.outfit, active.alien));
    // Each alien in the picker wears the skin this gunslinger chose for it.
    this.el.querySelectorAll<HTMLImageElement>('.pick[data-alien] img').forEach((img) => {
      const a = (img.closest('.pick') as HTMLElement).dataset.alien!;
      img.src = creatureUrl(a, skinOf(active.outfit, a));
    });
    this.renderWardrobe(active);
    const name = $<HTMLInputElement>('#s-o-name');
    if (document.activeElement !== name) name.value = active.name;
    this.loadout = { creature: active.alien, weapon: active.gun };
    this.paint = active.paint;
    this.refreshPicks();
  }

  /** Skin and item choices for the active gunslinger; locked items show how to earn them. */
  private renderWardrobe(p: Profile) {
    const slots = SLOTS.map((slot) => {
      const items = itemsFor(slot.id, p.alien);
      if (!items.length) return '';
      const worn = slot.id === 'skin' ? skinOf(p.outfit, p.alien) : p.outfit[slot.id];
      const none = slot.id === 'skin'
        ? { id: '', name: 'Original', pic: creatureUrl(p.alien, ORIGINAL), on: worn === ORIGINAL, locked: '' }
        : { id: '', name: 'None', pic: '', on: worn == null, locked: '' };
      const list = [none, ...items.map((it) => ({
        id: it.id, name: it.name,
        pic: slot.id === 'skin' ? creatureUrl(p.alien, it.id.split(':')[1]) : ITEM_ART[it.id] ?? '',
        on: slot.id === 'skin' ? worn === it.id.split(':')[1] : worn === it.id,
        locked: isUnlocked(it, p.stats) ? '' : it.unlock ? ruleText(it.unlock, p.stats) : '',
      }))];
      return `
        <h2>${slot.name}</h2>
        <div class="wear-row">${list.map((x) => `
          <button class="wear${x.on ? ' on' : ''}${x.locked ? ' locked' : ''}" data-slot="${slot.id}" data-item="${x.id}"${x.locked ? ` data-locked="${esc(x.locked)}"` : ''} aria-label="${esc(x.name)}">
            <span class="${slot.id === 'skin' ? 'face' : 'thing'}">${x.pic ? `<img src="${x.pic}" alt="">` : '<i>&ndash;</i>'}</span>${esc(x.name)}
          </button>`).join('')}
        </div>`;
    }).join('');
    // Full-length look: skin plus buckle, placed exactly as on the opponent sprite.
    const buckle = wornItem(p.outfit, 'buckle');
    const fit = buckle ? BUCKLE_FIT[p.alien]?.[buckle.id] : undefined;
    const pct = (v: number) => `${(v / 10.24).toFixed(2)}%`;
    const mirror = `
      <div class="mirror"><img src="${creatureUrl(p.alien, skinOf(p.outfit, p.alien))}" alt="${esc(p.name)}">${
        fit && buckle ? `<img class="mirror-buckle" src="${ITEM_ART[buckle.id]}" alt="" style="left:${pct(fit.x)};top:${pct(fit.y)};width:${pct(fit.size)}">` : ''
      }</div>`;
    this.el.querySelector('#s-wardrobe')!.innerHTML = `
      <h2 class="wardrobe-title">Wardrobe</h2>
      ${mirror}
      ${slots || '<p class="help">Outfits arrive soon.</p>'}
      <p class="help" id="s-w-msg"></p>
      <p class="help">Locked items unlock as you play (they're earned from your record on the Wanted Poster). Looks only: nothing you wear changes where you can be hit.</p>`;
  }

  /** Wanted Poster contents (HTML built by the stats view). */
  setPoster(html: string) {
    this.el.querySelector('#s-poster')!.innerHTML = html;
  }

  private refreshPicks() {
    this.el.querySelectorAll<HTMLButtonElement>('.pick').forEach((b) =>
      b.classList.toggle('on', b.dataset.alien === this.loadout.creature || b.dataset.gun === this.loadout.weapon),
    );
    this.el.querySelectorAll<HTMLButtonElement>('.paint').forEach((b) => b.classList.toggle('on', b.dataset.paint === this.paint));
  }

  /** Shows the "Update available" bar above the tabs. */
  showUpdate(version: string) {
    const b = this.el.querySelector('#s-update')!;
    b.textContent = `Update available (v${version}): tap to reload`;
    b.classList.remove('hidden');
  }

  get visible(): boolean {
    return !this.el.classList.contains('hidden');
  }

  showTip(visible: boolean) {
    this.el.querySelector('#s-tip')!.classList.toggle('hidden', !visible);
  }

  show(visible: boolean) {
    this.el.classList.toggle('hidden', !visible);
    if (!visible) this.sheet.classList.add('hidden');
  }

  setMotion(state: 'off' | 'asking' | 'on' | 'denied') {
    this.enableBtn.disabled = state === 'on' || state === 'asking';
    this.enableBtn.textContent = state === 'on' ? 'Motion enabled' : 'Enable Motion';
    const msg = {
      off: '',
      asking: 'Asking for motion access...',
      on: '',
      denied: 'Motion access is blocked. Open How to play > Sensor check for how to turn it back on.',
    }[state];
    this.statusEl.textContent = msg;
    this.statusEl.className = 'status' + (state === 'denied' ? ' err' : '');
  }
}
