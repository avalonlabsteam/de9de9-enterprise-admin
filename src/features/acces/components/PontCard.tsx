// « Pont de9de9 » — the first block of the page « Accès » (guide 24): the
// state of the bridge to the de9de9 app, and the three buttons that replace
// the owner's setting and restart: open, close, test the connection.
import { useId, useState } from 'react';
import { Cable } from 'lucide-react';
import { useT } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { problemMessage } from '@/api/problem';
import { Glyph } from '@/components/common/Glyph';
import { fmtAlger } from '@/features/comptabilite/lib/comptabilite';
import { usePontDe9de9, useTesterPont } from '../api/pont';
import { testPill, tonPill } from '../lib/acces';
import { PontFermerDialog } from './PontFermerDialog';
import { PontOuvrirDialog } from './PontOuvrirDialog';

const CARD = 'mt-4 rounded-md border border-de9-line bg-card px-5 py-4';
const PILL = 'inline-flex items-center rounded-full px-2.5 py-[5px] text-[11px] font-bold';
const BTN = 'cursor-pointer rounded-full px-4 py-[9px] text-[12.5px] font-bold disabled:cursor-not-allowed disabled:opacity-60';

export function PontCard() {
  const t = useT();
  const pontQ = usePontDe9de9();
  const tester = useTesterPont();
  const [dialog, setDialog] = useState<'ouvrir' | 'fermer' | null>(null);
  const titleId = useId();

  if (pontQ.isPending) return <div className={cn(CARD, 'h-[104px] animate-pulse')} />;

  if (pontQ.isError) {
    return (
      <div className={cn(CARD, 'flex flex-wrap items-center justify-between gap-3')}>
        <div className="text-[12.5px] font-semibold text-de9-red">
          {t('pontErreur')} — {problemMessage(pontQ.error)}
        </div>
        <button type="button" onClick={() => void pontQ.refetch()} className={cn(BTN, 'border border-de9-line bg-card text-de9-slate')}>
          {t('reessayer')}
        </button>
      </div>
    );
  }

  const p = pontQ.data;
  // The pill reads the switch; the server's configuration only colours it.
  const pill = p.ouvert
    ? p.configure
      ? { label: t('pontOuvert'), ton: 'succes' }
      : { label: t('pontOuvertNonConfigure'), ton: 'attente' }
    : { label: t('pontFerme'), ton: 'neutre' };
  const test = tester.data;

  return (
    <section aria-labelledby={titleId} className={CARD}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[15px] font-extrabold text-de9-ink">
              <Glyph icon={Cable} /> <span id={titleId}>{t('pontTitre')}</span>
            </span>
            <span className={cn(PILL, tonPill(pill.ton))}>{pill.label}</span>
            {!p.ouvert && !p.configure && (
              <span className="text-[12px] font-semibold text-[#B68A2E] dark:text-[#D9B36A]">{t('pontNonConfigureHint')}</span>
            )}
          </div>

          <div className="mt-2 text-[12.5px] text-de9-slate">
            {p.modifieLe ? (
              <>
                {t('pontModifie')
                  .replace('{date}', fmtAlger(p.modifieLe) ?? '—')
                  .replace('{qui}', p.modifiePar ?? '—')}
                {p.motif && (
                  <>
                    {' — '}
                    <bdi>{p.motif}</bdi>
                  </>
                )}
              </>
            ) : (
              t('pontDefaut')
            )}
          </div>
          <div className="mt-0.5 text-[12.5px] text-de9-slate">
            {p.enFile > 0
              ? t('pontEnFile').replace('{n}', String(p.enFile)).replace('{m}', String(p.suspensionsEnFile))
              : t('pontAucunEnvoi')}
          </div>
          {!p.miroirConfigure && <div className="mt-0.5 text-[12px] text-de9-gray">{t('pontMiroir')}</div>}
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => tester.mutate()}
            disabled={tester.isPending}
            className={cn(BTN, 'border border-de9-line bg-card text-de9-slate hover:bg-de9-row')}
          >
            {tester.isPending ? t('pontTestEnCours') : t('pontTester')}
          </button>
          {p.ouvert ? (
            <button type="button" onClick={() => setDialog('fermer')} className={cn(BTN, 'border border-de9-red bg-card text-de9-red')}>
              {t('pontFermer')}
            </button>
          ) : (
            <button type="button" onClick={() => setDialog('ouvrir')} className={cn(BTN, 'bg-primary text-primary-foreground')}>
              {t('pontOuvrir')}
            </button>
          )}
        </div>
      </div>

      {/* The last test of this visit — the server keeps none. */}
      {test && (
        <div className="mt-3 border-t border-de9-line pt-3">
          <span className={cn(PILL, testPill(test.resultat))}>{test.label}</span>
          <div dir="auto" className="mt-1.5 text-[12.5px] leading-relaxed text-de9-slate ltr:text-left rtl:text-right">
            {test.detail}
          </div>
          <div className="mt-1 text-[11.5px] text-de9-gray">
            {t('pontTesteLe')
              .replace('{date}', fmtAlger(test.testeLe) ?? '—')
              .replace('{ms}', String(test.dureeMs))}
            {test.httpStatus != null && <span className="num"> · HTTP {test.httpStatus}</span>}
          </div>
        </div>
      )}
      {tester.isError && (
        <div className="mt-3 border-t border-de9-line pt-3 text-[12.5px] font-semibold text-de9-red">
          {problemMessage(tester.error)}
        </div>
      )}

      {dialog === 'ouvrir' && <PontOuvrirDialog enFile={p.enFile} onClose={() => setDialog(null)} />}
      {dialog === 'fermer' && <PontFermerDialog onClose={() => setDialog(null)} />}
    </section>
  );
}
