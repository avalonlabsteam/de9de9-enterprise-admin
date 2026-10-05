// KYC — review screen of one company: GET /companies/{companyId}/kyc/revue.
// There is no global « Décision » block: each piece is validated or refused on
// its own, the header only shows the progress, and the dossier turns
// « Vérifié » / « À corriger » by itself when the last waiting piece is
// decided — only then is the company told. There is no submit step: a filed
// piece can be decided at once. Opened from the queue (/kyc) or
// by URL, so a notification's `kyc-dossier` deep link can land here.
import { useState } from 'react';
import type { ReactNode } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ChevronLeft, Lock, RefreshCw, Repeat } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useT } from '@/lib/i18n';
import { Glyph } from '@/components/common/Glyph';
import { useKycRevue } from '../api/kyc';
import type { KycRevue } from '../schemas/kyc';
import {
  TONES,
  dossierStatutLabel,
  dossierToneName,
  fmtDateTime,
  kycErrorMessage,
  kycProblem,
} from '../lib/kyc';
import { PieceCard } from './PieceCard';
import { KycHistory } from './KycHistory';
import { VerdictDialog, type VerdictTarget } from './VerdictDialog';
import { ProgressBar, StatusPill, Tag } from './shared';

const CARD =
  'rounded-md border border-de9-line bg-card px-5 py-5 sm:px-6';

/** Set by the queue's links, so « Retour » restores its tab, search and page. */
export interface KycBackState {
  fromQueue?: boolean;
}

function initials(name: string): string {
  const words = name.split(/\s+/).filter(Boolean);
  return ((words[0]?.[0] ?? '') + (words[1]?.[0] ?? '')).toUpperCase() || '?';
}

export function KycReviewPage() {
  const { companyId = '' } = useParams<'companyId'>();
  const t = useT();
  const navigate = useNavigate();
  const location = useLocation();
  const revueQ = useKycRevue(companyId);

  const fromQueue = (location.state as KycBackState | null)?.fromQueue === true;
  const backLink = (
    <button
      type="button"
      onClick={() => (fromQueue ? navigate(-1) : navigate('/kyc'))}
      className="mb-4 inline-flex cursor-pointer items-center gap-1.5 text-[13px] font-bold text-de9-slate"
    >
      <ChevronLeft className="size-4 rtl:rotate-180" />
      {t('kycRetourFile')}
    </button>
  );

  if (revueQ.isPending) {
    return (
      <div className="mx-auto max-w-[1180px]">
        {backLink}
        <div className="flex flex-col gap-4">
          <div className="h-[150px] animate-pulse rounded-md bg-card" />
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-[300px] animate-pulse rounded-md bg-card" />
          ))}
        </div>
      </div>
    );
  }

  if (revueQ.isError) {
    const notFound = kycProblem(revueQ.error).status === 404;
    return (
      <div className="mx-auto max-w-[1180px]">
        {backLink}
        <div className={cn(CARD, 'flex flex-wrap items-center gap-3 text-[13px] font-semibold text-de9-red')}>
          {notFound ? t('kycIntrouvable') : `${t('kycErreurDossier')} — ${kycErrorMessage(revueQ.error, t)}`}
          {!notFound && (
            <button
              type="button"
              onClick={() => void revueQ.refetch()}
              disabled={revueQ.isFetching}
              className="cursor-pointer rounded-full border border-de9-line bg-card px-2.5 py-1.5 text-[11.5px] font-bold text-de9-slate disabled:opacity-50"
            >
              <Glyph icon={RefreshCw} /> {t('kycReessayer')}
            </button>
          )}
        </div>
      </div>
    );
  }

  return <Review revue={revueQ.data} backLink={backLink} />;
}

