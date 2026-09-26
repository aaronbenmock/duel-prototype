// Check for the wardrobe rules (not part of the game build): unlock progress, wording, outfit cleaning,
// the bot's per-round skin and the catalogue's own consistency.
// Run like src/dev/statsCheck.ts:
//   npx vite build --ssr src/dev/wardrobeCheck.ts --outDir <scratch>/wardrobebuild
//   node -e "import('file:///<scratch>/wardrobebuild/wardrobeCheck.js').then((m) => m.check())"
import { ALIENS } from '../game/creatures';
import { WEAPONS } from '../game/weapons';
import { addRound, emptyStats, type RoundInput } from '../stats/stats';
import {
  botBuckleForSeed, botSkinForSeed, CATALOGUE, cleanOutfit, emptyOutfit, isUnlocked, itemsFor, newlyUnlocked, ORIGINAL, progress, ruleText, skinOf,
} from '../wardrobe/wardrobe';

function eq(label: string, got: unknown, want: unknown) {
  const g = JSON.stringify(got);
  const w = JSON.stringify(want);
  if (g !== w) throw new Error(`${label}: got ${g}, expected ${w}`);
}

let n = 0;
function win(gun = 'star-revolver', bot = 'normal', map = 'alien-frontier', draw = 500, fight = 9000): RoundInput {
  n++;
  return {
    id: 'w' + n, startedAt: `2026-09-27T10:${String(n).padStart(2, '0')}:00.000Z`, result: 'victory',
    drawSignalMs: 3000, drawnMs: 3000 + draw, durationMs: 3000 + fight,
    loadout: { alien: 'desert-sage', gun }, opponent: { creature: 'desert-blue', bot }, map,
    stats: { shots: 8, hits: 6, faceHits: 2 },
  };
}

export function check() {
  n = 0;
  const s = emptyStats();
  eq('wins progress at 0', progress({ kind: 'wins', n: 5 }, s), { have: 0, need: 5, met: false });
  for (let i = 0; i < 3; i++) addRound(s, win());
  eq('wins progress at 3', progress({ kind: 'wins', n: 5 }, s), { have: 3, need: 5, met: false });
  eq('wording with progress', ruleText({ kind: 'wins', n: 5 }, s), 'Win 5 rounds (3 / 5)');
  eq('streak met', progress({ kind: 'streak', n: 3 }, s).met, true);
  eq('wording once met (no count)', ruleText({ kind: 'streak', n: 3 }, s), 'Win 3 in a row');
  eq('face hits', progress({ kind: 'faceHits', n: 6 }, s).met, true);
  eq('gun wins', progress({ kind: 'gunWins', gun: 'desert-raygun', gunName: 'Raygun', n: 1 }, s).met, false);
  addRound(s, win('desert-raygun', 'hard', 'saltflat-oasis', 280, 6000));
  eq('gun wins after a raygun win', progress({ kind: 'gunWins', gun: 'desert-raygun', gunName: 'Raygun', n: 1 }, s).met, true);
  eq('hard wins', progress({ kind: 'hardWins', n: 1 }, s).met, true);
  eq('maps won on', progress({ kind: 'maps', n: 2 }, s), { have: 2, need: 2, met: true });
  eq('draw under 0.30 s', progress({ kind: 'draw', ms: 300 }, s).met, true);
  eq('draw under 0.25 s', progress({ kind: 'draw', ms: 250 }, s).met, false);
  eq('fast win', progress({ kind: 'fastWin', ms: 6000 }, s).met, true);
  eq('wording: gun', ruleText({ kind: 'gunWins', gun: 'desert-raygun', gunName: 'Raygun', n: 5 }, s), 'Win 5 rounds with the raygun (1 / 5)');
  eq('wording: draw', ruleText({ kind: 'draw', ms: 350 }), 'Draw in 0.35 s or faster');

  // Outfits: junk is cleaned; unknown or other aliens' skins fall back to the original.
  eq('clean junk', cleanOutfit({ skins: { 'desert-sage': 5 }, charm: 7 }), emptyOutfit());
  eq('clean null', cleanOutfit(null), emptyOutfit());
  eq('unknown skin draws the original', skinOf({ skins: { 'desert-sage': 'desert-sage:nope' }, charm: null, buckle: null }, 'desert-sage'), ORIGINAL);

  // Catalogue: ids unique, skins belong to a real alien, rules name real guns, and ids are "alien:name" for skins.
  const ids = CATALOGUE.map((i) => i.id);
  eq('ids unique', new Set(ids).size, ids.length);
  for (const it of CATALOGUE) {
    if (it.slot === 'skin') {
      eq(`skin ${it.id} has a real alien`, ALIENS.some((a) => a.id === it.alien), true);
      eq(`skin ${it.id} id format`, it.id.startsWith(it.alien + ':'), true);
    }
    if (it.unlock?.kind === 'gunWins') eq(`${it.id} gun exists`, !!WEAPONS[it.unlock.gun], true);
  }
  // Each alien: at least one free skin besides the original once skins exist (starter item).
  for (const a of ALIENS) {
    const skins = itemsFor('skin', a.id);
    if (skins.length) eq(`${a.name} has a free skin`, skins.some((i) => !i.unlock), true);
  }

  // Bot skin: stable for a seed, always one of that alien's skins (or the original), and varied.
  for (const a of ALIENS) {
    const seen = new Set<string>();
    const names = new Set([ORIGINAL, ...itemsFor('skin', a.id).map((i) => i.id.split(':')[1])]);
    for (let seed = 1; seed < 400; seed++) {
      const k = botSkinForSeed(seed * 7919, a.id);
      eq('bot skin stable', botSkinForSeed(seed * 7919, a.id), k);
      eq(`bot skin valid (${a.id} ${k})`, names.has(k), true);
      seen.add(k);
    }
    eq(`bot skins all used (${a.id})`, seen.size, names.size);
  }

  // Bot buckle: none about half the time, otherwise a real buckle, every buckle used.
  const buckles = new Map<string, number>();
  for (let seed = 1; seed < 2000; seed++) {
    const b = botBuckleForSeed(seed * 104729) ?? 'none';
    buckles.set(b, (buckles.get(b) ?? 0) + 1);
    eq('bot buckle valid', b === 'none' || CATALOGUE.some((i) => i.id === b && i.slot === 'buckle'), true);
  }
  eq('bot buckles all used', buckles.size, CATALOGUE.filter((i) => i.slot === 'buckle').length + 1);
  const none = (buckles.get('none') ?? 0) / 1999;
  eq('bot buckle none about half', none > 0.4 && none < 0.6, true);

  // Unlocks announced once: nothing new when the stats didn't change.
  eq('no new unlocks without progress', newlyUnlocked(s, s).length, 0);
  const fresh = emptyStats();
  const everything = CATALOGUE.filter((i) => i.unlock && isUnlocked(i, s)).length;
  eq('unlocks from nothing = everything unlocked now', newlyUnlocked(fresh, s).length, everything);

  const msg = `wardrobe check: all passed (${CATALOGUE.length} items)`;
  console.log(msg);
  return msg;
}
