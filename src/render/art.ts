// Which image files the screens use for each alien and gun (all from art/exports/).
import blueUrl from '../../art/exports/creatures/creature_desert-blue_front.webp';
import blueZonesUrl from '../../art/exports/creatures/creature_desert-blue_front_hitzones.webp';
import goldUrl from '../../art/exports/creatures/creature_desert-gold_front.webp';
import goldZonesUrl from '../../art/exports/creatures/creature_desert-gold_front_hitzones.webp';
import sageUrl from '../../art/exports/creatures/creature_desert-sage_front.webp';
import sageZonesUrl from '../../art/exports/creatures/creature_desert-sage_front_hitzones.webp';
import revolverSideUrl from '../../art/exports/ui/weapon_star-revolver_side.webp';
import revolverBlueUrl from '../../art/exports/weapons/weapon_star-revolver_blue_pov.webp';
import revolverGoldUrl from '../../art/exports/weapons/weapon_star-revolver_gold_pov.webp';
import revolverSageUrl from '../../art/exports/weapons/weapon_star-revolver_sage_pov.webp';
import scatterSideUrl from '../../art/exports/ui/weapon_wrapped-scattergun_side.webp';
import scatterBlueUrl from '../../art/exports/weapons/weapon_wrapped-scattergun_blue_pov.webp';
import scatterGoldUrl from '../../art/exports/weapons/weapon_wrapped-scattergun_gold_pov.webp';
import scatterSageUrl from '../../art/exports/weapons/weapon_wrapped-scattergun_sage_pov.webp';

export interface CreatureArt {
  url: string;
  zonesUrl: string;
  /** Where its paint shots start (its gun hand), in canvas pixels. */
  handPx: [number, number];
}

export const CREATURE_ART: Record<string, CreatureArt> = {
  'desert-sage': { url: sageUrl, zonesUrl: sageZonesUrl, handPx: [300, 700] },
  'desert-blue': { url: blueUrl, zonesUrl: blueZonesUrl, handPx: [285, 720] },
  'desert-gold': { url: goldUrl, zonesUrl: goldZonesUrl, handPx: [275, 715] },
};

export interface GunArt {
  /** First-person view (hand and gun), by alien. */
  pov: Record<string, string>;
  /** Side view for the picker. */
  side: string;
  /** Where the paint leaves the gun, as a fraction of the first-person image (from the art manifest). */
  muzzle: { x: number; y: number };
  /** CSS class for placement (two-handed guns sit wider). */
  cls: string;
}

export const GUN_ART: Record<string, GunArt> = {
  'star-revolver': {
    pov: { 'desert-sage': revolverSageUrl, 'desert-blue': revolverBlueUrl, 'desert-gold': revolverGoldUrl },
    side: revolverSideUrl,
    muzzle: { x: 0.47, y: 0.13 },
    cls: 'vm-onehand',
  },
  'wrapped-scattergun': {
    pov: { 'desert-sage': scatterSageUrl, 'desert-blue': scatterBlueUrl, 'desert-gold': scatterGoldUrl },
    side: scatterSideUrl,
    muzzle: { x: 0.367, y: 0.207 },
    cls: 'vm-twohand',
  },
};
