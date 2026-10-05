// « Reprendre les fiches » — POST /admin/annonces/reprendre-fiches, once after
// deployment: every directory card still filled by hand becomes one published
// B2B annonce per category, and the card is then driven by the annonces. A dry
// run first (`simuler`: nothing written), then the real run — which cannot be
// undone. A company whose save was refused can be relaunched on its own.
import { Fragment, useState } from 'react';
import { toast } from 'sonner';
import { useL, useT, type TKey } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { useReprendreFiches } from '../api/annonces';
import { annErrorMessage, annProblem, taxoOf } from '../lib/annonces';
import type { Reprise, RepriseResultat } from '../schemas/annonces';

const RAISON_KEY: Record<string, TKey> = {
  deja_reprise: 'annRepriseDejaReprise',
  sans_couverture: 'annRepriseSansCouverture',
  pas_prestataire: 'annReprisePasPrestataire',
  modification_concurrente: 'annRepriseARelancer',
};

export function ReprendreFichesDialog({ onClose }: { onClose: () => void }) {
  const t = useT();
  const run = useReprendreFiches();
  const relance = useReprendreFiches();
  const [simulation, setSimulation] = useState<Reprise | null>(null);
  const [reel, setReel] = useState<Reprise | null>(null);
  const [error, setError] = useState<string | null>(null);
  const shown = reel ?? simulation;
  const busy = run.isPending || relance.isPending;

  const onError = (err: unknown): void => {
    const p = annProblem(err);
    // The lot may have run all the same: a timeout does not stop the server.
    setError(p.sansReponse ? t('annRepriseSansReponse') : annErrorMessage(err, t));
  };

  const simuler = (): void => {
    setError(null);
    run.mutate({ simuler: true }, { onSuccess: setSimulation, onError });
  };

  const lancer = (): void => {
    setError(null);
    run.mutate(
      { simuler: false },
      {
        onSuccess: (res) => {
          setReel(res);
          toast.success(
            t('annRepriseToast').replace('{f}', String(res.fichesReprises)).replace('{a}', String(res.annoncesCreees)),
          );
        },
        onError,
      },
    );
  };

  /** One company again — its row is replaced by the new answer. */
  const relancer = (companyId: string): void => {
    setError(null);
    relance.mutate(
      { simuler: false, companyIds: [companyId] },
      {
        onSuccess: (res) => {
          const fresh = res.resultats.find((x) => x.companyId === companyId);
          if (!fresh) return;
          setReel((prev) =>
            prev ? { ...prev, resultats: prev.resultats.map((x) => (x.companyId === companyId ? fresh : x)) } : prev,
          );
          toast.success(
            t('annRepriseToast').replace('{f}', String(res.fichesReprises)).replace('{a}', String(res.annoncesCreees)),
          );
        },
        onError,
      },
    );
  };

  const figures: ReadonlyArray<{ labelKey: TKey; value: number }> = shown
    ? [
        { labelKey: 'annRepriseExaminees', value: shown.fichesExaminees },
        { labelKey: 'annRepriseReprises', value: shown.fichesReprises },
        { labelKey: 'annRepriseAnnonces', value: shown.annoncesCreees },
        { labelKey: 'annRepriseIgnorees', value: shown.fichesIgnorees },
      ]
    : [];

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="flex max-h-[90vh] max-w-[calc(100%-2rem)] flex-col gap-0 rounded-xl bg-card p-6 text-de9-ink sm:max-w-[640px] sm:p-7"
      >
        <DialogTitle className="flex-none text-[19px] leading-normal font-extrabold text-de9-ink">
          {t('annReprendreFiches')}
          {reel && <span className="ms-2 text-[13px] font-bold text-[#2FA86A]">· {t('annRepriseFaite')}</span>}
          {!reel && simulation && <span className="ms-2 text-[13px] font-bold text-de9-gray">· {t('annRepriseSimulation')}</span>}
        </DialogTitle>
        <DialogDescription className="mt-2.5 flex-none text-[13px] leading-relaxed text-de9-slate">
          {t('annRepriseTexte')}
        </DialogDescription>

        {shown && (
          <div className="mt-4 grid flex-none grid-cols-2 gap-2.5 sm:grid-cols-4">
            {figures.map((f) => (
              <div key={f.labelKey} className="rounded-md bg-secondary px-3 py-2.5 text-center">
                <div className="text-[20px] leading-tight font-extrabold">
                  <span className="num">{f.value}</span>
                </div>
                <div className="text-[11px] font-semibold text-de9-gray">{t(f.labelKey)}</div>
              </div>
            ))}
          </div>
        )}

        {/* What the real run will do, in figures — said before the button that cannot be undone. */}
        {simulation && !reel && (
          <div className="mt-3 flex-none rounded-md bg-[#FBF4E4] px-3.5 py-2.5 text-[12.5px] font-semibold text-[#92702A] dark:bg-[#B68A2E]/15 dark:text-[#D9B36A]">
            {t('annRepriseAnnonce')
              .replace('{f}', String(simulation.fichesReprises))
              .replace('{a}', String(simulation.annoncesCreees))}
          </div>
        )}

        {shown && shown.resultats.length > 0 && (
          <ul className="mt-3 min-h-0 flex-1 overflow-y-auto rounded-md border border-de9-line">
            {shown.resultats.map((r) => (
              <ResultRow key={r.companyId} row={r} reel={!!reel} busy={busy} onRelancer={() => relancer(r.companyId)} />
            ))}
          </ul>
        )}
        {shown && shown.resultats.length === 0 && (
          <div className="mt-3 text-center text-[13px] text-de9-gray">{t('annRepriseAucune')}</div>
        )}

        {error && (
          <div role="alert" dir="auto" className="mt-3 flex-none rounded-md bg-[#FDECEC] px-3.5 py-2.5 text-[12.5px] font-semibold text-de9-red ltr:text-left rtl:text-right dark:bg-[#E7464E]/15">
            {error}
          </div>
        )}

        <div className="mt-5 flex flex-none flex-wrap justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="cursor-pointer rounded-full border border-de9-line bg-card px-5 py-2.5 text-[12.5px] font-bold text-de9-slate disabled:opacity-50"
          >
            {t(reel ? 'fermer' : 'annuler')}
          </button>
          {!reel && (
            <button
              type="button"
              onClick={simuler}
              disabled={busy}
              className="cursor-pointer rounded-full border border-de9-line bg-card px-5 py-2.5 text-[12.5px] font-bold text-de9-slate disabled:opacity-50"
            >
              {run.isPending && run.variables?.simuler ? t('accesTraitement') : t('annSimuler')}
            </button>
          )}
          {!reel && (
            <button
              type="button"
              onClick={lancer}
              disabled={busy || !simulation}
              title={simulation ? undefined : t('annSimulerDabord')}
              className="cursor-pointer rounded-full bg-primary px-5 py-2.5 text-[12.5px] font-bold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
            >
              {run.isPending && run.variables?.simuler === false ? t('accesTraitement') : t('annLancerReprise')}
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ResultRow({ row: r, reel, busy, onRelancer }: { row: RepriseResultat; reel: boolean; busy: boolean; onRelancer: () => void }) {
  const t = useT();
  const L = useL();
  const reprise = r.resultat === 'reprise';
  const raison = r.raison ? RAISON_KEY[r.raison] : undefined;
  return (
    <li className="border-b border-de9-line px-3.5 py-2.5 last:border-b-0">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <div className="min-w-0 flex-1">
          {r.nom ? (
            <bdi className="text-[13px] font-bold text-de9-ink">{r.nom}</bdi>
          ) : (
            <span dir="ltr" className="font-mono text-[12px] text-de9-slate">
              {r.companyId}
            </span>
          )}
        </div>
        <span
          className={cn(
            'rounded-full px-2.5 py-[3px] text-[11px] font-bold',
            reprise
              ? 'bg-[#E7F6EE] text-[#2FA86A] dark:bg-[#2FA86A]/15 dark:text-[#6FCF97]'
              : r.raison === 'modification_concurrente'
                ? 'bg-[#FBF4E4] text-[#B68A2E] dark:bg-[#B68A2E]/15 dark:text-[#D9B36A]'
                : 'bg-[#EEF1F4] text-[#6B7280] dark:bg-[#9AA4B2]/15 dark:text-[#A6AEBD]',
          )}
        >
          {reprise ? t('annRepriseRow').replace('{n}', String(r.annoncesCreees)) : raison ? t(raison) : (r.raison ?? r.resultat)}
        </span>
        {reel && r.raison === 'modification_concurrente' && (
          <button
            type="button"
            onClick={onRelancer}
            disabled={busy}
            className="cursor-pointer rounded-full border border-de9-line bg-card px-3 py-1 text-[11.5px] font-bold text-de9-slate disabled:opacity-50"
          >
            {t('annRelancer')}
          </button>
        )}
      </div>
      {r.categoriesNonReprises.length > 0 && (
        <div className="mt-1 text-[11.5px] text-[#B68A2E] dark:text-[#D9B36A]">
          {t('annCategoriesRetirees')}{' '}
          {r.categoriesNonReprises.map((code, i) => {
            // The codes are slugs of the catalogue labels: the label when the panel knows it.
            const cat = taxoOf(code);
            return (
              <Fragment key={code}>
                {i > 0 && ', '}
                <bdi className="whitespace-nowrap">{cat ? L(cat.fr, cat.ar) : code}</bdi>
              </Fragment>
            );
          })}
        </div>
      )}
    </li>
  );
}
