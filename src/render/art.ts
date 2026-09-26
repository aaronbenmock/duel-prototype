// Which image files the screens use for each alien, gun and map (all from art/exports/).
import frontierUrl from '../../art/exports/backgrounds/bg_alien-frontier.webp';
import outpostUrl from '../../art/exports/backgrounds/bg_desert-outpost.webp';
import canyonUrl from '../../art/exports/backgrounds/bg_moonlit-canyon.webp';
import biolumUrl from '../../art/exports/backgrounds/bg_bioluminescent-canyon.webp';
import cometUrl from '../../art/exports/backgrounds/bg_comet-rail-station.webp';
import lunarUrl from '../../art/exports/backgrounds/bg_lunar-mining-town.webp';
import saltflatUrl from '../../art/exports/backgrounds/bg_saltflat-oasis.webp';
import blueUrl from '../../art/exports/creatures/creature_desert-blue_revolver_front.webp';
import blueZonesUrl from '../../art/exports/creatures/creature_desert-blue_revolver_front_hitzones.webp';
import goldUrl from '../../art/exports/creatures/creature_desert-gold_revolver_front.webp';
import goldZonesUrl from '../../art/exports/creatures/creature_desert-gold_revolver_front_hitzones.webp';
import sageUrl from '../../art/exports/creatures/creature_desert-sage_revolver_front.webp';
import sageZonesUrl from '../../art/exports/creatures/creature_desert-sage_revolver_front_hitzones.webp';
import violetUrl from '../../art/exports/creatures/creature_desert-violet_revolver_front.webp';
import violetZonesUrl from '../../art/exports/creatures/creature_desert-violet_revolver_front_hitzones.webp';
import revolverSideUrl from '../../art/exports/ui/weapon_star-revolver_side.webp';
import revolverBlueUrl from '../../art/exports/weapons/weapon_star-revolver_blue_pov.webp';
import revolverGoldUrl from '../../art/exports/weapons/weapon_star-revolver_gold_pov.webp';
import revolverSageUrl from '../../art/exports/weapons/weapon_star-revolver_sage_pov.webp';
import revolverVioletUrl from '../../art/exports/weapons/weapon_star-revolver_violet_pov.webp';
import raySideUrl from '../../art/exports/ui/weapon_desert-raygun_side.webp';
import rayBlueUrl from '../../art/exports/weapons/weapon_desert-raygun_blue_pov.webp';
import rayGoldUrl from '../../art/exports/weapons/weapon_desert-raygun_gold_pov.webp';
import raySageUrl from '../../art/exports/weapons/weapon_desert-raygun_sage_pov.webp';
import rayVioletUrl from '../../art/exports/weapons/weapon_desert-raygun_violet_pov.webp';
import scatterSideUrl from '../../art/exports/ui/weapon_wrapped-scattergun_side.webp';
import scatterBlueUrl from '../../art/exports/weapons/weapon_wrapped-scattergun_blue_pov.webp';
import scatterGoldUrl from '../../art/exports/weapons/weapon_wrapped-scattergun_gold_pov.webp';
import scatterSageUrl from '../../art/exports/weapons/weapon_wrapped-scattergun_sage_pov.webp';
import scatterVioletUrl from '../../art/exports/weapons/weapon_wrapped-scattergun_violet_pov.webp';
export { default as LOGO_URL } from '../../art/exports/ui/ui_high-moon_logo.webp';

export interface MapArt {
  url: string;
  /** Background image size in pixels (all are 1290 x 2796 portrait). */
  w: number;
  h: number;
  /** Where the opponent's feet stand, as a fraction of the image height (same depth below each map's horizon). */
  streetFrac: number;
}

/** By map id (src/game/maps.ts). */
export const MAP_ART: Record<string, MapArt> = {
  'alien-frontier': { url: frontierUrl, w: 1290, h: 2796, streetFrac: 0.54 },
  'moonlit-canyon': { url: canyonUrl, w: 1290, h: 2796, streetFrac: 0.53 },
  'desert-outpost': { url: outpostUrl, w: 1290, h: 2796, streetFrac: 0.525 },
  // v0.6.11 (wardrobe-worlds batch): street lines at the same 0.11 depth below each horizon as frontier.
  'saltflat-oasis': { url: saltflatUrl, w: 1290, h: 2796, streetFrac: 0.515 },
  'lunar-mining-town': { url: lunarUrl, w: 1290, h: 2796, streetFrac: 0.52 },
  'bioluminescent-canyon': { url: biolumUrl, w: 1290, h: 2796, streetFrac: 0.53 },
  'comet-rail-station': { url: cometUrl, w: 1290, h: 2796, streetFrac: 0.515 },
};

export interface CreatureArt {
  url: string;
  zonesUrl: string;
  /** Where its paint shots start (its gun muzzle), in canvas pixels. */
  handPx: [number, number];
}

export const CREATURE_ART: Record<string, CreatureArt> = {
  'desert-sage': { url: sageUrl, zonesUrl: sageZonesUrl, handPx: [58, 293] },
  'desert-blue': { url: blueUrl, zonesUrl: blueZonesUrl, handPx: [40, 285] },
  'desert-gold': { url: goldUrl, zonesUrl: goldZonesUrl, handPx: [35, 287] },
  'desert-violet': { url: violetUrl, zonesUrl: violetZonesUrl, handPx: [22, 285] },
};

export interface GunArt {
  /** First-person view (hand and gun), by alien. */
  pov: Record<string, string>;
  /** Side view for the picker. */
  side: string;
  /** Where the paint leaves the gun, as a fraction of the first-person image (from the art manifest).
   *  Violet's hands (v0.6.10) are recolours of sage's pictures (outlines match within 0.4%), so the same anchors fit. */
  muzzle: { x: number; y: number };
  /** CSS class for placement (two-handed guns sit wider). */
  cls: string;
  /** Grip point (fraction of the image): if set, the picture is turned so the grip-to-muzzle line points at the crosshair. */
  grip?: { x: number; y: number };
  /** CSS filter for this gun's paint (the raygun's bolts are green). */
  tint?: string;
}

export const GUN_ART: Record<string, GunArt> = {
  'star-revolver': {
    pov: { 'desert-sage': revolverSageUrl, 'desert-blue': revolverBlueUrl, 'desert-gold': revolverGoldUrl, 'desert-violet': revolverVioletUrl },
    side: revolverSideUrl,
    muzzle: { x: 0.47, y: 0.13 },
    cls: 'vm-onehand',
  },
  'wrapped-scattergun': {
    pov: { 'desert-sage': scatterSageUrl, 'desert-blue': scatterBlueUrl, 'desert-gold': scatterGoldUrl, 'desert-violet': scatterVioletUrl },
    side: scatterSideUrl,
    muzzle: { x: 0.367, y: 0.207 },
    grip: { x: 0.7, y: 0.7 },
    cls: 'vm-twohand',
  },
  'desert-raygun': {
    pov: { 'desert-sage': raySageUrl, 'desert-blue': rayBlueUrl, 'desert-gold': rayGoldUrl, 'desert-violet': rayVioletUrl },
    side: raySideUrl,
    muzzle: { x: 0.497, y: 0.168 },
    cls: 'vm-onehand',
    tint: 'hue-rotate(75deg) saturate(1.4)',
  },
};
