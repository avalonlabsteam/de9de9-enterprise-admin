// One online payment — GET /comptabilite/paiements/{id} (guide 18 §5). Who paid
// and the company's legal identity are frozen at payment time; the bank block
// prints every GuiddiniPay / SATIM value as stored. The buttons are exactly the
// `actions` the answer lists, never worked out here.
import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowRight, Copy, Landmark, ReceiptText, TriangleAlert } from 'lucide-react';
import { useT } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { problemMessage } from '@/api/problem';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Glyph } from '@/components/common/Glyph';
import { fetchRecuBanque, rel, reloadPaiement, useComptaPaiement, usePaiementAction } from '../api/comptabilite';
import { comptaProblem, fmtAlger, isOrphanFlag, roleLabel, tonBadge } from '../lib/comptabilite';
import type { PaiementAction, PaiementDetail } from '../schemas/paiement';
import { RevueDialog } from './RevueDialog';
import { PdfPreviewDialog, type PdfPreview } from './PdfPreviewDialog';

const MONO = 'font-mono text-[12px]';

function Section({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <div className="mt-5 border-t border-de9-line pt-4">
      <div className="mb-2.5 flex flex-wrap items-baseline gap-x-2">
        <div className="text-[11px] font-extrabold tracking-[.04em] text-de9-gray uppercase">{title}</div>
        {note && <div className="text-[11px] text-de9-gray">· {note}</div>}
      </div>
      <div className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">{children}</div>
    </div>
  );
}

/** One label/value pair — nothing at all when the value is missing. */
function Field({ label, value, mono, wide }: { label: string; value: ReactNode; mono?: boolean; wide?: boolean }) {
  if (value === null || value === undefined || value === '') return null;
  return (
    <div className={cn('min-w-0', wide && 'sm:col-span-2')}>
      <div className="text-[11px] text-de9-gray">{label}</div>
      <div className={cn('text-[13px] font-semibold break-words text-de9-ink', mono && MONO)}>{value}</div>
    </div>
  );
}

export function PaiementDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const t = useT();
  const q = useComptaPaiement(id);
  const d = q.data;

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        showCloseButton={false}
        aria-describedby={undefined}
        className="block max-h-[90vh] max-w-[calc(100%-2rem)] gap-0 overflow-y-auto rounded-xl bg-card p-7 sm:max-w-[640px]"
      >
        <DialogTitle className="text-[19px] leading-normal font-extrabold text-de9-ink">{t('comptaDetailTitre')}</DialogTitle>
        {q.isPending && <div className="mt-4 h-64 animate-pulse rounded-md bg-secondary" />}
        {q.isError && (
          <div className="mt-4 rounded-md border border-[#F3C9CB] bg-[#FDECEC] px-4 py-3 text-[12.5px] font-semibold text-de9-red dark:border-[#E7464E]/40 dark:bg-[#E7464E]/15">
            {problemMessage(q.error)}
          </div>
        )}
        {d && <DetailBody d={d} />}
        <button
          type="button"
          onClick={onClose}
          className="mt-6 w-full cursor-pointer rounded-full bg-primary p-3.5 text-center text-sm font-bold text-primary-foreground"
        >
          {t('btnClose')}
        </button>
      </DialogContent>
    </Dialog>
  );
}

