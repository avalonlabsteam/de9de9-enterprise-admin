// The KYC dossier inside a fiche (prestataire or client): the review of
// /kyc/{companyId} in compact form — GET /companies/{companyId}/kyc/revue.
// Each piece shows its real state and is validated or refused on its own, from
// the server's flags; the dossier has no decision of its own and turns
// « Vérifié » / « À corriger » by itself. What does not fit a fiche — the
// replaced versions, filing for the company, correcting a number, the history
// — is one link away on the full review screen.
import { useState } from 'react';
import { ArrowRight, Check, FileText, Info, Lock, RefreshCw, Repeat, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useT } from '@/lib/i18n';
import { Glyph } from '@/components/common/Glyph';
import { useKycRevue, type KycVerdict } from '../api/kyc';
import type { KycRevuePiece } from '../schemas/kyc';
import {
  TONES,
  docStatutLabel,
  docTone,
  dossierStatutLabel,
  dossierToneName,
  fmtDateTime,
  fmtSize,
  kindLong,
  kindShort,
  kycErrorMessage,
  kycProblem,
  pieceVerdicts,
} from '../lib/kyc';
import { PreviewDialog } from './DocPreview';
import { VerdictDialog, type VerdictTarget } from './VerdictDialog';
import { ProgressBar, SectionLabel, StatusPill, Tag } from './shared';

/** The fiches are overlays themselves (z-92): the panel's dialogs open above them. */
const ABOVE_FICHE = 'z-[98]';

const LINK = 'cursor-pointer text-[12.5px] font-bold text-de9-teal-dark hover:underline';

interface KycDossierPanelProps {
  companyId: string;
  /** Leave the fiche for the full review screen of this company. */
  onOpenReview: () => void;
}

