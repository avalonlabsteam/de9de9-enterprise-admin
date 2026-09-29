// KYC — review screen of one company: GET /companies/{companyId}/kyc/revue.
// There is no global « Décision » block: each piece is validated or refused on
// its own, the header only shows the progress, and the dossier turns
// « Vérifié » / « À corriger » by itself when the last submitted piece is
// decided — only then is the company told. Opened from the queue (/kyc) or
// by URL, so a notification's `kyc-dossier` deep link can land here.
import { useState } from 'react';
import type { ReactNode } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useT } from '@/lib/i18n';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { reloadKycRevue, useKycRevue, useKycSubmitForCompany } from '../api/kyc';
import type { KycRevue } from '../schemas/kyc';
import {
  TONES,
  dossierStatutLabel,
  dossierToneName,
  fmtDateTime,
  isStaleProblem,
  kycErrorMessage,
  kycProblem,
} from '../lib/kyc';
import { PieceCard } from './PieceCard';
import { KycHistory } from './KycHistory';
import { VerdictDialog, type VerdictTarget } from './VerdictDialog';
import { ProgressBar, StatusPill, Tag } from './shared';

const CARD =
  'rounded-[20px] border border-de9-line bg-card px-5 py-5 shadow-[0_10px_30px_rgba(38,50,69,.06)] sm:px-6';

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
          <div className="h-[150px] animate-pulse rounded-[20px] bg-card" />
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-[300px] animate-pulse rounded-[20px] bg-card" />
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
              className="cursor-pointer rounded-[10px] border-[1.5px] border-de9-line bg-card px-2.5 py-1.5 text-[11.5px] font-bold text-de9-slate disabled:opacity-50"
            >
              ⟳ {t('kycReessayer')}
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
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const submit = useKycSubmitForCompany();

  const enRevue = !!r.enRevue;
  const tone = TONES[dossierToneName(r.statut, r.enRevue)];
  const roles = r.roles ?? [];
  const roleLabels = roles.map((role) =>
    role === 'Client' ? t('roleClient') : role === 'Prestataire' ? t('rolePrestataire') : role,
  );
  // The server's flag when it sends one; otherwise offer it whenever no round
  // is open and let a 422 say what is missing.
  const canSubmit = r.peutSoumettre ?? (!enRevue && r.statut !== 'verified');

  const openFiche = (): void => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('pres', r.companyId);
      next.delete('client');
      return next;
    });
  };

  const runSubmit = (): void => {
    submit.mutate(r.companyId, {
      onSuccess: () => {
        toast.success(t('kycToastSoumis'));
        setConfirmSubmit(false);
      },
      onError: (err) => {
        toast.error(kycErrorMessage(err, t));
        if (isStaleProblem(kycProblem(err))) {
          reloadKycRevue(r.companyId);
          setConfirmSubmit(false);
        }
      },
    });
  };

  return (
    <div className="mx-auto max-w-[1180px]">
      {backLink}

      {/* ===== header ===== */}
      <div className={CARD}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3.5">
            <div className="flex h-[52px] w-[52px] flex-none items-center justify-center rounded-[15px] bg-de9-ink text-[17px] font-extrabold text-white dark:text-[#151923]">
              {initials(r.nom)}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-[21px] font-extrabold leading-tight">{r.nom}</h1>
                <StatusPill tone={tone} label={dossierStatutLabel(r.statut, r.statutLabel, t)} />
                {r.revueCommencee && <Tag>{t('kycTagRevueEnCours')}</Tag>}
                {r.resoumission && <Tag tone="amber">{t('kycTagRenvoye')}</Tag>}
              </div>
              <div className="mt-1 text-[12.5px] text-de9-gray">
                {[r.raisonSociale, ...roleLabels].filter(Boolean).join(' · ') || '—'}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {roles.includes('Prestataire') && (
              <button
                type="button"
                onClick={openFiche}
                className="cursor-pointer rounded-[11px] border-[1.5px] border-de9-line bg-card px-3.5 py-2 text-[12px] font-bold text-de9-slate"
              >
                {t('fichePresta')}
              </button>
            )}
            {canSubmit && (
              <button
                type="button"
                onClick={() => setConfirmSubmit(true)}
                className="cursor-pointer rounded-[11px] border-[1.5px] border-de9-line bg-card px-3.5 py-2 text-[12px] font-bold text-de9-slate"
              >
                📨 {t('kycSoumettrePour')}
              </button>
            )}
          </div>
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

      {/* ===== where the dossier stands ===== */}
      {enRevue ? (
        <Banner tone="blue">{t('kycRevueInfo')}</Banner>
      ) : r.statut === 'verified' ? (
        <Banner tone="green">{t('kycVerifieInfo')}</Banner>
      ) : r.statut === 'pending' ? (
        <Banner tone="grey">{t('kycNonSoumisInfo')}</Banner>
      ) : null}

      {r.statut === 'rejected' && r.motif && (
        <div className="mt-3.5 rounded-[14px] border border-[#F3C9CB] bg-[#FDECEC] px-4 py-3 dark:border-[#E7464E]/40 dark:bg-[#E7464E]/15">
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
        <div className="mt-3.5 rounded-[14px] bg-card px-4 py-3">
          <div className="text-[10.5px] font-extrabold uppercase tracking-[.04em] text-de9-gray">
            🔒 {t('kycNoteDossier')}
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

      {/* ===== submit on the company's behalf ===== */}
      <Dialog open={confirmSubmit} onOpenChange={setConfirmSubmit}>
        <DialogContent
          showCloseButton={false}
          className="block max-w-[calc(100%-2rem)] gap-0 rounded-[22px] bg-card p-7 sm:max-w-[440px]"
        >
          <div className="flex h-[54px] w-[54px] items-center justify-center rounded-[15px] bg-[#EAF2FD] text-[24px] dark:bg-[#2F7FD0]/15">
            📨
          </div>
          <DialogTitle className="mt-4 text-[19px] leading-normal font-extrabold text-de9-ink">
            {t('kycSoumettrePour')}
          </DialogTitle>
          <DialogDescription className="mt-[9px] text-[13.5px] leading-[1.55] text-de9-slate">
            {t('kycSoumettreTexte')}
          </DialogDescription>
          <div className="mt-[22px] flex gap-[11px]">
            <button
              type="button"
              onClick={() => setConfirmSubmit(false)}
              className="flex-1 cursor-pointer rounded-[13px] bg-secondary p-3.5 text-center text-sm font-bold text-de9-slate"
            >
              {t('annuler')}
            </button>
            <button
              type="button"
              disabled={submit.isPending}
              onClick={runSubmit}
              className="flex-1 cursor-pointer rounded-[13px] bg-[#2F7FD0] p-3.5 text-center text-sm font-bold text-white shadow-[0_10px_22px_rgba(47,127,208,.4)] disabled:opacity-60"
            >
              {submit.isPending ? t('kycEnvoi') : t('fcConfirmer')}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Banner({ tone, children }: { tone: 'blue' | 'green' | 'grey'; children: ReactNode }) {
  return (
    <div
      className={cn(
        'mt-3.5 flex gap-2.5 rounded-[14px] border px-4 py-3 text-[12.5px] leading-[1.5]',
        tone === 'blue' &&
          'border-[#BFD9F2] bg-[#EAF2FD] text-[#2C6FB0] dark:border-[#2F7FD0]/40 dark:bg-[#2F7FD0]/15 dark:text-[#7EB5EC]',
        tone === 'green' &&
          'border-[#BEE6CE] bg-[#E7F6EE] text-[#23794D] dark:border-[#2FA86A]/40 dark:bg-[#2FA86A]/15 dark:text-[#6FCF97]',
        tone === 'grey' && 'border-de9-line bg-card text-de9-slate',
      )}
    >
      <span aria-hidden>ⓘ</span>
      <span>{children}</span>
    </div>
  );
}
