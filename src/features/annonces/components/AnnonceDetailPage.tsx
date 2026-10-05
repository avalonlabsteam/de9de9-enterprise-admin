// ANNONCES — one annonce: GET /admin/annonces/{annonceId}. One call paints the
// page — the annonce as its company reads it, the company, the review facts,
// de9de9's buttons (`actions`, drawn as sent) and the history. The five
// actions answer the same shape: the page is replaced with the answer.
import { useState, type ReactNode } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowRight, Check, ChevronLeft, Circle, Hourglass, RefreshCw, TriangleAlert } from 'lucide-react';
import { useT, type TKey } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Glyph } from '@/components/common/Glyph';
import { fmtAlger } from '@/features/comptabilite/lib/comptabilite';
import { CategoryIcon } from '@/features/prestataires/components/CategoryIcon';
import { refreshAnnonces, reloadAnnonce, useAnnonceAction, useAnnonceDetail } from '../api/annonces';
import {
  annErrorMessage,
  annProblem,
  invisibiliteOf,
  kycPill,
  roleLabel,
  statutLabel,
  taxoOf,
} from '../lib/annonces';
import type { Annonce, AnnonceAction, AnnonceB2b, AnnonceB2c, AnnonceDetail } from '../schemas/annonces';
import { MotifDialog } from './MotifDialog';
import { Cover, Dated, Pill, StatutPills } from './shared';

const CARD = 'rounded-md border border-de9-line bg-card p-5';
const LABEL = 'text-[10.5px] font-extrabold tracking-[.04em] text-de9-gray uppercase';
const CHIP = 'inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-[4px] text-[11px] font-bold text-de9-slate';

/** Set by the queue's rows, so « Retour » restores its tab, filters and page. */
export interface AnnonceBackState {
  fromQueue?: boolean;
}

const TOAST_KEY: Record<string, TKey> = {
  approuver: 'annToastApprouvee',
  refuser: 'annToastRefusee',
  suspendre: 'annToastSuspendue',
  retablir: 'annToastRetablie',
  marquer_revue: 'annToastRevue',
};

export function AnnonceDetailPage() {
  const { annonceId = '' } = useParams<'annonceId'>();
  const t = useT();
  const navigate = useNavigate();
  const location = useLocation();
  const detailQ = useAnnonceDetail(annonceId);
  const fromQueue = (location.state as AnnonceBackState | null)?.fromQueue === true;

  const backLink = (
    <button
      type="button"
      onClick={() => (fromQueue ? navigate(-1) : navigate('/annonces'))}
      className="mb-4 inline-flex cursor-pointer items-center gap-1.5 text-[13px] font-bold text-de9-slate"
    >
      <ChevronLeft className="size-4 rtl:rotate-180" />
      {t('annRetourFile')}
    </button>
  );

  if (detailQ.isPending) {
    return (
      <div className="mx-auto max-w-[1180px]">
        {backLink}
        <div className="h-[170px] animate-pulse rounded-md bg-card" />
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[1.7fr_1fr]">
          <div className="h-[420px] animate-pulse rounded-md bg-card" />
          <div className="h-[420px] animate-pulse rounded-md bg-card" />
        </div>
      </div>
    );
  }

  if (detailQ.isError) {
    const gone = annProblem(detailQ.error).status === 404;
    return (
      <div className="mx-auto max-w-[1180px]">
        {backLink}
        <div className={cn(CARD, 'flex flex-wrap items-center gap-3 text-[13px] font-semibold text-de9-red')}>
          {gone
            ? annErrorMessage(detailQ.error, t, 'annErrIntrouvable')
            : `${t('annErreurDetail')} — ${annErrorMessage(detailQ.error, t)}`}
          {gone ? (
            <Link to="/annonces" className="text-[12.5px] font-bold text-de9-teal-dark">
              {t('annRetourFile')} <Glyph icon={ArrowRight} className="rtl:rotate-180" />
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => void detailQ.refetch()}
              className="cursor-pointer rounded-full border border-de9-line bg-card px-2.5 py-1.5 text-[11.5px] font-bold text-de9-slate"
            >
              <Glyph icon={RefreshCw} /> {t('reessayer')}
            </button>
          )}
        </div>
      </div>
    );
  }

  // Keyed: a motif typed on one annonce must not follow the admin to another.
  return <Detail key={detailQ.data.annonce.id} detail={detailQ.data} backLink={backLink} />;
}

/** b2b · b2c — or the kind the server named when the panel does not know it. */
const kindOf = (a: Annonce): string => (a.type === 'autre' ? a.typeOrigine : a.type);

