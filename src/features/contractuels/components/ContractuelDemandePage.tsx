// /contractuels/:demandeId — a prestataire asks de9de9 for contractuels (guide
// 11a §6, adm.contractuels): the request and its candidates. Opened from the
// alerts « Demande de contractuels » / « … annulée »; no list screen yet.
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { ChevronLeft, Users } from 'lucide-react';
import { useT, type TKey } from '@/lib/i18n';
import { problemMessage } from '@/api/problem';
import { fmtDate } from '@/features/kyc/lib/kyc';
import { useContractuelCandidats, useContractuelDemande } from '../api/contractuels';

const CARD = 'rounded-[20px] border border-de9-line bg-card p-[22px] shadow-[0_10px_30px_rgba(38,50,69,.06)]';
const LABEL = 'text-[11px] font-bold tracking-[.04em] text-de9-gray uppercase';

/** ISO dates print as « Lundi 28/09/2026 »; anything else as sent. */
function dateText(value: string | null, t: (key: TKey) => string): string | null {
  if (!value) return null;
  return Number.isNaN(Date.parse(value)) ? value : fmtDate(value, t);
}

export function ContractuelDemandePage() {
  const { demandeId = '' } = useParams<'demandeId'>();
  const t = useT();
  const navigate = useNavigate();
  const location = useLocation();
  const [, setSearchParams] = useSearchParams();
  const demandeQ = useContractuelDemande(demandeId);
  const candidatsQ = useContractuelCandidats(demandeId);
  const d = demandeQ.data;

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
      onClick={() => (location.key !== 'default' ? navigate(-1) : navigate('/commandes'))}
      className="mb-4 inline-flex cursor-pointer items-center gap-1.5 text-[13px] font-bold text-de9-slate"
    >
      <ChevronLeft className="size-4 rtl:rotate-180" />
      {t('entRetour')}
    </button>
  );

  if (demandeQ.isPending) {
    return (
      <div className="mx-auto max-w-[860px]">
        {backLink}
        <div className="h-[220px] animate-pulse rounded-[20px] bg-card" />
      </div>
    );
  }

  if (!d) {
    const notFound = axios.isAxiosError(demandeQ.error) && demandeQ.error.response?.status === 404;
    return (
      <div className="mx-auto max-w-[860px]">
        {backLink}
        <div className={CARD}>
          <div className="text-[13px] font-semibold text-de9-red">
            {notFound ? t('ctrIntrouvable') : `${t('ctrErreur')} — ${problemMessage(demandeQ.error)}`}
          </div>
        </div>
      </div>
    );
  }

  const lieu = [d.commune, d.wilaya].filter(Boolean).join(', ') || null;
  const periode = [dateText(d.debut, t), dateText(d.fin, t)].filter(Boolean).join(' → ') || null;
  const categorie = [d.categorie, d.sousCategorie].filter(Boolean).join(' · ') || null;
  const fields: ReadonlyArray<[TKey, string | null]> = [
    ['ctrCategorie', categorie],
    ['ctrLieu', lieu],
    ['ctrNombre', d.nombre],
    ['ctrPeriode', periode],
    ['ctrCreeLe', dateText(d.creeLe, t)],
  ];
  const candidats = candidatsQ.data ?? [];

  return (
    <div className="mx-auto max-w-[860px]">
      {backLink}

      <div className={CARD}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[20px] font-extrabold">{t('ctrTitre')}</div>
            <div className="mt-1 text-[13px] text-de9-gray">
              {d.prestataire &&
                (d.prestataireId ? (
                  <button
                    type="button"
                    onClick={() => openPres(d.prestataireId ?? '')}
                    className="cursor-pointer font-bold text-de9-teal-dark hover:underline"
                  >
                    {d.prestataire}
                  </button>
                ) : (
                  <span className="font-bold text-de9-slate">{d.prestataire}</span>
                ))}
              {d.reference && <span> · {d.reference}</span>}
            </div>
          </div>
          {d.statut && (
            <span className="rounded-full bg-secondary px-3 py-1.5 text-[11.5px] font-extrabold text-de9-slate">{d.statut}</span>
          )}
        </div>

        {fields.some(([, v]) => v) && (
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
        )}

        {d.message && (
          <div className="mt-5">
            <div className={LABEL}>{t('ctrMessage')}</div>
            <div className="mt-1 text-[13px] leading-relaxed whitespace-pre-line text-de9-slate">{d.message}</div>
          </div>
        )}
      </div>

      <div className={`${CARD} mt-4`}>
        <div className="mb-3 flex items-center gap-2 text-base font-extrabold">
          <Users className="size-[18px] text-de9-gray" />
          {t('ctrCandidats')}
          {candidatsQ.isSuccess && <span className="text-de9-gray">({candidats.length})</span>}
        </div>
        {candidatsQ.isPending && <div className="h-[90px] animate-pulse rounded-[12px] bg-secondary" />}
        {candidatsQ.isError && (
          <div className="text-[12.5px] font-semibold text-de9-red">{problemMessage(candidatsQ.error)}</div>
        )}
        {candidatsQ.isSuccess && candidats.length === 0 && (
          <div className="py-6 text-center text-[13px] text-de9-gray">{t('ctrAucunCandidat')}</div>
        )}
        {candidats.map((c) => (
          <div key={c.key} className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-de9-line py-3 last:border-b-0">
            <div className="min-w-[160px] flex-1 text-[13px] font-bold">{c.nom ?? '—'}</div>
            {c.metier && <div className="text-[12.5px] text-de9-slate">{c.metier}</div>}
            {c.wilaya && <div className="text-[12px] text-de9-gray">{c.wilaya}</div>}
            {c.telephone && (
              <a href={`tel:${c.telephone}`} className="text-[12px] font-semibold text-de9-teal-dark" dir="ltr">
                {c.telephone}
              </a>
            )}
            {c.statut && (
              <span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-bold text-de9-slate">{c.statut}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
