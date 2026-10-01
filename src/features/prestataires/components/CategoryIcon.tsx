// 3D icon of a taxonomy category, from the 3dicons set (3dicons.co — CC0: free
// for commercial use, no attribution required): « color » style, front angle,
// each render trimmed to its object and scaled to 72px, 3× the 24px it is
// shown at. Keyed by category id (lib/taxonomy.ts). The set has no scales,
// truck or globe, so those categories take the closest object: a law book, a
// map pin, a compass.
import axe from '@/assets/3dicons/axe.webp';
import bag from '@/assets/3dicons/bag.webp';
import boy from '@/assets/3dicons/boy.webp';
import broom from '@/assets/3dicons/broom.webp';
import calculator from '@/assets/3dicons/calculator.webp';
import chart from '@/assets/3dicons/chart.webp';
import computer from '@/assets/3dicons/computer.webp';
import explorer from '@/assets/3dicons/explorer.webp';
import folder from '@/assets/3dicons/folder.webp';
import mapPin from '@/assets/3dicons/map-pin.webp';
import megaphone from '@/assets/3dicons/megaphone.webp';
import notebook from '@/assets/3dicons/notebook.webp';
import shield from '@/assets/3dicons/shield.webp';
import teaCup from '@/assets/3dicons/tea-cup.webp';
import tools from '@/assets/3dicons/tools.webp';
import umbrella from '@/assets/3dicons/umbrella.webp';
import { cn } from '@/lib/utils';

const ICONS: Record<number, string> = {
  1: notebook, // Services Juridiques & Légaux
  2: calculator, // Comptabilité, Finance & Fiscalité
  3: boy, // Ressources Humaines & Recrutement
  4: computer, // Services Informatiques & Digitaux
  5: megaphone, // Marketing, Communication & Créatif
  6: broom, // Nettoyage & Hygiène
  7: shield, // Sécurité & Gardiennage
  8: mapPin, // Logistique, Transport & Supply Chain
  9: axe, // BTP, Travaux & Aménagement (a pickaxe)
  10: tools, // Maintenance Industrielle & Technique
  11: chart, // Conseil & Stratégie d'Entreprise
  12: bag, // Fournitures & Équipements (B2B)
  13: teaCup, // Restauration & Événementiel
  14: umbrella, // Assurance & Gestion des Risques
  15: explorer, // Import-Export & Commerce International (a compass)
  16: folder, // Services Généraux & Support
};

/**
 * Decorative — the category's name always sits next to it. Renders nothing for
 * an id the taxonomy does not know.
 */
export function CategoryIcon({ id, className }: { id: number; className?: string }) {
  const src = ICONS[id];
  if (!src) return null;
  return (
    <img
      src={src}
      alt=""
      width={24}
      height={24}
      draggable={false}
      className={cn(
        'size-6 flex-none select-none',
        // The renders are lit for a light page: on a dark surface the darkest
        // ones (the pickaxe head, the navy book) lose their outline, so a
        // hairline of light is drawn around the object.
        'dark:[filter:drop-shadow(0_0_.6px_rgb(255_255_255/.55))_drop-shadow(0_0_1.2px_rgb(255_255_255/.18))]',
        className,
      )}
    />
  );
}
