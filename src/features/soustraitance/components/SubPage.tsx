// SOUS-TRAITANCE — « Recruter des pros de9de9 » (guide 23): prestataires ask
// de9de9 for N pros of the de9de9 app, and an admin places real pros on them.
//   « Demandes »          GET /admin/contractuels/demandes (+ /compteurs)
//   « Pros disponibles »  GET /admin/contractuels/pros (+ /filtres)
// The tab lives in the URL (?onglet=pros); « Voir les pros » keeps the demande
// there too (?demande=<id>), and so does an alert's deep link
// (?onglet=demandes&demande=<id>).
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useT, type TKey } from '@/lib/i18n';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { CtrDemande } from '@/features/contractuels/schemas/contractuels';
import { DemandesTab } from './DemandesTab';
import { ProsTab } from './ProsTab';

type SubTab = 'demandes' | 'pros';

const TABS: ReadonlyArray<{ key: SubTab; labelKey: TKey }> = [
  { key: 'demandes', labelKey: 'stDemandes' },
  { key: 'pros', labelKey: 'stPros' },
];

export function SubPage() {
  const t = useT();
  const [sp, setSp] = useSearchParams();
  const tab: SubTab = sp.get('onglet') === 'pros' ? 'pros' : 'demandes';

  // A tab is mounted on its first visit, then only hidden: its filters and
  // page are still there when the admin comes back.
  const [visited, setVisited] = useState<ReadonlySet<SubTab>>(() => new Set([tab]));
  const mounted = (key: SubTab): boolean => key === tab || visited.has(key);

  const setTab = (next: SubTab, demandeId?: string | null): void => {
    setVisited((prev) => (prev.has(next) ? prev : new Set([...prev, next])));
    setSp(
      (prev) => {
        const params = new URLSearchParams(prev);
        if (next === 'demandes') params.delete('onglet');
        else params.set('onglet', next);
        if (demandeId !== undefined) {
          if (demandeId) params.set('demande', demandeId);
          else params.delete('demande');
        }
        return params;
      },
      // « Voir les pros » is a step forward: « back » returns to the demandes.
      { replace: demandeId === undefined },
    );
  };

  const voirPros = (d: CtrDemande): void => setTab('pros', d.id);

  const quitterDemande = (): void =>
    setSp(
      (prev) => {
        const params = new URLSearchParams(prev);
        params.delete('demande');
        return params;
      },
      { replace: true },
    );

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3.5">
        <div>
          <div className="text-[23px] font-extrabold">{t('stTitre')}</div>
          <div className="mt-[2px] text-[13.5px] text-de9-gray">{t('stSub')}</div>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v === 'pros' ? 'pros' : 'demandes')} className="mt-4 gap-0">
        <TabsList className="inline-flex w-fit max-w-full flex-wrap gap-1.5 rounded-full border border-de9-line bg-card p-[5px] group-data-horizontal/tabs:h-auto">
          {TABS.map(({ key, labelKey }) => (
            <TabsTrigger
              key={key}
              value={key}
              className="h-auto flex-none rounded-full border-0 px-4 py-[9px] text-[12.5px] font-bold text-de9-slate transition-none after:hidden hover:text-de9-slate data-active:bg-secondary-container data-active:text-on-secondary-container data-active:shadow-none"
            >
              {t(labelKey)}
            </TabsTrigger>
          ))}
        </TabsList>

        {mounted('demandes') && (
          <TabsContent value="demandes" forceMount className="data-[state=inactive]:hidden">
            <DemandesTab onVoirPros={voirPros} />
          </TabsContent>
        )}
        {mounted('pros') && (
          <TabsContent value="pros" forceMount className="data-[state=inactive]:hidden">
            <ProsTab onQuitter={quitterDemande} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
