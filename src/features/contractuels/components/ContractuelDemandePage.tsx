// /contractuels/:demandeId — one demande of « Recruter des pros de9de9 »
// (guide 23): what the prestataire asked for, the pros placed on it
// (« Libérer »), and the way to place more — the directory « Pros
// disponibles » opened on this demande. Opened from the alerts « Demande de
// contractuels » / « … annulée » and from the list of « Sous-traitance ».
import { useState, type ReactNode } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowRight, ChevronLeft, Users } from 'lucide-react';
import { useT, type TKey } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { problemMessage } from '@/api/problem';
import { Glyph } from '@/components/common/Glyph';
import { fmtDate } from '@/features/kyc/lib/kyc';
import { refreshCtr, useCtrDemande, useTakeDemande } from '../api/contractuels';
import { ctrProblem, isOuverte, restantOf, statutPill } from '../lib/contractuels';
import { CloturerDialog } from './CloturerDialog';
import { PlacementsList } from './PlacementsList';

const CARD = 'rounded-md border border-de9-line bg-card p-[22px]';
const LABEL = 'text-[11px] font-bold tracking-[.04em] text-de9-gray uppercase';
const BTN = 'cursor-pointer rounded-full px-4 py-2.5 text-[12.5px] font-bold disabled:cursor-not-allowed disabled:opacity-60';

export function ContractuelDemandePage() {
  const { demandeId = '' } = useParams<'demandeId'>();
  const t = useT();
  const navigate = useNavigate();
  const location = useLocation();
  const [, setSearchParams] = useSearchParams();
  const detailQ = useCtrDemande(demandeId);
  const take = useTakeDemande();
  const [cloturer, setCloturer] = useState(false);

  const openPres = (companyId: string): void => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('pres', companyId);
      next.delete('client');
      return next;
    });
  };

  const backLink = (
    <button
      type="button"
      onClick={() => (location.key !== 'default' ? navigate(-1) : navigate('/soustraitance'))}
      className="mb-4 inline-flex cursor-pointer items-center gap-1.5 text-[13px] font-bold text-de9-slate"
    >
      <ChevronLeft className="size-4 rtl:rotate-180" />
      {t('entRetour')}
    </button>
  );

  if (detailQ.isPending) {
    return (
      <div className="mx-auto max-w-[860px]">
        {backLink}
        <div className="h-[220px] animate-pulse rounded-md bg-card" />
      </div>
    );
  }

  if (!detailQ.data) {
    const notFound = ctrProblem(detailQ.error).status === 404;
    return (
      <div className="mx-auto max-w-[860px]">
        {backLink}
        <div className={CARD}>
          <div className="text-[13px] font-semibold text-de9-red">
            {notFound ? t('ctrIntrouvable') : `${t('ctrErreur')} — ${problemMessage(detailQ.error)}`}
          </div>
        </div>
      </div>
    );
  }

  const { demande: d, placements } = detailQ.data;
  const pill = statutPill(d, t);
  const lieu = [d.commune, d.wilaya].filter(Boolean).join(', ') || null;
  const categorie = [d.categoryLabel, d.subcategoryLabel].filter(Boolean).join(' · ') || null;
  const fields: ReadonlyArray<[TKey, ReactNode]> = [
    ['ctrCategorie', categorie && <bdi>{categorie}</bdi>],
    ['ctrLieu', lieu && <bdi>{lieu}</bdi>],
    [
      'ctrNombre',
      <>
        <span className="num">
          {d.fulfilledCount} / {d.requestedCount}
        </span>
        {' — '}
        {t('stRestant').replace('{n}', String(restantOf(d)))}
      </>,
    ],
    ['ctrCreeLe', d.createdAt ? fmtDate(d.createdAt, t) : null],
  ];

  const prendre = (): void => {
    take.mutate(d.id, {
      onSuccess: () => toast.success(t('stPriseToast')),
      onError: (err) => {
        toast.error(problemMessage(err));
        const { status } = ctrProblem(err);
        if (status === 404 || status === 409) refreshCtr();
      },
    });
  };

  return (
    <div className="mx-auto max-w-[860px]">
      {backLink}

      <div className={CARD}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[20px] font-extrabold">{t('ctrTitre')}</div>
            <div className="mt-1 text-[13px] text-de9-gray">
              {d.prestataireCompanyId ? (
                <button
                  type="button"
                  onClick={() => openPres(d.prestataireCompanyId ?? '')}
                  className="cursor-pointer font-bold text-de9-teal-dark hover:underline"
                >
                  <bdi>{d.companyName ?? '—'}</bdi>
                </button>
              ) : (
                <bdi className="font-bold text-de9-slate">{d.companyName ?? '—'}</bdi>
              )}
            </div>
          </div>
          <span className={cn('rounded-full px-3 py-1.5 text-[11.5px] font-extrabold', pill.chip)}>{pill.label}</span>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
          {fields.map(([key, value]) =>
            value ? (
              <div key={key} className="min-w-0">
                <div className={LABEL}>{t(key)}</div>
                <div className="mt-0.5 text-[13.5px] font-semibold text-de9-ink">{value}</div>
              </div>
            ) : null,
          )}
        </div>

        {d.note && (
          <div className="mt-5">
            <div className={LABEL}>{t('ctrMessage')}</div>
            <div dir="auto" className="mt-1 text-[13px] leading-relaxed whitespace-pre-line text-de9-slate ltr:text-left rtl:text-right">
              {d.note}
            </div>
          </div>
        )}

        <div className="mt-5 flex flex-wrap gap-2.5">
          {d.status === 'submitted' && (
            <button type="button" onClick={prendre} disabled={take.isPending} className={cn(BTN, 'bg-secondary-container text-on-secondary-container')}>
              {t('stPrendre')}
            </button>
          )}
          <button
            type="button"
            onClick={() => navigate(`/soustraitance?onglet=pros&demande=${encodeURIComponent(d.id)}`)}
            className={cn(BTN, 'bg-primary text-primary-foreground')}
          >
            {t('stVoirPros')} <Glyph icon={ArrowRight} className="rtl:rotate-180" />
          </button>
          {isOuverte(d) && (
            <button type="button" onClick={() => setCloturer(true)} className={cn(BTN, 'border border-de9-red bg-card text-de9-red')}>
              {t('stCloturer')}…
            </button>
          )}
        </div>
      </div>

      <div className={`${CARD} mt-4`}>
        <div className="mb-2 flex items-center gap-2 text-base font-extrabold">
          <Users className="size-[18px] text-de9-gray" />
          {t('ctrPlacements')}
          <span className="text-de9-gray">
            (<span className="num">{placements.length}</span>)
          </span>
        </div>
        <PlacementsList placements={placements} />
      </div>

      {cloturer && <CloturerDialog demande={d} onClose={() => setCloturer(false)} />}
    </div>
  );
}
