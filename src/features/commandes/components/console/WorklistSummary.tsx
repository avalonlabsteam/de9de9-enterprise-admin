// COMMANDES — console view for a live worklist row, driven by
// GET /commandes/worklist/{id}. The editable console needs the mock commande
// payload, which a live commande id (an appel d'offres or a visit) doesn't have. So
// the page renders what the worklist detail knows — status, each party's side,
// the next action and its SLA, the dossier (client, prestataires, demande,
// fichiers — CommandeDossier), the devis — and can run that next action through
// POST …/next-action when it needs no form (the endpoint takes no body), and
// validate or refuse each received devis (POST /devis/{devisId}/valider | /refuser).
// Proposing the validated ones to the client is the S3 next action, run from
// that same button — the devis list has no button of its own for it.
import { useState, type ReactNode } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Check, Lock, Mail, Pencil, Play, RefreshCw, Search, Timer, X } from 'lucide-react';
import { Glyph } from '@/components/common/Glyph';
import { PhoneNumber } from '@/components/common/PhoneNumber';
import { useT, type TKey } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { problemMessage } from '@/api/problem';
import {
  useAffecterOuvrier,
  useChoisirPrestataire,
  useDeposerFacture,
  useDevisDecision,
  usePlanifierOccurrence,
  usePrestataireEquipe,
  useWorklistNextAction,
  type DevisDecision,
} from '../../api/commandes';
import type { Ball } from '../../schemas/commande';
import type { WorklistDetail, WorklistDevis, WorklistPartyState } from '../../schemas/worklistDetail';
import {
  BALL_COLOR,
  DEVIS_ANCHOR,
  ballLabel,
  formatDuration,
  statusBadge,
  visitLabel,
  type Tr,
} from '../../lib/worklistDisplay';
import { ReprogramModal } from './ActionModals';
import { AssignTeamModal } from './AssignTeamModal';
import { DepositInvoiceModal } from './DepositInvoiceModal';
import { ChoosePrestataireModal, type ChoosableQuote } from './ChoosePrestataireModal';
import { CommandeDossier } from './CommandeDossier';

const CARD =
  'rounded-md border border-de9-line bg-card px-6 py-[22px]';

const SECTION_LABEL = 'text-[11px] font-bold uppercase tracking-[.04em] text-de9-gray';

const CONTACT_LINK =
  'rounded-full border border-de9-line bg-card px-3.5 py-2.5 text-[12px] font-bold text-de9-slate no-underline';

const KIND_KEY: Record<string, TKey> = {
  rfq: 'apercuKindRfq',
  visite: 'apercuKindVisite',
};

const PARTY_KEY: Record<string, TKey> = {
  action_required: 'apercuPartyActionRequired',
  waiting: 'apercuPartyWaiting',
  done: 'apercuPartyDone',
};

const PARTY_COLOR: Record<string, string> = {
  action_required: '#E7464E',
  waiting: '#D9871F',
  done: '#2FA86A',
};

const DEVIS_KEY: Record<string, TKey> = {
  attente: 'apercuDevisAttente',
  recu: 'apercuDevisRecu',
  valide: 'apercuDevisValide',
  refuse: 'apercuDevisRefuse',
};

/**
 * Visit roadmap steps whose action is a form, posted to
 * POST /commandes/{visitId}/actions with `occId` = the visit id.
 */
const VISIT_FORM_STEP: Record<string, 'reprogram' | 'assign' | 'deposit'> = {
  V0: 'reprogram', // Planifier l'occurrence — date + heure
  V2: 'assign', // Affecter un ouvrier — from the prestataire's équipe
  V4: 'deposit', // Déposer la facture — montant, fichier, note
};

/** Visit roadmap steps run through POST …/next-action with no body, whatever `form` says. */
const NEXT_ACTION_STEPS = new Set(['V1', 'V3', 'V5', 'V6']);

/** What the money-moving steps do, shown beside their button. */
const STEP_HINT: Record<string, TKey> = {
  V5: 'visiteDebiteClient',
  V6: 'visitePaiePrestataire',
};