function Detail({ detail: d, backLink }: { detail: AnnonceDetail; backLink: ReactNode }) {
  const t = useT();
  const navigate = useNavigate();
  const run = useAnnonceAction();
  const a = d.annonce;
  const e = d.entreprise;
  const r = d.revue;

  // The motif dialog: what was typed survives a 409 that closes it.
  const [motifFor, setMotifFor] = useState<AnnonceAction | null>(null);
  const [motif, setMotif] = useState('');
  const [motifError, setMotifError] = useState<string | null>(null);
  const [confirmFor, setConfirmFor] = useState<AnnonceAction | null>(null);

  const send = (action: AnnonceAction, withMotif?: string): void => {
    setMotifError(null);
    run.mutate(
      { annonceId: a.id, action, version: a.version, motif: withMotif, type: kindOf(a) },
      {
        onSuccess: () => {
          const key = TOAST_KEY[action.code];
          toast.success(key ? t(key) : action.label);
          if (withMotif !== undefined) setMotif('');
          setMotifFor(null);
          setConfirmFor(null);
        },
        onError: (err) => {
          const p = annProblem(err);
          const msg = annErrorMessage(err, t, 'annErrIntrouvable');
          if (withMotif !== undefined && p.status === 400 && (!p.field || p.field.toLowerCase() === 'motif')) {
            setMotifError(msg);
            return;
          }
          toast.error(msg);
          setMotifFor(null);
          setConfirmFor(null);
          if (p.code === 'annonce_not_found' || p.status === 404) {
            refreshAnnonces();
            navigate('/annonces');
          } else if (p.status === 409) {
            // Another admin, or the company, moved the annonce: read it again before deciding.
            reloadAnnonce(a.id);
          }
        },
      },
    );
  };

  const onAction = (action: AnnonceAction): void => {
    if (action.motifRequis) {
      setMotifError(null);
      setMotifFor(action);
    } else if (action.code === 'retablir') setConfirmFor(action);
    else send(action);
  };

  const b2bPubliee = a.type === 'b2b' && a.statut.code === 'publiee';
  const invisible = b2bPubliee ? invisibiliteOf(e) : [];
  const publication = a.type === 'b2c' ? a.publication : null;
  const modifiee = !!r.modifieeDepuisRevueLe;
  /** The red card under the header: what the company reads on a refused or suspended annonce. */
  const motifEnTete = a.motif && (a.statut.code === 'refusee' || a.statut.code === 'suspendue') ? a.motif : null;

  return (
    <div className="mx-auto max-w-[1180px]">
      {backLink}

      {/* ===== header: what it is, where it stands, what de9de9 can do ===== */}
      <div className={CARD}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3.5">
            <Cover url={(a.photos ?? []).find((p) => p.couverture)?.url ?? a.photos?.[0]?.url} className="size-14" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 dir="auto" className="text-[20px] leading-tight font-extrabold ltr:text-left rtl:text-right">
                  {a.titre}
                </h1>
                <span className={CHIP}>{a.typeChip.label}</span>
              </div>
              {a.type === 'b2c' && a.sousTitre && <div className="mt-0.5 text-[12.5px] text-de9-gray">{a.sousTitre}</div>}
              {a.type === 'b2b' && a.categorie && <div className="mt-0.5 text-[12.5px] text-de9-gray">{a.categorie.libelle}</div>}
              <div className="mt-2">
                <StatutPills statut={a.statut} publication={publication} modifiee={modifiee} reprise={r.origine === 'reprise_fiche'} />
              </div>
            </div>
          </div>
          {d.actions.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {d.actions.map((action) => (
                <button
                  key={action.code}
                  type="button"
                  onClick={() => onAction(action)}
                  disabled={run.isPending}
                  className={cn(
                    'cursor-pointer rounded-full px-4 py-2.5 text-[12.5px] font-bold disabled:cursor-not-allowed disabled:opacity-60',
                    action.style === 'danger'
                      ? 'border border-de9-red bg-card text-de9-red'
                      : action.code === 'approuver'
                        ? 'bg-primary text-primary-foreground'
                        : 'border border-de9-line bg-card text-de9-slate hover:bg-de9-row',
                  )}
                >
                  {run.isPending && run.variables?.action.code === action.code ? t('accesTraitement') : action.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {modifiee && (
          <div className="mt-3.5 flex items-start gap-2 rounded-md bg-[#FBF4E4] px-3.5 py-2.5 text-[12.5px] font-semibold text-[#92702A] dark:bg-[#B68A2E]/15 dark:text-[#D9B36A]">
            <Glyph icon={TriangleAlert} className="mt-0.5" />
            <span>
              <Dated text={t('annAVerifierDepuis')} iso={r.modifieeDepuisRevueLe} />
            </span>
          </div>
        )}
        {d.synchronisation?.note && (
          <div className="mt-2.5 flex items-start gap-2 rounded-md bg-[#FBF4E4] px-3.5 py-2.5 text-[12.5px] text-[#92702A] dark:bg-[#B68A2E]/15 dark:text-[#D9B36A]">
            <Glyph icon={Hourglass} className="mt-0.5" />
            <span dir="auto" className="ltr:text-left rtl:text-right">
              {d.synchronisation.note}
            </span>
          </div>
        )}
        {motifEnTete && (
          <div className="mt-2.5 rounded-md bg-[#FDECEC] px-3.5 py-2.5 text-[12.5px] text-de9-red dark:bg-[#E7464E]/15">
            <div className="font-bold">{t('annMotifCommunique')}</div>
            <div dir="auto" className="mt-0.5 ltr:text-left rtl:text-right">
              {motifEnTete}
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[1.7fr_1fr]">
        {/* ===== the annonce as its company wrote it ===== */}
        <div className="flex min-w-0 flex-col gap-4">
          <div className={CARD}>
            {(a.photos ?? []).length > 0 && (
              <div className="mb-4 grid grid-cols-3 gap-2 sm:grid-cols-4">
                {(a.photos ?? []).map((p) => (
                  <a key={p.id} href={p.url} target="_blank" rel="noreferrer" className="relative block">
                    <img src={p.url} alt="" loading="lazy" className="aspect-[4/3] w-full rounded-md object-cover" />
                    {p.couverture && (
                      <span className="absolute start-1.5 top-1.5 rounded-full bg-black/55 px-2 py-[2px] text-[10px] font-bold text-white">
                        {t('annCouverture')}
                      </span>
                    )}
                  </a>
                ))}
              </div>
            )}
            <div className={LABEL}>{t('annDescription')}</div>
            <div dir="auto" className="mt-1 text-[13px] leading-relaxed whitespace-pre-line text-de9-slate ltr:text-left rtl:text-right">
              {a.description || '—'}
            </div>
          </div>

          <div className={CARD}>
            {a.type === 'b2b' && <FicheB2b a={a} />}
            {a.type === 'b2c' && <FicheB2c a={a} />}
            {a.type === 'autre' && <div className="text-[12.5px] text-de9-gray">{t('annTypeInconnu')}</div>}
          </div>

          {(a.etapes ?? []).length > 0 && (
            <div className={CARD}>
              <div className={LABEL}>{t('annCompletude')}</div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5">
                {(a.etapes ?? []).map((s) => (
                  <span key={s.code} className={cn('text-[12.5px]', s.complete ? 'text-de9-ink' : 'text-de9-gray')}>
                    <Glyph icon={s.complete ? Check : Circle} className={s.complete ? 'text-[#2FA86A]' : ''} /> {s.label}
                  </span>
                ))}
              </div>
            </div>
          )}

          <History rows={d.historique} />
        </div>

        {/* ===== the company and the review ===== */}
        <div className="flex min-w-0 flex-col gap-4">
          <EntrepriseCard detail={d} invisible={invisible} />
          <RevueCard detail={d} motifEnTete={motifEnTete} />
        </div>
      </div>

      {motifFor && (
        <MotifDialog
          code={motifFor.code}
          label={motifFor.label}
          motif={motif}
          onMotifChange={(v) => {
            setMotif(v);
            if (motifError) setMotifError(null);
          }}
          error={motifError}
          pending={run.isPending}
          onSubmit={() => send(motifFor, motif)}
          onClose={() => setMotifFor(null)}
        />
      )}

      {confirmFor && (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open && !run.isPending) setConfirmFor(null);
          }}
        >
          <DialogContent
            showCloseButton={false}
            aria-describedby={undefined}
            className="block max-w-[calc(100%-2rem)] gap-0 rounded-xl bg-card p-6 text-de9-ink sm:max-w-[420px] sm:p-7"
          >
            <DialogTitle className="text-[19px] leading-normal font-extrabold text-de9-ink">{t('annRetablirTitre')}</DialogTitle>
            <div className="mt-5 flex gap-2.5">
              <button
                type="button"
                onClick={() => setConfirmFor(null)}
                disabled={run.isPending}
                className="flex-1 cursor-pointer rounded-full border border-de9-line bg-card p-3 text-sm font-bold text-de9-slate disabled:opacity-50"
              >
                {t('annuler')}
              </button>
              <button
                type="button"
                onClick={() => send(confirmFor)}
                disabled={run.isPending}
                className="flex-1 cursor-pointer rounded-full bg-primary p-3 text-sm font-bold text-primary-foreground disabled:opacity-60"
              >
                {run.isPending ? t('accesTraitement') : confirmFor.label}
              </button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <div className={LABEL}>{label}</div>
      {/* The server writes these in French (« 4 000 – 9 000 DA / jour »): isolated, the Arabic UI keeps their order. */}
      <div className="mt-1 text-[13px] text-de9-ink">{typeof children === 'string' ? <bdi>{children}</bdi> : children}</div>
    </div>
  );
}

function FicheB2b({ a }: { a: AnnonceB2b }) {
  const t = useT();
  const taxo = taxoOf(a.categorie?.code);
  const zones = a.zones ?? [];
  return (
    <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
      <Field label={t('annCategorie')}>
        {a.categorie ? (
          <span className="inline-flex flex-wrap items-center gap-2 font-semibold">
            {taxo && <CategoryIcon id={taxo.id} className="size-5" />}
            {a.categorie.libelle}
            {a.categorie.familleLabel && (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-de9-gray">
                <span className="size-2 rounded-full" style={{ background: a.categorie.hex ?? '#9AA4B2' }} />
                {a.categorie.familleLabel}
              </span>
            )}
          </span>
        ) : (
          '—'
        )}
      </Field>
      <Field label={t('annTarif')}>{a.tarif?.label ?? '—'}</Field>
      <div className="sm:col-span-2">
        <Field label={t('annServices')}>
          {(a.sousCategories ?? []).length ? (
            <span className="flex flex-wrap gap-1.5">
              {(a.sousCategories ?? []).map((s) => (
                <span key={s.code} className={CHIP}>
                  {s.libelle}
                </span>
              ))}
            </span>
          ) : (
            '—'
          )}
        </Field>
      </div>
      <div className="sm:col-span-2">
        <Field label={t('annZones')}>
          {zones.length ? (
            <span className="flex flex-wrap gap-1.5" title={a.zonesLabel ?? undefined}>
              {zones.map((z, i) => (
                <span key={i} className={CHIP}>
                  {z.wilaya ?? z.wilayaCode}
                  {z.communeCode == null ? ` · ${t('annToutLaWilaya')}` : z.commune ? ` · ${z.commune}` : ''}
                </span>
              ))}
            </span>
          ) : (
            (a.zonesLabel ?? '—')
          )}
        </Field>
      </div>
      <Field label={t('annDelai')}>{a.delaiLabel ?? '—'}</Field>
      <Field label={t('annCapacite')}>{a.capacite ?? '—'}</Field>
      <div className="sm:col-span-2">
        <Field label={t('annReferences')}>
          <span dir="auto" className="block whitespace-pre-line ltr:text-left rtl:text-right">
            {a.references || '—'}
          </span>
        </Field>
      </div>
      <Field label={t('annCertifications')}>
        {(a.certifications ?? []).length ? (
          <span className="flex flex-wrap gap-1.5">
            {(a.certifications ?? []).map((c) => (
              <span key={c} className={CHIP}>
                <Glyph icon={Check} /> {c}
              </span>
            ))}
          </span>
        ) : (
          '—'
        )}
      </Field>
      <Field label={t('annDemandesIssues')}>{a.demandesIssues?.label ?? '—'}</Field>
    </div>
  );
}

function FicheB2c({ a }: { a: AnnonceB2c }) {
  const t = useT();
  const lignes = a.lignes ?? [];
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
        <Field label={t('annCategorie')}>
          {a.categorie ? (
            <span className="inline-flex items-center gap-2 font-semibold">
              {a.categorie.photoUrl && <img src={a.categorie.photoUrl} alt="" className="size-6 rounded-sm object-cover" />}
              {a.categorie.libelle}
              {a.categorie.groupe && <span className="text-[11.5px] font-normal text-de9-gray">· {a.categorie.groupe}</span>}
            </span>
          ) : (
            '—'
          )}
        </Field>
        <Field label={t('annUniteDefaut')}>{a.uniteDefautLabel ?? '—'}</Field>
        <Field label={t('annRemise')}>{a.remise ? <span className="num">{a.remise} %</span> : '—'}</Field>
        <Field label={t('annZones')}>
          <bdi>{a.zones?.resume ?? '—'}</bdi>
          {a.zones?.communesCouvertes != null && (
            <div className="text-[11.5px] text-de9-gray">{t('annCommunes').replace('{n}', String(a.zones.communesCouvertes))}</div>
          )}
        </Field>
      </div>

      <div>
        <div className={LABEL}>{t('annPrestations')}</div>
        {lignes.length ? (
          <div className="mt-1.5 overflow-hidden rounded-md border border-de9-line">
            {lignes.map((l) => (
              <div key={l.id} className="flex items-center justify-between gap-3 border-b border-de9-line px-3 py-2 text-[12.5px] last:border-b-0">
                <span className="min-w-0">
                  {l.libelle}
                  {l.estLibre && <span className="ms-1.5 text-[11px] text-de9-gray">({t('annLigneLibre')})</span>}
                </span>
                <span className="num flex-none font-bold text-de9-ink">{l.prixLabel ?? '—'}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-1 text-[13px] text-de9-gray">—</div>
        )}
      </div>

      {(a.questionnaire ?? []).length > 0 && (
        <div>
          <div className={LABEL}>{t('annQuestionnaire')}</div>
          <div className="mt-1.5 flex flex-col gap-1.5">
            {(a.questionnaire ?? []).map((q, i) => (
              <div key={i} className="text-[12.5px]">
                <span className="text-de9-gray">{q.question}</span> <span className="font-semibold text-de9-ink">{q.reponses.join(', ') || '—'}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {(a.disponibilites ?? []).length > 0 && (
        <div>
          <div className={LABEL}>{t('annDisponibilites')}</div>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {(a.disponibilites ?? []).map((s, i) => (
              <span key={i} className={CHIP}>
                {s.jourLabel ?? s.jour}
                <span className="num">{[s.debut, s.fin].filter(Boolean).join('–')}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const B2C_STATUT: Record<string, TKey> = {
  non_autorise: 'accesB2cNonAccorde',
  en_attente: 'commonKycEnAttente',
  actif: 'accesB2cActif',
  suspendu: 'accesSuspendu',
};

function EntrepriseCard({ detail: d, invisible }: { detail: AnnonceDetail; invisible: TKey[] }) {
  const t = useT();
  const e = d.entreprise;
  const kyc = kycPill(e.kycStatut, t);
  const fiche = e.ficheListee === true ? 'annFicheListee' : e.ficheListee === false ? 'annFicheDelistee' : 'annPasDeFiche';
  const couverture =
    e.couvertureSource === 'annonces' ? 'annCouvertureAnnonces' : e.couvertureSource === 'manuelle' ? 'annCouvertureManuelle' : null;
  const b2cKey = e.b2c?.statut ? B2C_STATUT[e.b2c.statut] : undefined;
  return (
    <div className={CARD}>
      <div className={LABEL}>{t('annEntreprise')}</div>
      <Link
        to={`/entreprises/${encodeURIComponent(e.id)}?cote=prestataire`}
        className="mt-1 block text-[15px] font-extrabold text-de9-ink underline decoration-[#C7CFD7] decoration-dotted underline-offset-[3px]"
      >
        <bdi>{e.nom}</bdi>
      </Link>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {kyc && <Pill className={kyc.chip}>KYC · {kyc.label}</Pill>}
        <Pill className="bg-secondary text-de9-slate">{t(fiche)}</Pill>
        {e.b2bOuvert === false && <Pill className="bg-[#FBF4E4] text-[#B68A2E] dark:bg-[#B68A2E]/15 dark:text-[#D9B36A]">{t('accesChipB2bSuspendu')}</Pill>}
      </div>
      {e.estPrestataire === false && <div className="mt-2 text-[12.5px] font-semibold text-de9-red">{t('annPlusPrestataire')}</div>}
      {couverture && <div className="mt-2 text-[12.5px] text-de9-slate">{t(couverture)}</div>}
      {b2cKey && (
        <div className="mt-1 text-[12.5px] text-de9-slate">
          {t('annAccesB2c')} : {t(b2cKey)}
        </div>
      )}

      {/* A published B2B annonce no client sees: say why, before the admin wonders. */}
      {invisible.length > 0 && (
        <div className="mt-3 rounded-md bg-[#FBF4E4] px-3.5 py-2.5 text-[12.5px] text-[#92702A] dark:bg-[#B68A2E]/15 dark:text-[#D9B36A]">
          <div className="font-bold">{t('annInvisible')}</div>
          <ul className="mt-1 list-disc ps-4">
            {invisible.map((k) => (
              <li key={k}>{t(k)}</li>
            ))}
          </ul>
        </div>
      )}

      <Link
        to={`/annonces?onglet=toutes&companyId=${encodeURIComponent(e.id)}`}
        className="mt-3 inline-block text-[12.5px] font-bold text-de9-teal-dark hover:underline"
      >
        {t('annVoirSesAnnonces')} <Glyph icon={ArrowRight} className="rtl:rotate-180" />
      </Link>
    </div>
  );
}

/**
 * The review facts. « À vérifier depuis » is the header's strip, not repeated
 * here; the stored motif only when the header does not already show it — an
 * annonce sent back for review keeps the reason of its last refusal.
 */
function RevueCard({ detail: d, motifEnTete }: { detail: AnnonceDetail; motifEnTete: string | null }) {
  const t = useT();
  const r = d.revue;
  const statut = d.annonce.statut.code;
  return (
    <div className={CARD}>
      <div className={LABEL}>{t('annRevue')}</div>
      <div className="mt-2 flex flex-col gap-1.5 text-[12.5px] text-de9-slate">
        {r.soumiseLe && (
          <div>
            <Dated text={t('annSoumiseLe')} iso={r.soumiseLe} />
          </div>
        )}
        {/* A direct publication stamps `revueLe` too: only a named reviewer read it. */}
        {r.revueLe && (
          <div className={r.revueParUserId ? '' : 'font-semibold text-[#B68A2E] dark:text-[#D9B36A]'}>
            <Dated text={r.revueParUserId ? t('annRevueLe') : t('annPublieeSansRevue')} iso={r.revueLe} />
          </div>
        )}
        <div>
          {r.premierePublicationLe ? <Dated text={t('annPremierePublication')} iso={r.premierePublicationLe} /> : t('annJamaisPubliee')}
        </div>
        {statut === 'suspendue' && r.statutAvantSuspension && (
          <div>{t('annStatutAvantSuspension').replace('{s}', statutLabel(r.statutAvantSuspension, t))}</div>
        )}
        {statut === 'en_revue' && r.statutAvantSoumission && (
          <div>{t('annStatutAvantSoumission').replace('{s}', statutLabel(r.statutAvantSoumission, t))}</div>
        )}
        {r.motif && r.motif !== motifEnTete && (
          <div>
            <span className="font-semibold">{t('annMotifEnregistre')}</span>{' '}
            <bdi>{r.motif}</bdi>
          </div>
        )}
      </div>
    </div>
  );
}

function History({ rows }: { rows: AnnonceDetail['historique'] }) {
  const t = useT();
  return (
    <div className={CARD}>
      <div className={LABEL}>{t('annHistorique')}</div>
      {rows.length === 0 ? (
        <div className="mt-2 text-[12.5px] text-de9-gray">—</div>
      ) : (
        <ol className="mt-2 flex flex-col">
          {rows.map((h, i) => {
            const role = roleLabel(h.acteurRole, t);
            const change = h.avant !== h.apres;
            return (
              <li key={`${h.at}-${i}`} className="flex gap-3 border-b border-de9-line py-2.5 last:border-b-0">
                <span className="num w-[118px] flex-none text-[11.5px] text-de9-gray">{fmtAlger(h.at) ?? '—'}</span>
                <div className="min-w-0 text-[12.5px]">
                  <span className="font-bold text-de9-ink">{h.label}</span>
                  {change && h.apres && (
                    <span className="text-de9-slate">
                      {' · '}
                      {/* The arrow turns with the reading direction: « before » is always read first. */}
                      {h.avant && (
                        <>
                          {statutLabel(h.avant, t)} <Glyph icon={ArrowRight} className="rtl:rotate-180" />{' '}
                        </>
                      )}
                      {statutLabel(h.apres, t)}
                    </span>
                  )}
                  {(role || h.pourLeCompteDe) && (
                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-de9-gray">
                      {role}
                      {h.pourLeCompteDe && <span className="rounded-full bg-[#EAF2FD] px-1.5 py-px font-bold text-[#2F7FD0] dark:bg-[#2F7FD0]/15 dark:text-[#7EB5EC]">{t('annPourLeCompteDe')}</span>}
                    </div>
                  )}
                  {h.motif && (
                    <div dir="auto" className="mt-0.5 text-[11.5px] text-de9-slate italic ltr:text-left rtl:text-right">
                      {h.motif}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
