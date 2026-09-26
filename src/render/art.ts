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
import raySideUrl from '../../art/exports/ui/weapon_desert-raygun_side.webp';
import rayBlueUrl from '../../art/exports/weapons/weapon_desert-raygun_blue_pov.webp';
import rayGoldUrl from '../../art/exports/weapons/weapon_desert-raygun_gold_pov.webp';
import raySageUrl from '../../art/exports/weapons/weapon_desert-raygun_sage_pov.webp';
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
  /** Grip point (fraction of the image): if set, the picture is turned so the grip-to-muzzle line points at the crosshair. */
  grip?: { x: number; y: number };
  /** CSS filter for this gun's paint (the raygun's bolts are green). */
  tint?: string;
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
    grip: { x: 0.7, y: 0.7 },
    cls: 'vm-twohand',
  },
  'desert-raygun': {
    pov: { 'desert-sage': raySageUrl, 'desert-blue': rayBlueUrl, 'desert-gold': rayGoldUrl },
    side: raySideUrl,
    muzzle: { x: 0.497, y: 0.168 },
    cls: 'vm-onehand',
    tint: 'hue-rotate(75deg) saturate(1.4)',
  },
};
