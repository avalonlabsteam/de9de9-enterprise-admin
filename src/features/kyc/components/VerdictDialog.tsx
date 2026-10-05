// « Valider » / « Refuser » one piece. Sends the piece's `statut` as the
// screen showed it (`statutVu`) — and, on « Valider », its number
// (`numeroVu`) — so a colleague's verdict or a number changed meanwhile comes
// back as a 409 instead of being silently overridden or locked unread. The
// server's `message` is the toast.
import { useState } from 'react';
import { toast } from 'sonner';
import { Check, Lock, TriangleAlert, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useT } from '@/lib/i18n';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Glyph } from '@/components/common/Glyph';
import { reloadKycRevue, useKycVerdict, type KycVerdict } from '../api/kyc';
import { KYC_MOTIF_MAX, KYC_NOTE_MAX, type KycRevuePiece } from '../schemas/kyc';
import { isStaleProblem, kindLong, kindShort, kycErrorMessage, kycProblem } from '../lib/kyc';

export interface VerdictTarget {
  piece: KycRevuePiece;
  verdict: KycVerdict;
}

interface VerdictDialogProps {
  companyId: string;
  target: VerdictTarget | null;
  /** Dossier `statut` — refusing a validated piece of a verified company revokes the badge. */
  dossierStatut: string;
  /** Round open: the motif waits for the round to close. */
  enRevue: boolean;
  onClose: () => void;
  /** A z-index class for the dialog and its scrim, when it opens above a fiche. */
  layerClassName?: string;
}