export function KycDossierPanel({ companyId, onOpenReview }: KycDossierPanelProps) {
  const t = useT();
  const revueQ = useKycRevue(companyId);
  const [target, setTarget] = useState<VerdictTarget | null>(null);
  const [viewing, setViewing] = useState<KycRevuePiece | null>(null);

  if (revueQ.isPending) {
    return (
      <div className="flex flex-col gap-[9px]">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-[92px] animate-pulse rounded-md bg-secondary" />
        ))}
      </div>
    );
  }

  if (revueQ.isError) {
    const notFound = kycProblem(revueQ.error).status === 404;
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-md bg-[#FDECEC] px-3.5 py-3 text-[12.5px] font-bold text-de9-red dark:bg-[#E7464E]/15">
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
    );
  }

  const r = revueQ.data;
  const enRevue = !!r.enRevue;
  const viewed = viewing?.courante ?? null;
  const motifOnPieces = r.pieces.some((p) => p.statut === 'refuse' && !!p.courante?.motif);

  return (
    <div className="flex flex-col gap-3.5">
      {/* ---- where the dossier stands ---- */}
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill
            tone={TONES[dossierToneName(r.statut, r.enRevue)]}
            label={dossierStatutLabel(r.statut, r.statutLabel, t)}
          />
          {r.statut === 'pending' && !enRevue && <Tag tone="grey">{t('kycTagNonSoumis')}</Tag>}
          {r.revueCommencee && <Tag>{t('kycTagRevueEnCours')}</Tag>}
          {r.resoumission && (
            <Tag tone="amber">
              <Glyph icon={Repeat} className="me-1" />
              {t('kycTagRenvoye')}
            </Tag>
          )}
        </div>
        {r.progression && (
          <div className="mt-2.5 flex items-center gap-3">
            <ProgressBar progression={r.progression} className="flex-1" />
            <span dir="auto" className="flex-none text-[12px] font-extrabold">
              {r.progression.libelle ?? `${r.progression.valides} / ${r.progression.total}`}
            </span>
          </div>
        )}
      </div>

      {/* « À corriger »: each refused piece prints its own motif below. The dossier's
          composed one is only shown when no piece carries it (an old whole-dossier verdict). */}
      {r.statut === 'rejected' &&
        (r.motif && !motifOnPieces ? (
          <div className="rounded-md border border-[#F3C9CB] bg-[#FDECEC] px-3.5 py-2.5 dark:border-[#E7464E]/40 dark:bg-[#E7464E]/15">
            <div className="text-[10.5px] font-extrabold uppercase tracking-[.04em] text-de9-red">{t('kycMotifEnvoye')}</div>
            <div dir="auto" className="mt-1 text-[12.5px] leading-[1.5] text-de9-ink">
              {r.motif}
            </div>
            <div className="mt-1 text-[11px] text-de9-gray">{t('kycACorrigerInfo')}</div>
          </div>
        ) : (
          <div className="-mt-1.5 text-[11.5px] text-de9-gray">{t('kycACorrigerInfo')}</div>
        ))}

      {/* ---- RC, NIF, NIS — one verdict each ---- */}
      <div className="flex flex-col gap-2.5">
        {r.pieces.map((piece) => (
          <PieceRow
            key={piece.kind}
            piece={piece}
            enRevue={enRevue}
            onVerdict={(verdict) => setTarget({ piece, verdict })}
            onView={() => setViewing(piece)}
          />
        ))}
      </div>

      <button type="button" onClick={onOpenReview} className={cn(LINK, 'self-start')}>
        {t('kycOuvrirRevue')} <Glyph icon={ArrowRight} className="rtl:rotate-180" />
      </button>

      <VerdictDialog
        companyId={r.companyId}
        target={target}
        dossierStatut={r.statut}
        enRevue={enRevue}
        onClose={() => setTarget(null)}
        layerClassName={ABOVE_FICHE}
      />
      {viewing && viewed && (
        <PreviewDialog
          open
          onOpenChange={(open) => {
            if (!open) setViewing(null);
          }}
          title={`${kindShort(viewing.kind, viewing.labelCourt)} · ${t('kycVersion').replace('{n}', String(viewed.version ?? '—'))}`}
          documentId={viewed.documentId}
          fileName={viewed.fileName}
          contentType={viewed.contentType}
          layerClassName={ABOVE_FICHE}
        />
      )}
    </div>
  );
}

