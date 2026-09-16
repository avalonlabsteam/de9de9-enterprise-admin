// COMMANDES — console view for a live worklist row, driven by
// GET /commandes/worklist/{id}. The editable console needs the mock commande
// payload, which a live commande id (an appel d'offres or a visit) doesn't have. So
// the page renders what the worklist detail knows — status, each party's side,
// the next action and its SLA, the devis — and can run that next action through
// POST …/next-action when it needs no form (the endpoint takes no body), and
// validate or refuse each received devis (POST /devis/{devisId}/valider | /refuser),
// then propose the validated ones to the client (POST /appels-offres/{rfqId}/devis/proposer).
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useT, type TKey } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { problemMessage } from '@/api/problem';
import {
  useAffecterOuvrier,
  useDeposerFacture,
  useDevisDecision,
  usePlanifierOccurrence,
  usePrestataireEquipe,
  useProposerDevis,
  useWorklistNextAction,
  type DevisDecision,
} from '../../api/commandes';
import type { Ball } from '../../schemas/commande';
import type { WorklistDetail, WorklistDevis, WorklistPartyState } from '../../schemas/worklistDetail';
import { BALL_COLOR, ballLabel, formatDuration, statusBadge, visitLabel, type Tr } from '../../lib/worklistDisplay';
import { ReprogramModal } from './ActionModals';
import { AssignTeamModal } from './AssignTeamModal';
import { DepositInvoiceModal } from './DepositInvoiceModal';

const CARD =
  'rounded-[20px] border border-de9-line bg-card px-6 py-[22px] shadow-[0_10px_30px_rgba(38,50,69,.06)]';

const SECTION_LABEL = 'text-[11px] font-bold uppercase tracking-[.04em] text-de9-gray';

const CONTACT_LINK =
  'rounded-[11px] border-[1.5px] border-de9-line bg-card px-3.5 py-2.5 text-[12px] font-bold text-de9-slate no-underline';

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

interface FieldProps {
  label: string;
  value: string;
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
    <div className="rounded-xl border border-de9-line px-3 py-2.5">
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
  const propose = useProposerDevis(d.id);
  const planifier = usePlanifierOccurrence(d.id);
  const affecter = useAffecterOuvrier(d.id);
  const deposer = useDeposerFacture(d.id);
  // Any of the three drives the same « form step » button.
  const stepPending = planifier.isPending || affecter.isPending || deposer.isPending;
  const [visitForm, setVisitForm] = useState<'reprogram' | 'assign' | 'deposit' | null>(null);
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
  const visitStep = VISIT_FORM_STEP[code] ?? null;
  const blockingForm = NEXT_ACTION_STEPS.has(code) ? null : form;
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
  // « Proposer au client » sends the validated devis to the client: the S3 → S4
  // step, so it only shows at S3, and is clickable once a devis is validated.
  // `toPropose` counts the validated devis it will send.
  const canPropose = d.currentStatus.code === 'S3' && devis.length > 0;
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

  const proposeDevis = (): void => {
    propose.mutate(undefined, {
      onSuccess: () => toast.success(t('apercuDevisProposerOk')),
      onError: (err) => toast.error(actionError(err, t)),
    });
  };

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
      <div className="flex items-center gap-2.5 rounded-[13px] border-[1.5px] border-[#F0DCA8] bg-[#FBF4E4] px-4.5 py-3 dark:border-[#B68A2E]/40 dark:bg-[#B68A2E]/15">
        <span className="text-lg">⚠</span>
        <div>
          <div className="text-[13.5px] font-extrabold text-de9-slate">{t('apercuTitre')}</div>
          <div className="mt-0.5 text-[12.5px] font-semibold text-de9-slate">{t('apercuTexte')}</div>
        </div>
      </div>

