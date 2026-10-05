// One KYC piece on the review screen: the current file (inline preview), its
// typed number, the verdict so far, « Valider » / « Refuser » — or the
// server's `blocage.message` — and the replaced versions.
import { useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import {
  Check,
  ChevronRight,
  Copy,
  Download,
  FileText,
  Inbox,
  Info,
  Lock,
  Maximize2,
  Pencil,
  Upload,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { Glyph } from '@/components/common/Glyph';
import { cn } from '@/lib/utils';
import { useT } from '@/lib/i18n';
import {
  KYC_NUMBER_FIELD,
  useCorrectKycNumber,
  useKycUploadForCompany,
  type KycVerdict,
} from '../api/kyc';
import { KYC_FILE_MAX_BYTES, type KycRevuePiece, type KycVersion } from '../schemas/kyc';
import {
  docStatutLabel,
  docTone,
  fmtDateTime,
  fmtSize,
  kindLong,
  kindShort,
  kycErrorMessage,
  pieceVerdicts,
} from '../lib/kyc';
import { useDocPreview, useSaveDocument } from '../api/preview';
import { PreviewDialog, PreviewFrame } from './DocPreview';
import { SectionLabel, StatusPill } from './shared';

/** PDF or a photo — HEIC included, which `image/*` does not always cover. */
const ACCEPT = 'application/pdf,image/*,.heic,.heif';

const SMALL_BTN =
  'inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-de9-line bg-card px-3 py-[7px] text-[11.5px] font-bold text-de9-slate disabled:cursor-not-allowed disabled:opacity-50';

interface PieceCardProps {
  piece: KycRevuePiece;
  companyId: string;
  /** The round is open: a refusal's motif reaches the company only when it closes. */
  enRevue: boolean;
  onVerdict: (piece: KycRevuePiece, verdict: KycVerdict) => void;
}

export function PieceCard({ piece, companyId, enRevue, onVerdict }: PieceCardProps) {
  const t = useT();
  const tone = docTone(piece.statut);
  const short = kindShort(piece.kind, piece.labelCourt);
  const courante = piece.courante ?? null;
  const historique = piece.historique ?? [];

  const loaded = useDocPreview(courante?.documentId ?? null);
  const { save, saving } = useSaveDocument();
  const [enlarged, setEnlarged] = useState(false);
  const [viewing, setViewing] = useState<KycVersion | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);

  // ---- de9de9 files a new version for the company ----
  const upload = useKycUploadForCompany();
  const onFile = (e: ChangeEvent<HTMLInputElement>): void => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > KYC_FILE_MAX_BYTES) {
      toast.error(t('kycFichierTropGros'));
      return;
    }
    upload.mutate(
      { companyId, kind: piece.kind, file },
      {
        onSuccess: () => toast.success(t('kycToastDepose').replace('{n}', short)),
        onError: (err) => toast.error(kycErrorMessage(err, t)),
      },
    );
  };

  // ---- the typed number ----
  const correct = useCorrectKycNumber();
  const field = KYC_NUMBER_FIELD[piece.kind];
  const numeroLabel = piece.numeroLabel || `N° ${short}`;
  const [draft, setDraft] = useState<string | null>(null);
  const saveNumber = (e: FormEvent): void => {
    e.preventDefault();
    const value = (draft ?? '').trim();
    if (!field || !value) return;
    if (value === (piece.numero ?? '')) {
      setDraft(null);
      return;
    }
    correct.mutate(
      { companyId, field, value },
      {
        onSuccess: () => {
          toast.success(t('kycToastNumero').replace('{n}', numeroLabel));
          setDraft(null);
        },
        onError: (err) => toast.error(kycErrorMessage(err, t)),
      },
    );
  };
  const copyNumber = (): void => {
    if (!piece.numero) return;
    navigator.clipboard
      .writeText(piece.numero)
      .then(() => toast.success(t('kycCopie')))
      .catch(() => undefined);
  };

  const decided = piece.statut === 'valide' || piece.statut === 'refuse';
  // Which verdicts show, and which are live — lib/kyc.ts pieceVerdicts.
  const verdicts = pieceVerdicts(piece);
  // de9de9 may file for the company at any time, except over a validated
  // document (409 kyc_document_approved_locked — refuse it first).
  const canUpload = piece.statut !== 'valide';

  return (
    <section
      className={cn(
        'overflow-hidden rounded-md border border-s-4 border-de9-line bg-card',
        tone.edge,
      )}
    >
      {/* ---- head ---- */}
      <div className="flex flex-wrap items-center gap-2.5 border-b border-de9-line px-4 py-3.5 sm:px-5">
        <span className="rounded-md bg-inverse-surface px-2 py-1 text-[11px] font-extrabold tracking-[.04em] text-inverse-on-surface">
          {short}
        </span>
        <h2 className="min-w-0 flex-1 text-[14px] font-extrabold">{kindLong(piece.kind, piece.kindLabel, t)}</h2>
        <StatusPill tone={tone} label={docStatutLabel(piece.statut, piece.statutLabel, t)} />
      </div>

      <div className="grid gap-4 p-4 sm:p-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        {/* ---- preview ---- */}
        <div className="flex min-w-0 flex-col gap-2">
          <div className="h-[260px] overflow-hidden rounded-md border border-de9-line bg-secondary sm:h-[300px]">
            {courante ? (
              <PreviewFrame
                {...loaded}
                fileName={courante.fileName}
                contentType={courante.contentType}
                compact
              />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-1.5 p-4 text-center">
                <div className="text-[34px] text-de9-faint"><Glyph icon={Inbox} className="stroke-[1.5]" /></div>
                <div className="text-[12.5px] font-bold text-de9-slate">{t('kycPieceManquante')}</div>
              </div>
            )}
          </div>
          {courante && (
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setEnlarged(true)} className={SMALL_BTN}>
                <Glyph icon={Maximize2} /> {t('kycAgrandir')}
              </button>
              <button
                type="button"
                onClick={() => save(courante.documentId, courante.fileName)}
                disabled={saving === courante.documentId}
                className={SMALL_BTN}
              >
                <Glyph icon={Download} /> {saving === courante.documentId ? t('docTelechargementEnCours') : t('telecharger')}
              </button>
            </div>
          )}
        </div>

        {/* ---- details ---- */}
        <div className="flex min-w-0 flex-col gap-3">
          {/* number — validating the document validates it */}
          <div className="rounded-md bg-secondary px-4 py-3">
            <div className="flex items-center justify-between gap-2">
              <SectionLabel>{numeroLabel}</SectionLabel>
              {draft === null && field && (
                <button
                  type="button"
                  onClick={() => setDraft(piece.numero ?? '')}
                  className="cursor-pointer text-[11.5px] font-bold text-de9-teal-dark"
                >
                  <Glyph icon={Pencil} /> {piece.numero ? t('kycCorriger') : t('kycSaisir')}
                </button>
              )}
            </div>
            {draft === null ? (
              <div className="mt-1 flex items-center gap-2">
                {piece.numero ? (
                  <>
                    <span dir="ltr" className="break-all font-mono text-[16px] font-bold tracking-[.03em] text-de9-ink">
                      {piece.numero}
                    </span>
                    <button
                      type="button"
                      onClick={copyNumber}
                      title={t('kycCopier')}
                      aria-label={t('kycCopier')}
                      className="flex-none cursor-pointer rounded-full px-1 text-[13px] text-de9-gray hover:text-de9-slate"
                    >
                      <Glyph icon={Copy} />
                    </button>
                  </>
                ) : (
                  <span className="text-[13px] font-semibold text-de9-red">{t('kycNumeroVide')}</span>
                )}
              </div>
            ) : (
              <form onSubmit={saveNumber} className="mt-1.5">
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  dir="ltr"
                  autoFocus
                  aria-label={numeroLabel}
                  className="w-full rounded-xs border border-outline bg-card px-3 py-2 font-mono text-[14px] text-de9-ink outline-none focus:border-de9-teal"
                />
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <button
                    type="submit"
                    disabled={correct.isPending || !draft.trim()}
                    className="cursor-pointer rounded-full bg-primary px-3 py-[7px] text-[11.5px] font-bold text-primary-foreground disabled:opacity-50"
                  >
                    {correct.isPending ? t('kycEnvoi') : t('kycEnregistrer')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setDraft(null)}
                    className="cursor-pointer rounded-full bg-card px-3 py-[7px] text-[11.5px] font-bold text-de9-slate"
                  >
                    {t('annuler')}
                  </button>
                </div>
                <div className="mt-1.5 text-[11px] leading-[1.45] text-de9-gray">
                  {piece.statut === 'valide' ? t('kycNumeroValideWarn') + ' ' : ''}
                  {t('kycNumeroAide')}
                </div>
              </form>
            )}
          </div>

          {/* file */}
          {courante && (
            <div className="flex items-start gap-2.5">
              <span className="text-[16px]"><Glyph icon={FileText} /></span>
              <div className="min-w-0 text-[11px] leading-[1.5] text-de9-gray">
                <div className="truncate text-[12.5px] font-bold text-de9-ink" title={courante.fileName ?? undefined}>
                  {courante.fileName ?? '—'}
                </div>
                <div>
                  {[
                    courante.version != null ? t('kycVersion').replace('{n}', String(courante.version)) : null,
                    fmtSize(courante.sizeBytes, t),
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </div>
                {courante.deposeLe && (
                  <div>
                    {t('kycDeposeLe').replace('{n}', fmtDateTime(courante.deposeLe, t))}
                    {courante.deposeParNom ? ' · ' + t('kycPar').replace('{n}', courante.deposeParNom) : ''}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* the verdict so far */}
          {piece.statut === 'refuse' && courante?.motif && (
            <div className="rounded-md border border-[#F3C9CB] bg-[#FDECEC] px-3.5 py-2.5 dark:border-[#E7464E]/40 dark:bg-[#E7464E]/15">
              <div className="text-[10.5px] font-extrabold uppercase tracking-[.04em] text-de9-red">
                {enRevue ? t('kycMotifAEnvoyer') : t('kycMotifEnvoye')}
              </div>
              <div dir="auto" className="mt-1 text-[12.5px] leading-[1.5] text-de9-ink">
                {courante.motif}
              </div>
            </div>
          )}
          {courante?.noteInterne && (
            <div className="rounded-md bg-secondary px-3.5 py-2.5">
              <SectionLabel><Glyph icon={Lock} /> {t('kycNoteInterne')}</SectionLabel>
              <div dir="auto" className="mt-1 text-[12px] leading-[1.5] text-de9-slate">
                {courante.noteInterne}
              </div>
            </div>
          )}
          {decided && courante?.revueLe && (
            <div className="text-[11px] text-de9-gray">
              {t('kycDecideLe').replace('{n}', fmtDateTime(courante.revueLe, t))}
              {courante.revueParNom ? ' · ' + t('kycPar').replace('{n}', courante.revueParNom) : ''}
            </div>
          )}

          {/* actions — the server's flags. `blocage` is the server's reason, printed as it is. */}
          {piece.blocage && (
            <div className="mt-auto rounded-md border border-dashed border-de9-line px-3.5 py-2.5 text-[12px] font-semibold leading-[1.45] text-de9-slate">
              <Glyph icon={Info} /> <bdi>{verdicts.reason}</bdi>
            </div>
          )}
          {(verdicts.valider.show || verdicts.refuser.show) && courante && (
            <div className={cn('flex flex-wrap gap-2 pt-1', !piece.blocage && 'mt-auto')}>
              {verdicts.valider.show && (
                <button
                  type="button"
                  disabled={!verdicts.valider.enabled}
                  title={verdicts.valider.enabled ? undefined : verdicts.reason}
                  onClick={() => onVerdict(piece, 'valider')}
                  className="min-w-[120px] flex-1 cursor-pointer rounded-full bg-[#2FA86A] px-4 py-[11px] text-[13px] font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Glyph icon={Check} /> {t('kycValider')}
                </button>
              )}
              {verdicts.refuser.show && (
                <button
                  type="button"
                  disabled={!verdicts.refuser.enabled}
                  title={verdicts.refuser.enabled ? undefined : verdicts.reason}
                  onClick={() => onVerdict(piece, 'refuser')}
                  className={cn(
                    'cursor-pointer rounded-full border border-[#F3C9CB] bg-card px-4 py-[10px] text-[13px] font-bold text-de9-red disabled:cursor-not-allowed disabled:opacity-40 dark:border-[#E7464E]/40',
                    verdicts.valider.show ? 'min-w-[120px] flex-1' : '',
                  )}
                >
                  <Glyph icon={X} /> {t('kycRefuser')}
                </button>
              )}
            </div>
          )}

          {canUpload && (
            <label
              className={cn(
                SMALL_BTN,
                'self-start border-dashed',
                upload.isPending && 'pointer-events-none opacity-60',
              )}
            >
              <Glyph icon={Upload} /> {upload.isPending ? t('kycEnvoi') : courante ? t('kycRemplacerPour') : t('kycDeposerPour')}
              <input type="file" accept={ACCEPT} onChange={onFile} disabled={upload.isPending} className="hidden" />
            </label>
          )}
        </div>
      </div>

      {/* ---- replaced versions ---- */}
      {historique.length > 0 && (
        <div className="border-t border-de9-line">
          <button
            type="button"
            onClick={() => setHistoryOpen((o) => !o)}
            aria-expanded={historyOpen}
            className="flex w-full cursor-pointer items-center gap-1.5 px-4 py-3 text-start text-[12px] font-bold text-de9-slate sm:px-5"
          >
            <ChevronRight className={cn('size-4 transition-transform', historyOpen ? 'rotate-90' : 'rtl:rotate-180')} />
            {t('kycHistorique').replace('{n}', String(historique.length))}
          </button>
          {historyOpen && (
            <div className="flex flex-col gap-2 px-4 pb-4 sm:px-5">
              {historique.map((v) => (
                <VersionRow
                  key={v.documentId}
                  version={v}
                  onView={() => setViewing(v)}
                  onSave={() => save(v.documentId, v.fileName)}
                  saving={saving === v.documentId}
                />
              ))}
              {piece.historiqueTronque && (
                <div className="text-[11px] text-de9-gray">{t('kycHistoriqueTronque')}</div>
              )}
            </div>
          )}
        </div>
      )}

      {courante && (
        <PreviewDialog
          open={enlarged}
          onOpenChange={setEnlarged}
          title={`${short} · ${t('kycVersion').replace('{n}', String(courante.version ?? '—'))}`}
          documentId={courante.documentId}
          fileName={courante.fileName}
          contentType={courante.contentType}
          loaded={loaded}
        />
      )}
      {viewing && (
        <PreviewDialog
          open
          onOpenChange={(open) => {
            if (!open) setViewing(null);
          }}
          title={`${short} · ${t('kycVersion').replace('{n}', String(viewing.version ?? '—'))}`}
          documentId={viewing.documentId}
          fileName={viewing.fileName}
          contentType={viewing.contentType}
        />
      )}
    </section>
  );
}

function VersionRow({
  version,
  onView,
  onSave,
  saving,
}: {
  version: KycVersion;
  onView: () => void;
  onSave: () => void;
  saving: boolean;
}) {
  const t = useT();
  return (
    <div className="rounded-md border border-de9-line px-3.5 py-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-sm bg-secondary px-1.5 py-0.5 text-[10.5px] font-extrabold text-de9-slate">
          v{version.version ?? '—'}
        </span>
        <span className="min-w-0 flex-1 truncate text-[12px] font-bold text-de9-ink" title={version.fileName ?? undefined}>
          {version.fileName ?? '—'}
        </span>
        <StatusPill
          tone={docTone(version.statut)}
          label={docStatutLabel(version.statut, version.statutLabel, t)}
          className="px-2 py-[3px] text-[10.5px]"
        />
        <button type="button" onClick={onView} className="cursor-pointer text-[11.5px] font-bold text-de9-teal-dark">
          {t('voir')}
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          aria-label={t('telecharger')}
          title={t('telecharger')}
          className="cursor-pointer text-[12px] font-bold text-de9-slate disabled:opacity-50"
        >
          <Glyph icon={Download} />
        </button>
      </div>
      <div className="mt-1 text-[11px] leading-[1.5] text-de9-gray">
        {[
          version.deposeLe
            ? t('kycDeposeLe').replace('{n}', fmtDateTime(version.deposeLe, t)) +
              (version.deposeParNom ? ' · ' + t('kycPar').replace('{n}', version.deposeParNom) : '')
            : null,
          version.remplaceLe ? t('kycRemplaceeLe').replace('{n}', fmtDateTime(version.remplaceLe, t)) : null,
        ]
          .filter(Boolean)
          .join(' — ')}
      </div>
      {version.motif && (
        <div className="mt-1.5 text-[11.5px] leading-[1.45] text-de9-red">
          {t('kycMotifEnvoye')} : <bdi>{version.motif}</bdi>
        </div>
      )}
      {version.noteInterne && (
        <div className="mt-1 text-[11.5px] leading-[1.45] text-de9-slate">
          <Glyph icon={Lock} /> <bdi>{version.noteInterne}</bdi>
        </div>
      )}
      {version.revueLe && (
        <div className="mt-1 text-[11px] text-de9-gray">
          {t('kycDecideLe').replace('{n}', fmtDateTime(version.revueLe, t))}
          {version.revueParNom ? ' · ' + t('kycPar').replace('{n}', version.revueParNom) : ''}
        </div>
      )}
    </div>
  );
}