export function VerdictDialog({ companyId, target, dossierStatut, enRevue, onClose, layerClassName }: VerdictDialogProps) {
  return (
    <Dialog
      open={target !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        showCloseButton={false}
        overlayClassName={layerClassName}
        className={cn(
          'block max-h-[90vh] max-w-[calc(100%-2rem)] gap-0 overflow-y-auto rounded-xl bg-card p-6 sm:max-w-[480px] sm:p-7',
          layerClassName,
        )}
      >
        {target && (
          // Keyed so the fields start empty for every piece / verdict.
          <VerdictForm
            key={`${target.piece.courante?.documentId ?? target.piece.kind}:${target.verdict}`}
            companyId={companyId}
            target={target}
            dossierStatut={dossierStatut}
            enRevue={enRevue}
            onClose={onClose}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

const KIND_FR: Record<string, string> = {
  KycRc: 'Registre de Commerce',
  KycNif: "Numéro d'Identification Fiscale",
  KycNis: "Numéro d'Identification Statistique",
};

interface MotifPreset {
  key: 'kycPresetIllisible' | 'kycPresetNumero' | 'kycPresetExpire' | 'kycPresetMauvais';
  text: string;
}

/**
 * Ready-made motifs. The chip reads in the UI language; the text it inserts is
 * written for the company — French, like every message the company receives.
 */
function motifPresets(piece: KycRevuePiece): MotifPreset[] {
  const short = kindShort(piece.kind, piece.labelCourt);
  const numeroLabel = piece.numeroLabel || `N° ${short}`;
  const long = piece.kindLabel || KIND_FR[piece.kind] || short;
  return [
    { key: 'kycPresetIllisible', text: `${short} illisible : envoyez une copie nette et complète.` },
    { key: 'kycPresetNumero', text: `Le ${numeroLabel} saisi ne correspond pas au document.` },
    { key: 'kycPresetExpire', text: `${short} expiré : envoyez un document à jour.` },
    { key: 'kycPresetMauvais', text: `Ce n'est pas le bon document : envoyez le ${long}.` },
  ];
}

const FIELD_CLS =
  'w-full resize-y rounded-xs border bg-card px-3.5 py-3 text-[13.5px] leading-[1.5] text-de9-ink outline-none';

function VerdictForm({
  companyId,
  target,
  dossierStatut,
  enRevue,
  onClose,
}: {
  companyId: string;
  target: VerdictTarget;
  dossierStatut: string;
  enRevue: boolean;
  onClose: () => void;
}) {
  const t = useT();
  const mutation = useKycVerdict();
  const { piece, verdict } = target;
  const refusing = verdict === 'refuser';
  const short = kindShort(piece.kind, piece.labelCourt);
  const long = kindLong(piece.kind, piece.kindLabel, t);
  const documentId = piece.courante?.documentId ?? null;

  const [motif, setMotif] = useState('');
  const [note, setNote] = useState('');
  const [motifError, setMotifError] = useState<string | null>(null);

  // A refusal of a validated piece is a revocation (fraud, expired RC).
  const revoking = refusing && piece.statut === 'valide';

  const addPreset = (text: string): void => {
    setMotif((m) => (m.trim() ? `${m.trim()} ${text}` : text).slice(0, KYC_MOTIF_MAX));
    setMotifError(null);
  };

  const run = (): void => {
    if (!documentId) return;
    const motifValue = motif.trim();
    if (refusing && !motifValue) {
      setMotifError(t('kycMotifRequis'));
      return;
    }
    mutation.mutate(
      {
        companyId,
        documentId,
        verdict,
        statutVu: piece.statut,
        // The number this dialog prints above — what the admin is about to lock.
        numeroVu: refusing ? undefined : (piece.numero ?? ''),
        motif: refusing ? motifValue : undefined,
        note: note.trim() || undefined,
      },
      {
        onSuccess: (answer) => {
          toast.success(
            answer.message || t(refusing ? 'kycToastRefuse' : 'kycToastValide').replace('{n}', short),
          );
          onClose();
        },
        onError: (err) => {
          const problem = kycProblem(err);
          const message = kycErrorMessage(err, t);
          // A refused field belongs under the field, not in a toast.
          if (problem.status === 400 && refusing) {
            setMotifError(message);
            return;
          }
          toast.error(message);
          // A colleague decided, a newer version arrived, the number changed or
          // is missing… what this dialog shows is stale: reload rather than retry.
          if (isStaleProblem(problem)) {
            reloadKycRevue(companyId);
            onClose();
          }
        },
      },
    );
  };

  return (
    <>
      <div
        className={cn(
          'flex h-[54px] w-[54px] items-center justify-center rounded-md text-[24px] font-extrabold',
          refusing
            ? 'bg-[#FDECEC] text-de9-red dark:bg-[#E7464E]/15'
            : 'bg-[#E7F6EE] text-[#2FA86A] dark:bg-[#2FA86A]/15 dark:text-[#6FCF97]',
        )}
      >
        <Glyph icon={refusing ? X : Check} />
      </div>
      <DialogTitle className="mt-4 text-[19px] leading-normal font-extrabold text-de9-ink">
        {t(refusing ? 'kycRefuserTitre' : 'kycValiderTitre').replace('{n}', short)}
      </DialogTitle>
      <DialogDescription className="mt-1 text-[12.5px] text-de9-gray">{long}</DialogDescription>

      {/* the number is validated with the document — last look before locking it */}
      <div className="mt-4 rounded-md bg-secondary px-4 py-3">
        <div className="text-[10.5px] font-extrabold uppercase tracking-[.04em] text-de9-gray">
          {piece.numeroLabel || `N° ${short}`}
        </div>
        <div dir="ltr" className="mt-0.5 break-all text-start font-mono text-[15px] font-bold text-de9-ink">
          {piece.numero || '—'}
        </div>
      </div>

      <p className="mt-3.5 text-[13px] leading-[1.55] text-de9-slate">
        {refusing ? t(enRevue ? 'kycRefuserTexteRevue' : 'kycRefuserTexteImmediat') : t('kycValiderTexte')}
      </p>

      {revoking && (
        <div className="mt-3 rounded-md border border-[#F0E2C0] bg-[#FBF4E4] px-[15px] py-[12px] text-[12.5px] leading-[1.5] text-[#92702A] dark:border-[#92702A]/40 dark:bg-[#92702A]/15 dark:text-[#D9B36A]">
          <Glyph icon={TriangleAlert} /> {t(dossierStatut === 'verified' ? 'kycRevocationVerifie' : 'kycRevocation')}
        </div>
      )}

      {refusing && (
        <div className="mt-4">
          <label htmlFor="kyc-motif" className="mb-1.5 block text-xs font-semibold text-de9-slate">
            {t('kycChampMotif')}
          </label>
          <div className="mb-2 flex flex-wrap gap-1.5">
            {motifPresets(piece).map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => addPreset(p.text)}
                title={p.text}
                className="cursor-pointer rounded-full border border-de9-line bg-card px-2.5 py-[5px] text-[11px] font-bold text-de9-slate hover:border-de9-slate"
              >
                + {t(p.key)}
              </button>
            ))}
          </div>
          <textarea
            id="kyc-motif"
            dir="auto"
            value={motif}
            onChange={(e) => {
              setMotif(e.target.value);
              setMotifError(null);
            }}
            maxLength={KYC_MOTIF_MAX}
            rows={3}
            aria-invalid={!!motifError}
            className={cn(FIELD_CLS, motifError ? 'border-de9-red' : 'border-outline')}
          />
          <div className="flex justify-between gap-3 pt-1 text-[11px]">
            <span className="font-semibold text-de9-red">{motifError}</span>
            <span className="flex-none text-de9-gray">
              {motif.length} / {KYC_MOTIF_MAX}
            </span>
          </div>
        </div>
      )}

      <div className="mt-3">
        <label htmlFor="kyc-note" className="mb-1.5 block text-xs font-semibold text-de9-slate">
          <Glyph icon={Lock} /> {t('kycChampNote')}
        </label>
        <textarea
          id="kyc-note"
          dir="auto"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={KYC_NOTE_MAX}
          rows={2}
          className={cn(FIELD_CLS, 'border-outline')}
        />
      </div>

      <div className="mt-[22px] flex gap-[11px]">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 cursor-pointer rounded-full bg-secondary p-3.5 text-center text-sm font-bold text-de9-slate"
        >
          {t('annuler')}
        </button>
        <button
          type="button"
          disabled={mutation.isPending || !documentId}
          onClick={run}
          className={cn(
            'flex-1 cursor-pointer rounded-full p-3.5 text-center text-sm font-bold text-white disabled:opacity-60',
            refusing
              ? 'bg-de9-red'
              : 'bg-[#2FA86A]',
          )}
        >
          {mutation.isPending ? t('kycEnvoi') : refusing ? t('kycRefuser') : t('kycValider')}
        </button>
      </div>
    </>
  );
}