      <div className={CARD}>
        {/* identity + status */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-[19px] font-extrabold text-de9-ink">{d.clientName}</div>
            <div className="mt-1 text-[12px] text-de9-gray">
              {d.reference ?? d.id} · {d.contact ?? dash} · {d.clientPhone ?? dash}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-[11px] py-1.5 text-xs font-bold"
              style={{ background: badge.bg, color: badge.fg }}
            >
              <span className="inline-flex min-w-[18px] flex-none items-center justify-center rounded-md bg-[#232838] px-[5px] py-[2px] text-[9.5px] font-extrabold leading-[1.4] tracking-[.02em] text-white">
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
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-[10px] border-[1.5px] border-de9-line bg-card px-2.5 py-1.5 text-[11.5px] font-bold text-de9-slate disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span className={cn('text-[13px]', refreshing && 'animate-spin')} aria-hidden>
                  ⟳
                </span>
                {t('apercuRafraichir')}
              </button>
            )}
          </div>
        </div>

        {/* next action + SLA + execute */}
        {next && (
          <div className="mt-5 rounded-[14px] bg-secondary px-4 py-3.5">
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
                  ⏱{' '}
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
                    className="cursor-pointer rounded-[11px] bg-de9-ink px-4 py-2.5 text-[12.5px] font-bold text-white dark:text-[#151923]"
                  >
                    🔎 {next.action}
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
                    className="cursor-pointer rounded-[11px] bg-de9-ink px-4 py-2.5 text-[12.5px] font-bold text-white disabled:cursor-not-allowed disabled:opacity-45 dark:text-[#151923]"
                  >
                    {stepPending ? t('apercuActionEnCours') : '✎ ' + next.action}
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
              ) : s3NothingToPropose ? (
                <span className="inline-flex items-center gap-2 rounded-[11px] bg-card px-3.5 py-2.5 text-[12px] font-bold text-de9-slate">
                  <span aria-hidden>🔒</span>
                  {proposeHint}
                </span>
              ) : blockingForm ? (
                /* Not runnable from here — this step's form isn't integrated. Say who
                   it waits on and offer the ways to chase them; the form key stays in
                   the tooltip, for us rather than for the user. */
                <>
                  <span
                    title={t('apercuActionFormRequis').replace('{n}', blockingForm)}
                    className="inline-flex items-center gap-2 rounded-[11px] bg-card px-3.5 py-2.5 text-[12px] font-bold text-de9-slate"
                  >
                    <span aria-hidden>🔒</span>
                    {waitingOn}
                  </span>
                  {next.actor === 'client' && d.clientPhone && (
                    <a href={'tel:' + d.clientPhone.replace(/\s/g, '')} className={CONTACT_LINK}>
                      📞 {t('apercuAppeler')}
                    </a>
                  )}
                  {next.actor === 'client' && d.clientEmail && (
                    <a href={'mailto:' + d.clientEmail} className={CONTACT_LINK}>
                      ✉️ Email
                    </a>
                  )}
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={executeNext}
                    disabled={runNext.isPending}
                    className="cursor-pointer rounded-[11px] bg-de9-ink px-4 py-2.5 text-[12.5px] font-bold text-white disabled:cursor-not-allowed disabled:opacity-45 dark:text-[#151923]"
                  >
                    {runNext.isPending ? t('apercuActionEnCours') : '▶ ' + t('apercuExecuter') + ' · ' + next.action}
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

        <div className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4 md:grid-cols-3">
          <Field label={t('apercuType')} value={kindKey ? t(kindKey) : d.kind} />
          <Field label={t('apercuService')} value={d.service ?? dash} />
          <Field label={t('apercuCadence')} value={d.cadence ?? dash} />
          <Field label={t('apercuLieu')} value={place} />
          <Field label={t('fPrestataire')} value={d.prestataire?.name ?? dash} />
          <Field label={t('apercuProchaineVisite')} value={d.nextVisitAt ? visitLabel(d.nextVisitAt, t) : dash} />
          <Field label={t('apercuEmail')} value={d.clientEmail ?? dash} />
          <Field
            label={t('apercuTraite')}
            value={d.traite ? '✓' + (d.traiteAt ? ' ' + visitLabel(d.traiteAt, t) : '') : dash}
          />
        </div>

        {/* devis */}
        {devis.length > 0 && (
          <div className="mt-5">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div className={SECTION_LABEL}>
                {t('apercuDevis')} ({devis.length})
              </div>
              {canPropose && (
                <div className="flex flex-wrap items-center gap-2">
                  {proposeHint && <span className="text-[11px] font-semibold text-de9-gray">{proposeHint}</span>}
                  <button
                    type="button"
                    onClick={proposeDevis}
                    disabled={toPropose === 0 || propose.isPending}
                    className="cursor-pointer rounded-[10px] bg-de9-ink px-3 py-1.5 text-[11.5px] font-bold text-white disabled:cursor-not-allowed disabled:opacity-45 dark:text-[#151923]"
                  >
                    {propose.isPending
                      ? t('apercuActionEnCours')
                      : '➜ ' + t('apercuDevisProposer') + (toPropose > 0 ? ` (${toPropose})` : '')}
                  </button>
                </div>
              )}
            </div>
            <div className="flex flex-col gap-2">
              {devis.map((dv) => {
                const key = DEVIS_KEY[dv.statut];
                return (
                  <div
                    key={dv.quoteIndex}
                    className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-de9-line px-3.5 py-2.5"
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
                        ✓ {t('apercuDevisChoisi')}
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
                          className="cursor-pointer rounded-[9px] bg-[#E7F6EE] px-2.5 py-1.5 text-[11px] font-bold text-[#2FA86A] disabled:cursor-not-allowed disabled:opacity-50 dark:bg-[#2FA86A]/15 dark:text-[#6FCF97]"
                        >
                          {deciding?.devisId === dv.devisId && deciding.decision === 'valider'
                            ? t('apercuActionEnCours')
                            : '✓ ' + t('apercuDevisValider')}
                        </button>
                        <button
                          type="button"
                          onClick={() => decideDevis(dv, 'refuser')}
                          disabled={decide.isPending}
                          className="cursor-pointer rounded-[9px] bg-[#FDECEC] px-2.5 py-1.5 text-[11px] font-bold text-[#E7464E] disabled:cursor-not-allowed disabled:opacity-50 dark:bg-[#E7464E]/15 dark:text-[#F2848A]"
                        >
                          {deciding?.devisId === dv.devisId && deciding.decision === 'refuser'
                            ? t('apercuActionEnCours')
                            : '✕ ' + t('apercuDevisRefuser')}
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
              await planifier.mutateAsync({ date: v.date, time: v.time });
              toast.success(t('consoleToastOccPlanifiee'));
              setVisitForm(null);
            } catch (err) {
              toast.error(actionError(err, t));
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