/** Localized fallback per documented error status (next-action; the devis routes answer the same way). */
const ACTION_ERROR_KEY: Record<number, TKey> = {
  403: 'apercuActionErr403',
  404: 'apercuActionErr404',
  409: 'apercuActionErr409',
  422: 'apercuActionErr422',
};

const fmtCredits = (n: number): string => n.toLocaleString('fr-FR');

/** The server's message for a failed action, else the localized one for its status. */
function actionError(err: unknown, t: Tr): string {
  return problemMessage(err, (status) => {
    const key = status != null ? ACTION_ERROR_KEY[status] : undefined;
    return key ? t(key) : undefined;
  });
}

/**
 * Where « Planifier » must go after a refusal: 409 `commande_en_execution`
 * (someone planned it meanwhile) names the live row in `newId`; 409
 * `partially_applied` the visit to plan in `visitId`; 404 the list.
 */
function planifierRedirect(err: unknown): string | null {
  if (!axios.isAxiosError(err)) return null;
  const status = err.response?.status;
  const body = (err.response?.data ?? {}) as { code?: unknown; newId?: unknown; visitId?: unknown };
  if (status === 404) return '/commandes';
  if (status !== 409) return null;
  const target =
    body.code === 'commande_en_execution' ? body.newId : body.code === 'partially_applied' ? body.visitId : null;
  return typeof target === 'string' && target ? '/commandes/' + target : null;
}

interface FieldProps {
  label: string;
  value: ReactNode;
}

function Field({ label, value }: FieldProps) {
  return (
    <div>
      <div className={SECTION_LABEL}>{label}</div>
      <div className="mt-1 text-[13.5px] font-semibold text-de9-ink">{value}</div>
    </div>
  );
}

interface PartyCardProps {
  ball: Ball;
  label: string;
  state: WorklistPartyState | null | undefined;
}

function PartyCard({ ball, label, state }: PartyCardProps) {
  const t = useT();
  const code = state?.code ?? '';
  const key = PARTY_KEY[code];
  return (
    <div className="rounded-md border border-de9-line px-3 py-2.5">
      <div
        className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-[.04em]"
        style={{ color: BALL_COLOR[ball] }}
      >
        <span className="h-2 w-2 rounded-full" style={{ background: BALL_COLOR[ball] }} />
        {label}
      </div>
      <div className="mt-1 text-[12.5px] font-bold" style={{ color: PARTY_COLOR[code] }}>
        {key ? t(key) : code || '—'}
      </div>
      {state?.text && <div className="mt-0.5 text-[11.5px] text-de9-gray">{state.text}</div>}
    </div>
  );
}

interface WorklistSummaryProps {
  detail: WorklistDetail;
  /** Refetch the row — devis arrive as prestataires answer, and nothing else polls. */
  onRefresh?: () => void;
  refreshing?: boolean;
}

