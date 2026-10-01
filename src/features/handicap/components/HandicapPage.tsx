// HANDICAP — demandes, candidats, placements.
//   « Demandes »   what the entreprises asked for, and who de9de9 placed there
//   « Candidats »  de9de9's own list of people looking for a job
// The tab lives in the URL (?onglet=candidats). An alert's deep link carries
// only ?inscription=<id>, so it lands on « Demandes ». Admin-only, and no field
// anywhere describes a disability or a health condition.
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useT, type TKey } from '@/lib/i18n';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Glyph } from '@/components/common/Glyph';
import { BTN_PRIMARY, type HcTab } from '../lib/handicap';
import { DemandesTab } from './DemandesTab';
import { CandidatsTab } from './CandidatsTab';

const TABS: ReadonlyArray<{ key: HcTab; labelKey: TKey; addKey: TKey }> = [
  { key: 'demandes', labelKey: 'hcTabDemandes', addKey: 'hcAjouterDemande' },
  { key: 'candidats', labelKey: 'hcTabCandidats', addKey: 'hcAjouterPersonne' },
];

export function HandicapPage() {
  const t = useT();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab: HcTab = searchParams.get('onglet') === 'candidats' ? 'candidats' : 'demandes';

  // A tab is mounted on its first visit and then only hidden, so its filters
  // and loaded pages are still there when the admin comes back to it — and a
  // placement refreshes both lists, not just the one on screen.
  const [visited, setVisited] = useState<ReadonlySet<HcTab>>(() => new Set([tab]));
  const mounted = (key: HcTab): boolean => key === tab || visited.has(key);
  // The header's one « Ajouter » button opens the form of the tab on screen.
  const [adding, setAdding] = useState<HcTab | null>(null);
  const closeAdding = (): void => setAdding(null);

  const setTab = (next: HcTab): void => {
    setVisited((prev) => (prev.has(next) ? prev : new Set([...prev, next])));
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev);
        if (next === 'demandes') params.delete('onglet');
        else params.set('onglet', next);
        return params;
      },
      { replace: true },
    );
  };

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-[14px]">
        <div>
          <div className="text-[23px] font-extrabold">{t('hcTitre')}</div>
          <div className="mt-[2px] text-[13.5px] text-de9-gray">{t('hcSub')}</div>
        </div>
        <button type="button" onClick={() => setAdding(tab)} className={BTN_PRIMARY}>
          <Glyph icon={Plus} /> {t(TABS.find((x) => x.key === tab)?.addKey ?? 'hcAjouterDemande')}
        </button>
      </div>

      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v === 'candidats' ? 'candidats' : 'demandes')}
        className="mt-4 gap-0"
      >
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
            <DemandesTab adding={adding === 'demandes'} onAddingDone={closeAdding} />
          </TabsContent>
        )}
        {mounted('candidats') && (
          <TabsContent value="candidats" forceMount className="data-[state=inactive]:hidden">
            <CandidatsTab adding={adding === 'candidats'} onAddingDone={closeAdding} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