function PieceRow({
  piece,
  enRevue,
  onVerdict,
  onView,
}: {
  piece: KycRevuePiece;
  /** The round is open: a refusal's motif reaches the company only when it closes. */
  enRevue: boolean;
  onVerdict: (verdict: KycVerdict) => void;
  onView: () => void;
}) {
  const t = useT();
  const tone = docTone(piece.statut);
  const short = kindShort(piece.kind, piece.labelCourt);
  const courante = piece.courante ?? null;
  const decided = piece.statut === 'valide' || piece.statut === 'refuse';
  // Which verdicts show, and which are live — lib/kyc.ts pieceVerdicts.
  const verdicts = pieceVerdicts(piece);

  return (
    <section className={cn('rounded-md border border-s-4 border-de9-line px-3.5 py-3', tone.edge)}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-md bg-inverse-surface px-1.5 py-0.5 text-[10.5px] font-extrabold tracking-[.04em] text-inverse-on-surface">
          {short}
        </span>
        <h3 className="min-w-0 flex-1 text-[13px] font-extrabold">{kindLong(piece.kind, piece.kindLabel, t)}</h3>
        <StatusPill tone={tone} label={docStatutLabel(piece.statut, piece.statutLabel, t)} />
      </div>

      {/* the typed number — validating the document validates it */}
      <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <SectionLabel>{piece.numeroLabel || `N° ${short}`}</SectionLabel>
        {piece.numero ? (
          <span dir="ltr" className="break-all font-mono text-[13px] font-bold text-de9-ink">
            {piece.numero}
          </span>
        ) : (
          <span className="text-[12px] text-de9-gray">{t('kycNumeroVide')}</span>
        )}
      </div>

      {courante && (
        <div className="mt-2 flex items-center gap-2.5">
          <span className="flex-none text-[16px] text-de9-gray">
            <Glyph icon={FileText} />
          </span>
          <div className="min-w-0 flex-1 text-[11px] leading-[1.5] text-de9-gray">
            <div className="truncate text-[12px] font-bold text-de9-ink" title={courante.fileName ?? undefined}>
              {courante.fileName ?? '—'}
            </div>
            <div>
              {[
                courante.version != null ? t('kycVersion').replace('{n}', String(courante.version)) : null,
                fmtSize(courante.sizeBytes, t),
                courante.deposeLe ? t('kycDeposeLe').replace('{n}', fmtDateTime(courante.deposeLe, t)) : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            </div>
          </div>
          <button
            type="button"
            onClick={onView}
            className="flex-none cursor-pointer rounded-full bg-primary px-3 py-[7px] text-[11px] font-bold text-primary-foreground"
          >
            {t('voir')}
          </button>
        </div>
      )}

      {/* the verdict so far */}
      {piece.statut === 'refuse' && courante?.motif && (
        <div className="mt-2.5 rounded-md border border-[#F3C9CB] bg-[#FDECEC] px-3 py-2 dark:border-[#E7464E]/40 dark:bg-[#E7464E]/15">
          <div className="text-[10px] font-extrabold uppercase tracking-[.04em] text-de9-red">
            {enRevue ? t('kycMotifAEnvoyer') : t('kycMotifEnvoye')}
          </div>
          <div dir="auto" className="mt-0.5 text-[12px] leading-[1.45] text-de9-ink">
            {courante.motif}
          </div>
        </div>
      )}
      {courante?.noteInterne && (
        <div className="mt-2 text-[11.5px] leading-[1.45] text-de9-slate">
          <Glyph icon={Lock} /> <bdi>{courante.noteInterne}</bdi>
        </div>
      )}
      {decided && courante?.revueLe && (
        <div className="mt-1.5 text-[11px] text-de9-gray">
          {t('kycDecideLe').replace('{n}', fmtDateTime(courante.revueLe, t))}
          {courante.revueParNom ? ' · ' + t('kycPar').replace('{n}', courante.revueParNom) : ''}
        </div>
      )}

      {/* actions — the server's flags; `blocage` is its reason */}
      {piece.blocage && (
        <div className="mt-2.5 rounded-md border border-dashed border-de9-line px-3 py-2 text-[11.5px] font-semibold leading-[1.45] text-de9-slate">
          <Glyph icon={Info} /> <bdi>{verdicts.reason}</bdi>
        </div>
      )}
      {(verdicts.valider.show || verdicts.refuser.show) && courante && (
        <div className="mt-2.5 flex flex-wrap gap-2">
          {verdicts.valider.show && (
            <button
              type="button"
              disabled={!verdicts.valider.enabled}
              title={verdicts.valider.enabled ? undefined : verdicts.reason}
              onClick={() => onVerdict('valider')}
              className="min-w-[110px] flex-1 cursor-pointer rounded-full bg-[#2FA86A] px-4 py-[9px] text-[12.5px] font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Glyph icon={Check} /> {t('kycValider')}
            </button>
          )}
          {verdicts.refuser.show && (
            <button
              type="button"
              disabled={!verdicts.refuser.enabled}
              title={verdicts.refuser.enabled ? undefined : verdicts.reason}
              onClick={() => onVerdict('refuser')}
              className={cn(
                'cursor-pointer rounded-full border border-[#F3C9CB] bg-card px-4 py-2 text-[12.5px] font-bold text-de9-red disabled:cursor-not-allowed disabled:opacity-40 dark:border-[#E7464E]/40',
                verdicts.valider.show && 'min-w-[110px] flex-1',
              )}
            >
              <Glyph icon={X} /> {t('kycRefuser')}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