function Review({ revue: r, backLink }: { revue: KycRevue; backLink: ReactNode }) {
  const t = useT();
  const [, setSearchParams] = useSearchParams();
  const [target, setTarget] = useState<VerdictTarget | null>(null);

  const enRevue = !!r.enRevue;
  const tone = TONES[dossierToneName(r.statut, r.enRevue)];
  const roles = r.roles ?? [];
  const roleLabels = roles.map((role) =>
    role === 'Client' ? t('roleClient') : role === 'Prestataire' ? t('rolePrestataire') : role,
  );

  const openFiche = (): void => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('pres', r.companyId);
      next.delete('client');
      return next;
    });
  };

  return (
    <div className="mx-auto max-w-[1180px]">
      {backLink}

      {/* ===== header ===== */}
      <div className={CARD}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3.5">
            <div className="flex h-[52px] w-[52px] flex-none items-center justify-center rounded-md bg-primary-container text-[17px] font-extrabold text-on-primary-container">
              {initials(r.nom)}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-[21px] font-extrabold leading-tight">{r.nom}</h1>
                <StatusPill tone={tone} label={dossierStatutLabel(r.statut, r.statutLabel, t)} />
                {r.statut === 'pending' && !enRevue && <Tag tone="grey">{t('kycTagNonSoumis')}</Tag>}
                {r.revueCommencee && <Tag>{t('kycTagRevueEnCours')}</Tag>}
                {r.resoumission && (
                  <Tag tone="amber">
                    <Glyph icon={Repeat} className="me-1" />
                    {t('kycTagRenvoye')}
                  </Tag>
                )}
              </div>
              <div className="mt-1 text-[12.5px] text-de9-gray">
                {[r.raisonSociale, ...roleLabels].filter(Boolean).join(' · ') || '—'}
              </div>
            </div>
          </div>
          {roles.includes('Prestataire') && (
            <button
              type="button"
              onClick={openFiche}
              className="cursor-pointer rounded-full border border-de9-line bg-card px-3.5 py-2 text-[12px] font-bold text-de9-slate"
            >
              {t('fichePresta')}
            </button>
          )}
        </div>

        {r.progression && (
          <div className="mt-[18px] flex items-center gap-3">
            <ProgressBar progression={r.progression} className="h-2.5 flex-1" />
            <span dir="auto" className="flex-none text-[12.5px] font-extrabold">
              {r.progression.libelle ?? `${r.progression.valides} / ${r.progression.total}`}
            </span>
          </div>
        )}

        <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-[12px] text-de9-gray">
          <span>
            {t('kycSoumisLe')} : <b className="font-semibold text-de9-slate">{r.soumisLe ? fmtDateTime(r.soumisLe, t) : '—'}</b>
          </span>
          {r.revueLe && (
            <span>
              {t('kycDerniereDecision')} : <b className="font-semibold text-de9-slate">{fmtDateTime(r.revueLe, t)}</b>
            </span>
          )}
        </div>
      </div>

      {r.statut === 'rejected' && r.motif && (
        <div className="mt-3.5 rounded-md border border-[#F3C9CB] bg-[#FDECEC] px-4 py-3 dark:border-[#E7464E]/40 dark:bg-[#E7464E]/15">
          <div className="text-[10.5px] font-extrabold uppercase tracking-[.04em] text-de9-red">
            {t('kycMotifEnvoye')}
          </div>
          <div dir="auto" className="mt-1 text-[13px] leading-[1.5] text-de9-ink">
            {r.motif}
          </div>
          <div className="mt-1 text-[11.5px] text-de9-gray">{t('kycACorrigerInfo')}</div>
        </div>
      )}

      {r.noteDossier && (
        <div className="mt-3.5 rounded-md bg-card px-4 py-3">
          <div className="text-[10.5px] font-extrabold uppercase tracking-[.04em] text-de9-gray">
            <Glyph icon={Lock} /> {t('kycNoteDossier')}
          </div>
          <div dir="auto" className="mt-1 text-[12.5px] leading-[1.5] text-de9-slate">
            {r.noteDossier}
          </div>
        </div>
      )}

      {/* ===== the three pieces + the history ===== */}
      <div className="mt-4 grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_330px]">
        <div className="flex min-w-0 flex-col gap-4">
          {r.pieces.map((piece) => (
            <PieceCard
              key={piece.kind}
              piece={piece}
              companyId={r.companyId}
              enRevue={enRevue}
              onVerdict={(p, verdict) => setTarget({ piece: p, verdict })}
            />
          ))}
        </div>
        <aside className="lg:sticky lg:top-[86px] lg:max-h-[calc(100vh-110px)] lg:overflow-y-auto">
          <KycHistory companyId={r.companyId} />
        </aside>
      </div>

      <VerdictDialog
        companyId={r.companyId}
        target={target}
        dossierStatut={r.statut}
        enRevue={enRevue}
        onClose={() => setTarget(null)}
      />
    </div>
  );
}