function DetailBody({ d }: { d: PaiementDetail }) {
  const t = useT();
  const navigate = useNavigate();
  const run = usePaiementAction();
  const [revue, setRevue] = useState<PaiementAction | null>(null);
  const [pdf, setPdf] = useState<PdfPreview | null>(null);
  const [openingBanque, setOpeningBanque] = useState(false);

  const e = d.entreprise;
  const p = d.payeur;
  const g = d.passerelle;
  const c = d.chronologie;
  const actions = d.actions ?? [];

  const onAction = (action: PaiementAction): void => {
    if (action.motifRequis || action.code.startsWith('revue_')) {
      setRevue(action);
      return;
    }
    run.mutate(
      { id: d.id, action },
      {
        onSuccess: (fresh) => {
          if (fresh.verificationEnCours) toast.warning(t('comptaBanqueSansReponse'));
          else toast.success(t('comptaVerifie'));
        },
        onError: (err) => {
          toast.error(problemMessage(err));
          const status = comptaProblem(err).status;
          if (status === 404 || status === 409) reloadPaiement(d.id);
        },
      },
    );
  };

  const onRecuBanque = (href: string): void => {
    // Open the tab inside the click: one opened after the request is a blocked popup.
    const tab = window.open('about:blank', '_blank');
    if (tab) tab.opener = null;
    setOpeningBanque(true);
    fetchRecuBanque(href)
      .then((url) => {
        if (tab) tab.location.href = url;
        else window.open(url, '_blank', 'noopener');
      })
      .catch((err: unknown) => {
        tab?.close();
        toast.error(problemMessage(err));
      })
      .finally(() => setOpeningBanque(false));
  };

  const copyFormUrl = (url: string): void => {
    navigator.clipboard
      .writeText(url)
      .then(() => toast.success(t('comptaLienCopie')))
      .catch(() => toast.error(url));
  };

  const adresse = [e?.adresse, e?.commune, e?.wilaya].filter(Boolean).join(', ');
  const conditions =
    p?.conditionsVersion &&
    t('comptaConditions')
      .replace('{v}', p.conditionsVersion)
      .replace('{d}', fmtAlger(p.conditionsAccepteesAt) ?? '—');
  // In time order: an expiry or the next check can fall before or after the other steps.
  const timeline: ReadonlyArray<[string, string | null | undefined]> = [
    [t('comptaChCree'), c?.creeLe],
    [t('comptaChDerniereVerif').replace('{n}', String(c?.nbVerifications ?? 0)), c?.derniereVerification],
    [t('comptaChProchaine'), c?.prochaineVerification],
    [t('comptaChExpire'), c?.expireLe],
    [t('comptaChFinalise'), c?.finaliseLe],
    [t('comptaChPaye'), c?.payeLe],
    [t('comptaChCredite'), c?.crediteLe],
  ];
  const steps = timeline
    .flatMap(([label, iso]) => (iso ? [{ label, iso, at: Date.parse(iso) }] : []))
    .sort((x, y) => (Number.isNaN(x.at) || Number.isNaN(y.at) ? 0 : x.at - y.at))
    .map(({ label, iso }) => [label, fmtAlger(iso)] as const);
  const btn =
    'cursor-pointer rounded-full border border-de9-line bg-card px-3.5 py-2.5 text-[12.5px] font-bold text-de9-slate hover:bg-de9-row disabled:cursor-not-allowed disabled:opacity-50';

  return (
    <>
      {/* ===== header ===== */}
      <div className="mt-3 flex flex-wrap items-center gap-2.5">
        <span className="font-mono text-[13px] font-bold text-de9-ink">{d.reference}</span>
        <span className={cn('rounded-full px-2.5 py-1 text-[11px] font-bold', tonBadge(d.ton))}>
          {d.statutLabel ?? d.statut}
        </span>
      </div>
      <div className="mt-2 text-[24px] leading-tight font-extrabold text-de9-ink">
        <span className="num">{d.montantLabel ?? '—'}</span>
      </div>
      {d.creditsLabel && (
        <div className="text-[12.5px] font-semibold text-de9-gray">
          <span className="num">{d.creditsLabel}</span>
        </div>
      )}
      {d.drapeauLabel && (
        <div
          className={cn(
            'mt-3 rounded-md px-3.5 py-2.5 text-[12.5px] font-semibold',
            isOrphanFlag(d.drapeau)
              ? 'bg-[#FDECEC] text-de9-red dark:bg-[#E7464E]/15'
              : 'bg-[#FBF4E4] text-[#92702A] dark:bg-[#B68A2E]/15 dark:text-[#D9B36A]',
          )}
        >
          <Glyph icon={TriangleAlert} /> <span dir="auto">{d.drapeauLabel}</span>
        </div>
      )}

      {/* ===== the company, as it was when paying ===== */}
      {e && (
        <Section title={t('comptaSecEntreprise')} note={t('comptaFige')}>
          <Field label={t('comptaRaisonSociale')} value={e.raisonSociale} />
          <Field label={t('comptaNomCommercial')} value={e.nomCommercial} />
          <Field label="NIF" value={e.nif} mono />
          <Field label="NIS" value={e.nis} mono />
          <Field label="RC" value={e.rc} mono />
          <Field label={t('comptaArticle')} value={e.articleImposition} mono />
          <Field label={t('comptaAdresse')} value={adresse} wide />
        </Section>
      )}

      {/* ===== who pressed « Payer » ===== */}
      {p && (
        <Section title={t('comptaPayePar')} note={t('comptaFige')}>
          <Field label={t('comptaNom')} value={p.nom} />
          <Field label={t('entEmail')} value={p.email} />
          <Field label={t('entTelephone')} value={p.telephone && <span dir="ltr">{p.telephone}</span>} />
          <Field label={t('comptaRole')} value={roleLabel(p.role, t)} />
          <Field label={t('comptaIp')} value={p.ip} mono />
          <Field label={t('comptaConditionsLabel')} value={conditions} wide />
        </Section>
      )}

      {/* ===== the bank's proof ===== */}
      {g && (
        <Section title={t('comptaSecBanque')}>
          <Field label={t('comptaOrderNumber')} value={g.orderNumber} mono />
          <Field label={t('comptaOrderId')} value={g.orderId} mono />
          <Field label={t('comptaNumAutorisation')} value={g.approvalCode} mono />
          <Field label={t('comptaCarte')} value={g.panMasque} mono />
          <Field label={t('comptaGStatus')} value={g.status} mono />
          <Field label={t('comptaGConfirmation')} value={g.confirmationStatus} mono />
          <Field
            label={t('comptaGActionCode')}
            value={
              g.actionCode != null
                ? `${g.actionCode}${g.actionCodeDescription ? ' · ' + g.actionCodeDescription : ''}`
                : null
            }
            mono
          />
          <Field
            label={t('comptaGErrorCode')}
            value={g.errorCode != null ? `${g.errorCode}${g.errorMessage ? ' · ' + g.errorMessage : ''}` : null}
            mono
          />
          <Field label={t('comptaGAmount')} value={g.amount} mono />
          <Field label={t('comptaGDeposit')} value={g.depositAmount} mono />
          <Field label="license_env" value={g.licenseEnv} mono />
          <Field label={t('comptaIp')} value={g.ip} mono />
          <Field label="SVFE" value={g.svfeResponse} mono />
          <Field label={t('comptaGMaj')} value={fmtAlger(g.updatedAt)} />
          {g.formUrl && (
            <div className="sm:col-span-2">
              <div className="text-[11px] text-de9-gray">{t('comptaGFormUrl')}</div>
              {/* Copied, never opened: it is the payer's card page. */}
              <button
                type="button"
                onClick={() => copyFormUrl(g.formUrl ?? '')}
                className="mt-0.5 cursor-pointer rounded-full border border-de9-line px-2.5 py-1 text-[12px] font-bold text-de9-slate hover:bg-de9-row"
              >
                <Glyph icon={Copy} /> {t('comptaCopierLien')}
              </button>
            </div>
          )}
        </Section>
      )}

      {/* ===== timeline ===== */}
      {(steps.length > 0 || c?.derniereErreur) && (
        <div className="mt-5 border-t border-de9-line pt-4">
          <div className="mb-2.5 text-[11px] font-extrabold tracking-[.04em] text-de9-gray uppercase">
            {t('comptaSecChrono')}
          </div>
          <ol className="relative ms-1.5 border-s-2 border-de9-line">
            {steps.map(([label, at]) => (
              <li key={label} className="relative ps-4 pb-2.5 last:pb-0">
                <span className="absolute -start-[6px] top-[5px] size-2.5 rounded-full border-2 border-card bg-de9-teal" />
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-[12.5px]">
                  <span className="font-semibold text-de9-slate">{label}</span>
                  <span className="text-de9-gray">{at}</span>
                </div>
              </li>
            ))}
          </ol>
          {c?.derniereErreur && (
            <div className="mt-2 text-[12.5px] font-semibold text-de9-red">
              {t('comptaChErreur')} : <span className={MONO}>{c.derniereErreur}</span>
            </div>
          )}
        </div>
      )}

      {/* ===== review ===== */}
      {d.revue && (d.revue.motifLabel || d.revue.commentaire || d.revue.le) && (
        <Section title={t('comptaSecRevue')}>
          <Field label={t('comptaRevueMotif')} value={d.revue.motifLabel ?? d.revue.motif} wide />
          <Field label={t('comptaRevueCommentaire')} value={d.revue.commentaire} wide />
          <Field label={t('comptaRevueLe')} value={fmtAlger(d.revue.le)} />
        </Section>
      )}

      {/* ===== buttons: the answer's actions, then the receipts ===== */}
      {(actions.length > 0 || d.revue?.creditImpossible || d.recuHref || d.recuBanqueHref || d.mouvementId) && (
        <div className="mt-5 flex flex-col gap-2.5 border-t border-de9-line pt-4">
          {actions.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {actions.map((a) => (
                <button
                  key={a.code}
                  type="button"
                  onClick={() => onAction(a)}
                  disabled={run.isPending}
                  className={cn(
                    btn,
                    a.code === 'revue_crediter' &&
                      'border-de9-teal-dark bg-primary text-primary-foreground hover:bg-de9-teal-dark',
                    a.code === 'revue_rejeter' && 'border-[#F3C9CB] text-de9-red dark:border-[#E7464E]/40',
                  )}
                >
                  {a.code === 'reverifier' && run.isPending ? t('comptaEnCours') : a.label}
                </button>
              ))}
            </div>
          )}
          {d.revue?.creditImpossible && (
            <div
              dir="auto"
              className="rounded-md border border-[#F0E2C0] bg-[#FBF4E4] px-3.5 py-2.5 text-[12.5px] font-semibold text-[#92702A] ltr:text-left rtl:text-right dark:border-[#B68A2E]/40 dark:bg-[#B68A2E]/15 dark:text-[#D9B36A]"
            >
              {d.revue.creditImpossible}
            </div>
          )}
          {(d.recuHref || d.recuBanqueHref || d.mouvementId) && (
            <div className="flex flex-wrap gap-2">
              {d.recuHref && (
                <button
                  type="button"
                  onClick={() =>
                    setPdf({
                      title: `${t('comptaRecuPdf')} · ${d.reference}`,
                      url: rel(d.recuHref ?? ''),
                      fileName: `recu-${d.reference}.pdf`,
                    })
                  }
                  className={btn}
                >
                  <Glyph icon={ReceiptText} /> {t('comptaRecuPdf')}
                </button>
              )}
              {d.recuBanqueHref && (
                <button
                  type="button"
                  onClick={() => onRecuBanque(d.recuBanqueHref ?? '')}
                  disabled={openingBanque}
                  className={btn}
                >
                  <Glyph icon={Landmark} /> {openingBanque ? t('comptaEnCours') : t('comptaRecuBanque')}
                </button>
              )}
              {d.mouvementId && (
                <button
                  type="button"
                  onClick={() => navigate(`/credits?mouvement=${encodeURIComponent(d.mouvementId ?? '')}`)}
                  className="cursor-pointer px-1 text-[12.5px] font-bold text-[#2F7FD0] dark:text-[#7EB5EC]"
                >
                  {t('comptaVoirMouvement')} <Glyph icon={ArrowRight} className="rtl:rotate-180" />
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {revue && <RevueDialog detail={d} action={revue} onClose={() => setRevue(null)} />}
      {pdf && <PdfPreviewDialog preview={pdf} onClose={() => setPdf(null)} />}
    </>
  );
}