export function WorklistSummary({ detail: d, onRefresh, refreshing = false }: WorklistSummaryProps) {
  const t = useT();
  const navigate = useNavigate();
  const runNext = useWorklistNextAction(d.id);
  const decide = useDevisDecision();
  const planifier = usePlanifierOccurrence(d.id);
  const affecter = useAffecterOuvrier(d.id);
  const deposer = useDeposerFacture(d.id);
  const choisir = useChoisirPrestataire(d.id);
  // Any of the three drives the same « form step » button.
  const stepPending = planifier.isPending || affecter.isPending || deposer.isPending || choisir.isPending;
  const [visitForm, setVisitForm] = useState<'reprogram' | 'assign' | 'deposit' | 'choose' | null>(null);
  const prestataireCompanyId = d.prestataire?.companyId ?? null;
  // The team loads when « Affecter un ouvrier » is opened, not with the page.
  const equipeQ = usePrestataireEquipe(prestataireCompanyId, visitForm === 'assign');
  const closeVisitForm = (open: boolean): void => {
    if (!open) setVisitForm(null);
  };
  const dash = '—';
  const badge = statusBadge(d.currentStatus.code);
  const ballColor = BALL_COLOR[d.ball];
  const kindKey = KIND_KEY[d.kind];
  const place = [d.wilaya, d.commune].filter(Boolean).join(' · ') || dash;
  const next = d.nextAction;
  const form = next?.form ?? null;
  const code = d.currentStatus.code;
  // An S5 commande waiting for its first occurrence (`form: planifier-occurrence`,
  // no visit yet) takes the same date form as a V0 visit.
  const visitStep = VISIT_FORM_STEP[code] ?? (form === 'planifier-occurrence' ? 'reprogram' : null);
  // S4 → V1: the server marks the rows the client may retain with `choosable`,
  // and every choosable row observed carries a devisId. With none of them the
  // step has nothing to act on, so it stays locked rather than posting a choice
  // the server would reject.
  const choosableQuotes: ChoosableQuote[] = (d.devis ?? [])
    .filter((dv) => dv.choosable && dv.devisId)
    .map((dv) => ({
      devisId: dv.devisId as string,
      raison: dv.raison,
      montantLabel: dv.montantCredits != null ? dv.montantCredits.toLocaleString('fr-FR') + ' ' + t('credits') : dash,
    }));
  const chooseStep = form === 'choisir-prestataire' && choosableQuotes.length > 0;
  const s4NothingChoosable = form === 'choisir-prestataire' && choosableQuotes.length === 0;
  const blockingForm = NEXT_ACTION_STEPS.has(code) || chooseStep ? null : form;
  /** Whose move it is while the step can't run from here. */
  const waitingOn =
    next?.actor === 'client'
      ? t('apercuAttenteClient')
      : next?.actor === 'pro'
        ? t('apercuAttentePrestataire')
        : t('apercuAttenteDe9');
  const stepHint = STEP_HINT[code];
  const overdue = d.slaOverdueMinutes != null && d.slaOverdueMinutes > 0;
  const devis = d.devis ?? [];
  const prochaineVisite = d.nextVisitAt ? visitLabel(d.nextVisitAt, t) : dash;
  const traite = d.traite ? (
    <>
      <Glyph icon={Check} />
      {d.traiteAt ? ' ' + visitLabel(d.traiteAt, t) : ''}
    </>
  ) : (
    dash
  );

  const decideDevis = (dv: WorklistDevis, decision: DevisDecision): void => {
    if (!dv.devisId) return;
    decide.mutate(
      { devisId: dv.devisId, decision },
      {
        onSuccess: () =>
          toast.success(
            t(decision === 'valider' ? 'apercuDevisValiderOk' : 'apercuDevisRefuserOk').replace('{n}', dv.raison),
          ),
        onError: (err) => toast.error(actionError(err, t)),
      },
    );
  };
  // « Proposer au client » — the S3 → S4 next action — sends the validated devis
  // to the client; `toPropose` counts the ones it would send.
  const toPropose = devis.filter((dv) => dv.statut === 'valide' && !dv.chosen).length;
  // Hint on what is actionable, not on « not attente »: a devis can be decided
  // only while it is 'recu' with an id, an invited one ('attente') is merely
  // awaited, and an all-refused appel d'offres has nothing left to validate —
  // telling the operator to validate one there points at buttons no row renders.
  const decidable = devis.some((dv) => dv.statut === 'recu' && dv.devisId);
  // An empty list is also « still waiting »: the backend expressed that state as
  // devis: [] before it started listing invitations, and the same payload says
  // parties.prestataire = action_required « Devis à envoyer ». Calling it a dead
  // end would advise relaunching the appel d'offres, which answers 409 from S3.
  const awaiting = devis.length === 0 || devis.some((dv) => dv.statut === 'attente');
  const proposeHint =
    toPropose > 0
      ? null
      : decidable
        ? t('apercuDevisRienAProposer')
        : awaiting
          ? t('apercuDevisAucunRecu')
          : t('apercuDevisAucunExploitable');
  // S3 with nothing validated: POST …/next-action answers 409 « Validez au moins
  // un devis », so the big Exécuter button must not invite that.
  const s3NothingToPropose = code === 'S3' && toPropose === 0;

  /** The devis + verdict in flight, to label only the clicked button « En cours… ». */
  const deciding = decide.isPending ? decide.variables : undefined;

  const executeNext = (): void => {
    if (!next || blockingForm) return;
    runNext.mutate(undefined, {
      onSuccess: (updated) => {
        toast.success(t('apercuActionOk').replace('{n}', next.action));
        // Follow the commande id the server returns when it differs from the one posted.
        if (updated.newId && updated.newId !== d.id) {
          navigate('/commandes/' + updated.newId, { replace: true });
        }
      },
      onError: (err) => toast.error(actionError(err, t)),
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className={CARD}>
        {/* identity + status */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-[19px] font-extrabold text-de9-ink">{d.clientName}</div>
            <div className="mt-1 text-[12px] text-de9-gray">
              {d.reference ?? d.id} · {d.contact ?? dash} · {d.clientPhone ?? dash}
            </div>
            {/* What the dossier below does not say: the kind of line, its next visit, whether it is handled. */}
            {d.client && (
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-de9-gray">
                <span className="rounded-full bg-secondary px-2 py-[2px] text-[10.5px] font-bold text-de9-slate">
                  {kindKey ? t(kindKey) : d.kind}
                </span>
                <span>
                  {t('apercuProchaineVisite')} : <b className="font-bold text-de9-ink">{prochaineVisite}</b>
                </span>
                <span>
                  {t('apercuTraite')} : <b className="font-bold text-de9-ink">{traite}</b>
                </span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-[11px] py-1.5 text-xs font-bold tone-chip"
              style={{ background: badge.bg, color: badge.fg }}
            >
              <span className="inline-flex min-w-[18px] flex-none items-center justify-center rounded-xs bg-inverse-surface px-[5px] py-[2px] text-[9.5px] font-extrabold leading-[1.4] tracking-[.02em] text-inverse-on-surface">
                {d.currentStatus.code}
              </span>
              {d.currentStatus.label}
            </span>
            <span className="inline-flex items-center gap-1.5 text-[11.5px] font-bold" style={{ color: ballColor }}>
              <span className="h-2 w-2 rounded-full" style={{ background: ballColor }} />
              {ballLabel(d.ball, t)}
            </span>
            {onRefresh && (
              <button
                type="button"
                onClick={onRefresh}
                disabled={refreshing}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-de9-line bg-card px-2.5 py-1.5 text-[11.5px] font-bold text-de9-slate disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span className={cn('text-[13px]', refreshing && 'animate-spin')} aria-hidden>
                  <Glyph icon={RefreshCw} />
                </span>
                {t('apercuRafraichir')}
              </button>
            )}
          </div>
        </div>

        {/* next action + SLA + execute */}
        {next && (
          <div className="mt-5 rounded-md bg-secondary px-4 py-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className={SECTION_LABEL}>{t('apercuProchaineAction')}</div>
              {next.to && (
                <span className="rounded-full bg-card px-2.5 py-1 text-[10.5px] font-extrabold text-de9-slate">
                  {code} → {next.to.code} {next.to.label}
                </span>
              )}
            </div>
            <div className="mt-1.5 text-[15px] font-extrabold text-de9-ink">{next.action}</div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {next.actor && (
                <span
                  className="inline-flex items-center gap-1.5 rounded-full bg-card px-2.5 py-1 text-[11px] font-bold"
                  style={{ color: BALL_COLOR[next.actor] }}
                >
                  <span className="h-[7px] w-[7px] rounded-full" style={{ background: BALL_COLOR[next.actor] }} />
                  {ballLabel(next.actor, t)}
                </span>
              )}
              {(overdue || d.slaDueAt) && (
                <span
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold',
                    overdue
                      ? 'bg-[#FDECEC] text-[#E7464E] dark:bg-[#E7464E]/15 dark:text-[#F2848A]'
                      : 'bg-card text-de9-slate',
                  )}
                >
                  <Glyph icon={Timer} />{' '}
                  {overdue
                    ? t('apercuEnRetard').replace('{n}', formatDuration(d.slaOverdueMinutes ?? 0, t))
                    : t('apercuEcheance').replace('{n}', d.slaDueAt ? visitLabel(d.slaDueAt, t) : '—')}
                </span>
              )}
            </div>
            {d.slaLabel && <div className="mt-1.5 text-[11.5px] font-semibold text-de9-gray">{d.slaLabel}</div>}
            <div className="mt-3 flex flex-wrap items-center gap-2.5">
              {form === 'demander-devis' ? (
                <>
                  {/* The brief is its own form: pick prestataires in the search on this
                      commande, then POST /appels-offres/demander-devis from the brief. */}
                  <button
                    type="button"
                    onClick={() => navigate('/prestataires?ctx=' + encodeURIComponent(d.id))}
                    className="cursor-pointer rounded-full bg-primary px-4 py-2.5 text-[12.5px] font-bold text-primary-foreground"
                  >
                    <Glyph icon={Search} /> {next.action}
                  </button>
                  <span className="text-[11.5px] font-semibold text-de9-gray">{t('apercuDemanderDevisHint')}</span>
                </>
              ) : visitStep ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      if (visitForm === 'assign') void equipeQ.refetch();
                      setVisitForm(visitStep);
                    }}
                    disabled={stepPending || (visitStep === 'assign' && !prestataireCompanyId)}
                    className="cursor-pointer rounded-full bg-primary px-4 py-2.5 text-[12.5px] font-bold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    {stepPending ? (
                      t('apercuActionEnCours')
                    ) : (
                      <>
                        <Glyph icon={Pencil} /> {next.action}
                      </>
                    )}
                  </button>
                  {visitStep === 'assign' && !prestataireCompanyId && (
                    <span className="text-[11.5px] font-semibold text-de9-gray">{t('visiteSansPrestataire')}</span>
                  )}
                  {visitForm === 'assign' &&
                    (equipeQ.isFetching ? (
                      <span className="text-[11.5px] font-semibold text-de9-gray">{t('apercuActionEnCours')}</span>
                    ) : equipeQ.isError ? (
                      <span className="text-[11.5px] font-semibold text-de9-red">{actionError(equipeQ.error, t)}</span>
                    ) : equipeQ.data?.length === 0 ? (
                      <span className="text-[11.5px] font-semibold text-de9-gray">{t('visiteEquipeVide')}</span>
                    ) : null)}
                </>
              ) : chooseStep ? (
                <>
                  <button
                    type="button"
                    onClick={() => setVisitForm('choose')}
                    disabled={stepPending}
                    className="cursor-pointer rounded-full bg-primary px-4 py-2.5 text-[12.5px] font-bold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    {stepPending ? (
                      t('apercuActionEnCours')
                    ) : (
                      <>
                        <Glyph icon={Play} filled /> {t('apercuExecuter')} · {next.action}
                      </>
                    )}
                  </button>
                  <span className="text-[11.5px] font-semibold text-de9-gray">{t('apercuChoisirInfo')}</span>
                </>
              ) : s4NothingChoosable ? (
                <span className="inline-flex items-center gap-2 rounded-sm bg-card px-3.5 py-2.5 text-[12px] font-bold text-de9-slate">
                  <Glyph icon={Lock} />
                  {t('apercuChoisirAucun')}
                </span>
              ) : s3NothingToPropose ? (
                <span className="inline-flex items-center gap-2 rounded-sm bg-card px-3.5 py-2.5 text-[12px] font-bold text-de9-slate">
                  <Glyph icon={Lock} />
                  {proposeHint}
                </span>
              ) : blockingForm ? (
                /* Not runnable from here — this step's form isn't integrated. Say who
                   it waits on and how to chase them (the number to dial, the e-mail);
                   the form key stays in the tooltip, for us rather than for the user. */
                <>
                  <span
                    title={t('apercuActionFormRequis').replace('{n}', blockingForm)}
                    className="inline-flex items-center gap-2 rounded-sm bg-card px-3.5 py-2.5 text-[12px] font-bold text-de9-slate"
                  >
                    <Glyph icon={Lock} />
                    {waitingOn}
                  </span>
                  {next.actor === 'client' && d.clientPhone && (
                    <PhoneNumber value={d.clientPhone} className="px-1 text-[12px] font-bold text-de9-ink" />
                  )}
                  {next.actor === 'client' && d.clientEmail && (
                    <a href={'mailto:' + d.clientEmail} className={CONTACT_LINK}>
                      <Glyph icon={Mail} /> Email
                    </a>
                  )}
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={executeNext}
                    disabled={runNext.isPending}
                    className="cursor-pointer rounded-full bg-primary px-4 py-2.5 text-[12.5px] font-bold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    {runNext.isPending ? (
                      t('apercuActionEnCours')
                    ) : (
                      <>
                        <Glyph icon={Play} filled /> {t('apercuExecuter')} · {next.action}
                      </>
                    )}
                  </button>
                  {stepHint && <span className="text-[11.5px] font-semibold text-de9-gray">{t(stepHint)}</span>}
                </>
              )}
            </div>
          </div>
        )}

        {/* each party's side */}
        {d.parties && (
          <div className="mt-5">
            <div className={cn(SECTION_LABEL, 'mb-2')}>{t('apercuParties')}</div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <PartyCard ball="client" label={t('roleClient')} state={d.parties.client} />
              <PartyCard ball="pro" label={t('rolePrestataire')} state={d.parties.prestataire} />
              <PartyCard ball="de9" label="de9de9" state={d.parties.de9de9} />
            </div>
          </div>
        )}

        {/* the dossier: who asked, who receives it, what was asked, every file — the flat
            fields below only for an answer without it (an older API) */}
        {d.client ? (
          <CommandeDossier detail={d} client={d.client} />
        ) : (
          <div className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4 md:grid-cols-3">
            <Field label={t('apercuType')} value={kindKey ? t(kindKey) : d.kind} />
            <Field label={t('apercuService')} value={d.service ?? dash} />
            <Field label={t('apercuCadence')} value={d.cadence ?? dash} />
            <Field label={t('apercuLieu')} value={place} />
            <Field label={t('fPrestataire')} value={d.prestataire?.name ?? dash} />
            <Field label={t('apercuProchaineVisite')} value={prochaineVisite} />
            <Field label={t('apercuEmail')} value={d.clientEmail ?? dash} />
            <Field label={t('apercuTraite')} value={traite} />
          </div>
        )}

        {/* devis */}
        {devis.length > 0 && (
          <div id={DEVIS_ANCHOR} className="mt-5 scroll-mt-24">
            <div className={cn(SECTION_LABEL, 'mb-2')}>
              {t('apercuDevis')} ({devis.length})
            </div>
            <div className="flex flex-col gap-2">
              {devis.map((dv) => {
                const key = DEVIS_KEY[dv.statut];
                return (
                  <div
                    key={dv.quoteIndex}
                    className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-de9-line px-3.5 py-2.5"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-bold text-de9-ink">{dv.raison}</div>
                      <div className="text-[11.5px] text-de9-gray">
                        {dv.phone ?? dash}
                        {dv.closureLabel ? ' · ' + dv.closureLabel : ''}
                      </div>
                    </div>
                    {dv.montantCredits != null ? (
                      <div className="text-[13px] font-extrabold text-de9-ink">
                        {fmtCredits(dv.montantCredits)}{' '}
                        <span className="text-[10px] font-semibold text-de9-gray">{t('credits')}</span>
                      </div>
                    ) : (
                      <div className="text-[11.5px] font-semibold text-de9-gray">{t('apercuDevisDemande')}</div>
                    )}
                    <span className="rounded-full bg-secondary px-2.5 py-1 text-[10.5px] font-bold text-de9-slate">
                      {key ? t(key) : dv.statut}
                    </span>
                    {dv.chosen && (
                      <span className="rounded-full bg-[#E7F6EE] px-2.5 py-1 text-[10.5px] font-extrabold text-[#2FA86A] dark:bg-[#2FA86A]/15 dark:text-[#6FCF97]">
                        <Glyph icon={Check} /> {t('apercuDevisChoisi')}
                      </span>
                    )}
                    {!dv.chosen && dv.choosable && (
                      <span className="rounded-full bg-[#EAF2FD] px-2.5 py-1 text-[10.5px] font-bold text-[#2F7FD0] dark:bg-[#2F7FD0]/15 dark:text-[#7EB5EC]">
                        {t('apercuDevisChoisissable')}
                      </span>
                    )}
                    {dv.statut === 'recu' && dv.devisId && (
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          onClick={() => decideDevis(dv, 'valider')}
                          disabled={decide.isPending}
                          className="cursor-pointer rounded-full bg-[#E7F6EE] px-2.5 py-1.5 text-[11px] font-bold text-[#2FA86A] disabled:cursor-not-allowed disabled:opacity-50 dark:bg-[#2FA86A]/15 dark:text-[#6FCF97]"
                        >
                          {deciding?.devisId === dv.devisId && deciding.decision === 'valider' ? (
                            t('apercuActionEnCours')
                          ) : (
                            <>
                              <Glyph icon={Check} /> {t('apercuDevisValider')}
                            </>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => decideDevis(dv, 'refuser')}
                          disabled={decide.isPending}
                          className="cursor-pointer rounded-full bg-[#FDECEC] px-2.5 py-1.5 text-[11px] font-bold text-[#E7464E] disabled:cursor-not-allowed disabled:opacity-50 dark:bg-[#E7464E]/15 dark:text-[#F2848A]"
                        >
                          {deciding?.devisId === dv.devisId && deciding.decision === 'refuser' ? (
                            t('apercuActionEnCours')
                          ) : (
                            <>
                              <Glyph icon={X} /> {t('apercuDevisRefuser')}
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-de9-line pt-4 text-[12px] font-semibold text-de9-gray">
          <span>{t('apercuLectureSeule')}</span>
          <span>
            {t('apercuOccurrencesN')} {(d.occurrences ?? []).length} · {t('apercuNotes')} {d.noteCount} ·{' '}
            {t('apercuJournalN')} {(d.journal ?? []).length}
          </span>
        </div>
      </div>

      {/* roadmap form steps — POST /commandes/{visitId}/actions */}
      {visitForm === 'reprogram' && (
        <ReprogramModal
          open
          onOpenChange={closeVisitForm}
          defaultDate={d.nextVisitAt ? d.nextVisitAt.slice(0, 10) : new Date().toISOString().slice(0, 10)}
          onSubmit={async (v) => {
            try {
              const updated = await planifier.mutateAsync({ date: v.date, time: v.time });
              toast.success(t('consoleToastOccPlanifiee'));
              setVisitForm(null);
              // S5 → V1 creates the visit: the commande now lives on that row — follow it.
              // On a V0 row the id does not change.
              const nextId = updated.newId ?? updated.id;
              if (nextId && nextId !== d.id) navigate('/commandes/' + nextId, { replace: true });
            } catch (err) {
              toast.error(actionError(err, t));
              const target = planifierRedirect(err);
              if (target) {
                setVisitForm(null);
                navigate(target, { replace: target !== '/commandes' });
              }
            }
          }}
        />
      )}
      {visitForm === 'assign' && equipeQ.data && equipeQ.data.length > 0 && (
        <AssignTeamModal
          open
          onOpenChange={closeVisitForm}
          members={equipeQ.data}
          pending={affecter.isPending}
          onConfirm={(members) =>
            affecter.mutate(
              members.map((m) => m.id),
              {
                onSuccess: () => {
                  toast.success(
                    t('consoleToastOuvrierAffecte').replace('{n}', members.map((m) => m.name).join(', ')),
                  );
                  setVisitForm(null);
                },
                onError: (err) => toast.error(actionError(err, t)),
              },
            )
          }
        />
      )}
      {visitForm === 'choose' && (
        <ChoosePrestataireModal
          open
          onOpenChange={closeVisitForm}
          quotes={choosableQuotes}
          pending={choisir.isPending}
          onConfirm={(q, when) =>
            choisir.mutate({ devisId: q.devisId, ...when }, {
              onSuccess: (updated) => {
                toast.success(t('apercuChoisirOk').replace('{n}', q.raison));
                setVisitForm(null);
                // Retaining a devis turns the appel d'offres into a visit under a
                // new id — follow it, or this page 404s on the next fetch.
                if (updated.newId && updated.newId !== d.id) {
                  navigate('/commandes/' + updated.newId, { replace: true });
                }
              },
              onError: (err) => toast.error(actionError(err, t)),
            })
          }
        />
      )}
      {visitForm === 'deposit' && (
        <DepositInvoiceModal
          open
          onOpenChange={closeVisitForm}
          pending={deposer.isPending}
          onConfirm={(values) =>
            deposer.mutate(values, {
              onSuccess: () => {
                toast.success(t('consoleToastFactureDeposee'));
                setVisitForm(null);
              },
              onError: (err) => toast.error(actionError(err, t)),
            })
          }
        />
      )}
    </div>
  );
}
