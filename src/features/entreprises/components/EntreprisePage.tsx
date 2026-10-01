// /entreprises/:companyId?cote=client|prestataire&onglet=… — the screen an
// alert about a company opens (guide 11a §6, adm.entreprise). The company's
// fiches already exist as overlays (?pres= keyed by id, ?client= keyed by
// name): this page names the company, opens the fiche of the alert's side on
// the tab it asked for, and stays underneath once the fiche is closed.
import { useEffect, useRef } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowRight, Building2, ChevronLeft } from 'lucide-react';
import { Glyph } from '@/components/common/Glyph';
import { useT } from '@/lib/i18n';
import { problemMessage } from '@/api/problem';
import { useCreditClient } from '@/features/credits/api/credits';
import { fmtDate } from '@/features/kyc/lib/kyc';
import { useEntreprise } from '../api/entreprises';

const CARD = 'rounded-md border border-de9-line bg-card p-[22px]';

type Side = 'client' | 'prestataire';

function sideOf(value: string | null): Side | null {
  return value === 'client' || value === 'prestataire' ? value : null;
}

export function EntreprisePage() {
  const { companyId = '' } = useParams<'companyId'>();
  const t = useT();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const cote = sideOf(searchParams.get('cote'));

  const companyQ = useEntreprise(companyId);
  // The client fiche is keyed by the client's name: its credits entry has it.
  const clientQ = useCreditClient(cote === 'client' ? companyId : null);
  const company = companyQ.data;
  const nom = company?.nom ?? null;
  const clientName = clientQ.data?.nom ?? nom;

  const openFiche = (side: Side, replace = false): void => {
    if (side === 'client' && !clientName) return;
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (side === 'prestataire') {
          next.set('pres', companyId);
          next.delete('client');
        } else {
          next.set('client', clientName ?? '');
          next.delete('pres');
        }
        return next;
      },
      { replace },
    );
  };

  // Open the alert's side once, as soon as what it needs is known; closing the
  // fiche then leaves this page (replace: « back » does not reopen it).
  const autoOpened = useRef(false);
  const clientSettled = cote !== 'client' || (!clientQ.isPending && !companyQ.isPending);
  useEffect(() => {
    if (autoOpened.current || !cote || !clientSettled) return;
    if (cote === 'client' && !clientName) return;
    autoOpened.current = true;
    openFiche(cote, true);
  });

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

  const rows: ReadonlyArray<[string, string | null]> = company
    ? [
        [t('entEmail'), company.email],
        [t('entTelephone'), company.telephone],
        [t('entWilaya'), company.wilaya],
        ['RC', company.rc],
        ['NIF', company.nif],
        ['NIS', company.nis],
        [t('entInscriteLe'), company.creeLe ? fmtDate(company.creeLe, t) : null],
      ]
    : [];

  return (
    <div className="mx-auto max-w-[760px]">
      {backLink}

      {companyQ.isPending && <div className="h-[220px] animate-pulse rounded-md bg-card" />}

      {companyQ.isError && (
        <div className={CARD}>
          <div className="text-[13px] font-semibold text-de9-red">
            {t('entErreur')} — {problemMessage(companyQ.error)}
          </div>
          <FicheButtons onOpen={openFiche} canOpenClient={!!clientName} />
        </div>
      )}

      {company && (
        <div className={CARD}>
          <div className="flex items-center gap-3.5">
            <div className="flex size-12 flex-none items-center justify-center rounded-md bg-primary-container text-on-primary-container">
              <Building2 className="size-6" />
            </div>
            <div className="min-w-0">
              <div className="truncate text-[20px] font-extrabold">{nom ?? company.id}</div>
              {cote && (
                <div className="mt-0.5 text-[12.5px] font-semibold text-de9-gray">
                  {cote === 'client' ? t('entCoteClient') : t('entCotePrestataire')}
                </div>
              )}
            </div>
          </div>

          {rows.some(([, v]) => v) && (
            <div className="mt-5 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
              {rows.map(([label, value]) =>
                value ? (
                  <div key={label} className="min-w-0">
                    <div className="text-[11px] font-bold tracking-[.04em] text-de9-gray uppercase">{label}</div>
                    <div className="mt-0.5 truncate text-[13.5px] font-semibold text-de9-ink">{value}</div>
                  </div>
                ) : null,
              )}
            </div>
          )}

          <FicheButtons onOpen={openFiche} canOpenClient={!!clientName} />
          <button
            type="button"
            onClick={() => navigate(`/kyc/${encodeURIComponent(companyId)}`)}
            className="mt-2.5 cursor-pointer text-[12.5px] font-bold text-de9-teal-dark hover:underline"
          >
            {t('entDossierKyc')} <Glyph icon={ArrowRight} className="rtl:rotate-180" />
          </button>
        </div>
      )}
    </div>
  );
}

function FicheButtons({ onOpen, canOpenClient }: { onOpen: (side: Side) => void; canOpenClient: boolean }) {
  const t = useT();
  const btn =
    'cursor-pointer rounded-full border border-de9-line bg-card px-4 py-2.5 text-[12.5px] font-bold text-de9-slate hover:bg-de9-row disabled:cursor-not-allowed disabled:opacity-50';
  return (
    <div className="mt-5 flex flex-wrap gap-2.5">
      <button type="button" onClick={() => onOpen('prestataire')} className={btn}>
        {t('entFichePrestataire')}
      </button>
      <button type="button" onClick={() => onOpen('client')} disabled={!canOpenClient} className={btn}>
        {t('entFicheClient')}
      </button>
    </div>
  );
}
