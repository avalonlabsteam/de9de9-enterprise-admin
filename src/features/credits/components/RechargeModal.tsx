// « + Nouvelle recharge » and « Pièces de la recharge », on the live API:
//   client    GET  /credits/clients?q=       autocomplete — keep the ID, not the name
//   balance   GET  /credits/clients/{id}
//   create    POST /credits/recharges        multipart: the FILES, not their names
//   pièces    POST /credits/recharges/{rechargeId}/pieces
// Replaces POST /recharges, which took the client by name (ambiguous) and the
// pieces by file name only — so those pieces later downloaded as 404.
import { useEffect, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { useT, type TKey } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { problemMessage } from '@/api/problem';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import type { CreditClient, PieceFile, RechargeMethode } from '../schemas/credit';
import { useCreditClient, useCreditClients, useRechargePieces, useSubmitRecharge } from '../api/credits';

/** 'create' = nouvelle recharge, 'docs' = pièces of an existing one. */
export type RechargeModalState =
  | { mode: 'create' }
  | {
      mode: 'docs';
      /** Null until the API sends it — the pieces cannot be replaced without it. */
      rechargeId: string | null;
      ref: string;
      client: string;
      justif: PieceFile | null;
      facture: PieceFile | null;
    };

interface RechargeModalProps {
  state: RechargeModalState;
  onClose: () => void;
  /** After a recharge is created or its pieces are saved. */
  onDone: () => void;
}

const METHODES: ReadonlyArray<{ key: RechargeMethode; labelKey: TKey }> = [
  { key: 'Virement', labelKey: 'mVirement' },
  { key: 'Versement', labelKey: 'mVersement' },
  { key: 'Chèque', labelKey: 'mCheque' },
  { key: 'Carte', labelKey: 'mCarte' },
];

/** The API refuses larger files with 413 — say so before uploading 30 MB. */
const MAX_BYTES = 10 * 1024 * 1024;

const fmt = (n: number): string => n.toLocaleString('fr-FR');

type Field = 'clientId' | 'montant' | 'methode' | 'reference' | 'justif' | 'facture' | 'pieces';
type FieldErrors = Partial<Record<Field, string>>;

const inputCls = (invalid: boolean): string =>
  cn(
    'w-full rounded-xl border-[1.5px] bg-card p-3 text-sm text-de9-ink outline-none',
    invalid ? 'border-de9-red' : 'border-de9-line',
  );

/** Which input a ProblemDetails refusal belongs under, if any. */
function fieldOf(err: unknown): Field | null {
  if (!axios.isAxiosError(err)) return null;
  const data = err.response?.data as { code?: unknown; field?: unknown } | undefined;
  // proof_required names `justif` but is about the pair: « at least one ».
  if (data?.code === 'proof_required') return 'pieces';
  const f = data?.field;
  return f === 'clientId' || f === 'montant' || f === 'methode' || f === 'reference' || f === 'justif' || f === 'facture'
    ? f
    : null;
}

function ErrorLine({ msg }: { msg?: string }) {
  return <p className="min-h-4 pt-0.5 text-[11px] font-semibold text-de9-red">{msg ?? ''}</p>;
}

/** Justificatif / facture slot. `current` is the piece the server already holds. */
function PieceSlot({
  label,
  hint,
  current,
  file,
  onFile,
  onRemove,
  error,
}: {
  label: string;
  hint: string;
  current?: string | null;
  file: File | null;
  onFile: (f: File) => void;
  onRemove: () => void;
  error?: string;
}) {
  const t = useT();
  const pick = (e: ChangeEvent<HTMLInputElement>): void => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (f) onFile(f);
  };
  return (
    <div>
      <div className="mb-1.5 text-xs font-bold text-de9-ink">{label}</div>
      {file ? (
        <div className="flex items-center gap-2.5 rounded-xl border-[1.5px] border-[#BFE6D6] bg-[#EAF7F1] px-3.5 py-3 dark:border-[#2FA86A]/40 dark:bg-[#2FA86A]/15">
          <span className="text-lg">📄</span>
          <span className="flex-1 overflow-hidden text-[12.5px] font-semibold text-ellipsis whitespace-nowrap text-de9-teal-dark">
            {file.name}
            <span className="ms-1.5 text-[11px] font-normal text-de9-gray">
              {(file.size / 1024 / 1024).toFixed(1)} Mo
            </span>
          </span>
          <label className="cursor-pointer text-[11.5px] font-bold whitespace-nowrap text-de9-slate">
            {t('remplacer')}
            <input type="file" accept="image/*,application/pdf" onChange={pick} className="hidden" />
          </label>
          <button type="button" onClick={onRemove} className="cursor-pointer text-sm text-de9-gray">
            ✕
          </button>
        </div>
      ) : (
        <label
          className={cn(
            'flex cursor-pointer items-center gap-2.5 rounded-xl border-[1.5px] border-dashed p-3.5',
            error ? 'border-de9-red' : 'border-de9-line',
          )}
        >
          <span className="text-lg">📎</span>
          <div className="flex-1">
            <div className="text-[13px] font-bold text-de9-slate">{t('deposerFichier')}</div>
            <div className="text-[11px] text-de9-gray">
              {current ? t('rPieceActuelle').replace('{n}', current) : hint}
            </div>
          </div>
          <input type="file" accept="image/*,application/pdf" onChange={pick} className="hidden" />
        </label>
      )}
      <ErrorLine msg={error} />
    </div>
  );
}

/** The two piece slots and their shared size / « at least one » checks. */
function usePiecePair() {
  const t = useT();
  const [justif, setJustif] = useState<File | null>(null);
  const [facture, setFacture] = useState<File | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const accept = (field: 'justif' | 'facture', file: File): void => {
    if (file.size > MAX_BYTES) {
      setErrors((e) => ({ ...e, [field]: t('rFichierTropGros') }));
      return;
    }
    setErrors((e) => ({ ...e, [field]: undefined, pieces: undefined }));
    if (field === 'justif') setJustif(file);
    else setFacture(file);
  };
  return { justif, setJustif, facture, setFacture, errors, setErrors, accept };
}

/* ---- create mode ---- */
function RechargeCreateForm({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const t = useT();
  const submit = useSubmitRecharge();
  const pair = usePiecePair();
  const { errors, setErrors } = pair;
  const [saisie, setSaisie] = useState('');
  const [debounced, setDebounced] = useState('');
  const [client, setClient] = useState<CreditClient | null>(null);
  const [focused, setFocused] = useState(false);
  const [montant, setMontant] = useState('');
  const [reference, setReference] = useState('');
  const [methode, setMethode] = useState<RechargeMethode>('Virement');
  // « Rendre visible au client » notifies them — the API defaults it to true.
  const [visibleClient, setVisibleClient] = useState(true);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(saisie.trim()), 250);
    return () => clearTimeout(id);
  }, [saisie]);

  // An empty `q` lists the first clients alphabetically, which is useful on open.
  const suggestions = useCreditClients(debounced, !client);
  const refreshed = useCreditClient(client?.id ?? null);
  const shown = refreshed.data ?? client;

  const choose = (item: CreditClient): void => {
    setClient(item);
    setSaisie(item.nom);
    setFocused(false);
    setErrors((e) => ({ ...e, clientId: undefined }));
  };
  const onSaisie = (value: string): void => {
    setSaisie(value);
    // What is typed no longer matches the chosen id.
    if (client) setClient(null);
  };

  const onSubmit = (e: FormEvent): void => {
    e.preventDefault();
    const amount = Number(montant.replace(/\s/g, ''));
    const next: FieldErrors = {};
    if (!client) next.clientId = t('rClientRequis');
    if (!Number.isInteger(amount) || amount <= 0) next.montant = t('rMontantInvalide');
    if (!pair.justif && !pair.facture) next.pieces = t('rPieceRequise');
    if (!client || Object.values(next).some(Boolean)) {
      setErrors(next);
      return;
    }
    submit.mutate(
      {
        clientId: client.id,
        montant: amount,
        methode,
        reference,
        visibleClient,
        justif: pair.justif,
        facture: pair.facture,
      },
      {
        onSuccess: () => {
          toast.success(t('rechargeToastEnregistree'));
          onDone();
        },
        onError: (err) => {
          const field = fieldOf(err);
          const message = problemMessage(err);
          if (field) setErrors((cur) => ({ ...cur, [field]: message }));
          else toast.error(message);
        },
      },
    );
  };

  const items = suggestions.data?.items ?? [];

  return (
    <form onSubmit={onSubmit} noValidate>
      {/* client — autocomplete, the id is what gets sent */}
      <div className="relative mt-4">
        <div className="mb-1.5 text-xs font-semibold text-de9-slate">{t('rClient')}</div>
        <input
          value={saisie}
          onChange={(e) => onSaisie(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={t('rClientPh')}
          autoComplete="off"
          aria-invalid={!!errors.clientId}
          className={inputCls(!!errors.clientId)}
        />
        {focused && !client && (
          <div className="absolute z-10 mt-1 max-h-60 w-full overflow-y-auto rounded-xl border border-de9-line bg-card shadow-[0_14px_30px_rgba(20,30,45,.18)]">
            {suggestions.isPending ? (
              <div className="p-3 text-xs text-de9-gray">…</div>
            ) : items.length === 0 ? (
              <div className="p-3 text-xs text-de9-gray">{t('rClientAucun')}</div>
            ) : (
              items.map((it) => (
                <button
                  key={it.id}
                  type="button"
                  // Keep the input focused so the click lands before the list closes.
                  onMouseDown={(ev) => ev.preventDefault()}
                  onClick={() => choose(it)}
                  className="flex w-full cursor-pointer items-start justify-between gap-2 px-3.5 py-2.5 text-start hover:bg-secondary"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-bold text-de9-ink">{it.nom}</span>
                    <span className="block truncate text-[11px] text-de9-gray">{it.email ?? it.wilaya ?? ''}</span>
                  </span>
                  {it.solde && (
                    <span className="flex-none text-[11px] font-semibold text-de9-slate">{it.solde} cr</span>
                  )}
                </button>
              ))
            )}
          </div>
        )}
        {client && shown && (
          <div className="mt-1.5 text-[11.5px] font-semibold text-de9-slate">
            {t('rClientSolde')
              .replace('{s}', shown.solde ?? fmt(shown.soldeCredits ?? 0))
              .replace('{d}', fmt(shown.disponibleCredits ?? 0))}
            {shown.hasWallet === false && (
              <span className="ms-1.5 font-normal text-de9-gray">· {t('rClientNouveauWallet')}</span>
            )}
          </div>
        )}
        <ErrorLine msg={errors.clientId} />
      </div>

      {/* montant + référence */}
      <div className="mt-1 flex flex-col gap-3 sm:flex-row">
        <div className="flex-1">
          <div className="mb-1.5 text-xs font-semibold text-de9-slate">{t('rMontant')}</div>
          <input
            inputMode="numeric"
            value={montant}
            onChange={(e) => {
              setMontant(e.target.value);
              setErrors((cur) => ({ ...cur, montant: undefined }));
            }}
            placeholder="0"
            aria-invalid={!!errors.montant}
            className={inputCls(!!errors.montant)}
          />
          <ErrorLine msg={errors.montant} />
        </div>
        <div className="flex-1">
          <div className="mb-1.5 text-xs font-semibold text-de9-slate">{t('rReference')}</div>
          <input
            value={reference}
            maxLength={200}
            onChange={(e) => {
              setReference(e.target.value);
              setErrors((cur) => ({ ...cur, reference: undefined }));
            }}
            placeholder={t('rReferencePh')}
            aria-invalid={!!errors.reference}
            className={inputCls(!!errors.reference)}
          />
          <ErrorLine msg={errors.reference} />
        </div>
      </div>

      {/* méthode */}
      <div className="mt-1">
        <div className="mb-1.5 text-xs font-semibold text-de9-slate">{t('rMethode')}</div>
        <div className="flex flex-wrap gap-[7px]">
          {METHODES.map((m) => (
            <button
              key={m.key}
              type="button"
              onClick={() => setMethode(m.key)}
              className={cn(
                'cursor-pointer rounded-full border-[1.5px] px-3.5 py-[9px] text-xs font-bold',
                methode === m.key
                  ? 'border-de9-teal-dark bg-de9-teal-dark text-white'
                  : 'border-de9-line bg-card text-de9-slate',
              )}
            >
              {t(m.labelKey)}
            </button>
          ))}
        </div>
        <ErrorLine msg={errors.methode} />
      </div>

      {/* pièces — at least one of the two */}
      <div className="mt-2">
        <PieceSlot
          label={t('pieceJustif')}
          hint={t('pieceJustifHint')}
          file={pair.justif}
          onFile={(f) => pair.accept('justif', f)}
          onRemove={() => pair.setJustif(null)}
          error={errors.justif}
        />
      </div>
      <div className="mt-1">
        <PieceSlot
          label={t('pieceFacture')}
          hint={t('pieceFactureHint')}
          file={pair.facture}
          onFile={(f) => pair.accept('facture', f)}
          onRemove={() => pair.setFacture(null)}
          error={errors.facture}
        />
      </div>
      {errors.pieces && <p className="text-[11.5px] font-semibold text-de9-red">{errors.pieces}</p>}

      {/* visible client */}
      <button
        type="button"
        onClick={() => setVisibleClient((v) => !v)}
        className="mt-4 flex cursor-pointer items-center gap-2.5"
      >
        <span
          className={cn(
            'flex size-5 flex-none items-center justify-center rounded-md border-2 text-xs font-extrabold text-white',
            visibleClient ? 'border-de9-teal-dark bg-de9-teal-dark' : 'border-de9-line bg-card',
          )}
        >
          {visibleClient ? '✓' : ''}
        </span>
        <span className="text-[12.5px] font-semibold text-de9-slate">{t('visibleClient')}</span>
      </button>

      <div className="mt-[22px] flex gap-[11px]">
        <Button
          type="button"
          variant="ghost"
          onClick={onClose}
          className="h-auto flex-1 rounded-[13px] bg-secondary p-3.5 text-center text-sm font-bold text-de9-slate hover:bg-secondary/80"
        >
          {t('annuler')}
        </Button>
        {/* No Idempotency-Key on this route: one submission at a time. */}
        <Button
          type="submit"
          disabled={submit.isPending}
          className="h-auto flex-[1.4] rounded-[13px] bg-de9-teal-dark p-3.5 text-center text-sm font-bold text-white shadow-[0_10px_22px_rgba(23,138,130,.38)] hover:bg-de9-teal-dark/90"
        >
          {submit.isPending ? t('docTelechargementEnCours') : t('enregistrerRecharge')}
        </Button>
      </div>
    </form>
  );
}

/* ---- docs mode: fill or replace the pieces of an existing recharge ---- */
function RechargeDocsForm({
  state,
  onClose,
  onDone,
}: {
  state: Extract<RechargeModalState, { mode: 'docs' }>;
  onClose: () => void;
  onDone: () => void;
}) {
  const t = useT();
  const pieces = useRechargePieces();
  const pair = usePiecePair();
  const { errors, setErrors } = pair;
  const rechargeId = state.rechargeId;

  const onSave = (): void => {
    if (!rechargeId) return;
    if (!pair.justif && !pair.facture) {
      setErrors({ pieces: t('rPieceRequise') });
      return;
    }
    pieces.mutate(
      { rechargeId, justif: pair.justif, facture: pair.facture },
      {
        onSuccess: () => {
          toast.success(t('rechargeToastPieces'));
          onDone();
        },
        onError: (err) => {
          const field = fieldOf(err);
          const message = problemMessage(err);
          if (field) setErrors((cur) => ({ ...cur, [field]: message }));
          else toast.error(message);
        },
      },
    );
  };

  return (
    <div>
      <div className="mt-4 rounded-xl bg-secondary px-3.5 py-3 text-[12.5px] text-de9-slate">
        {t('rClient')} : <b className="text-de9-ink">{state.client}</b> · {state.ref}
      </div>
      {!rechargeId && (
        <div className="mt-3 rounded-xl border border-[#F0E2C0] bg-[#FBF4E4] px-3.5 py-2.5 text-[12px] font-semibold text-[#92702A] dark:border-[#92702A]/40 dark:bg-[#92702A]/15 dark:text-[#D9B36A]">
          {t('rPiecesIndispo')}
        </div>
      )}
      <div className="mt-[18px]">
        <PieceSlot
          label={t('pieceJustif')}
          hint={t('pieceJustifHint')}
          current={state.justif?.name}
          file={pair.justif}
          onFile={(f) => pair.accept('justif', f)}
          onRemove={() => pair.setJustif(null)}
          error={errors.justif}
        />
      </div>
      <div className="mt-1">
        <PieceSlot
          label={t('pieceFacture')}
          hint={t('pieceFactureHint')}
          current={state.facture?.name}
          file={pair.facture}
          onFile={(f) => pair.accept('facture', f)}
          onRemove={() => pair.setFacture(null)}
          error={errors.facture}
        />
      </div>
      {errors.pieces && <p className="text-[11.5px] font-semibold text-de9-red">{errors.pieces}</p>}
      <div className="mt-[22px] flex gap-[11px]">
        <Button
          type="button"
          variant="ghost"
          onClick={onClose}
          className="h-auto flex-1 rounded-[13px] bg-secondary p-3.5 text-center text-sm font-bold text-de9-slate hover:bg-secondary/80"
        >
          {t('annuler')}
        </Button>
        <Button
          type="button"
          disabled={!rechargeId || pieces.isPending}
          onClick={onSave}
          className="h-auto flex-[1.4] rounded-[13px] bg-de9-teal-dark p-3.5 text-center text-sm font-bold text-white shadow-[0_10px_22px_rgba(23,138,130,.38)] hover:bg-de9-teal-dark/90"
        >
          {pieces.isPending ? t('docTelechargementEnCours') : t('enregistrerPieces')}
        </Button>
      </div>
    </div>
  );
}

/** "Nouvelle recharge" / "Pièces de la recharge" dialog. */
export function RechargeModal({ state, onClose, onDone }: RechargeModalProps) {
  const t = useT();
  const isCreate = state.mode === 'create';

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="block max-h-[90vh] w-full max-w-[480px] gap-0 overflow-y-auto rounded-[22px] bg-card p-7 text-de9-ink shadow-[0_30px_70px_rgba(20,30,45,.35)] sm:max-w-[480px]"
      >
        <div className="flex size-[54px] items-center justify-center rounded-[15px] bg-[#E5F7F4] text-[26px] dark:bg-[#178A82]/20">
          💳
        </div>
        <DialogTitle className="mt-4 text-[19px] font-extrabold text-de9-ink">
          {isCreate ? t('rechargeTitle') : t('ajoutPiecesTitle')}
        </DialogTitle>
        <DialogDescription className="mt-[9px] text-[13px] leading-[1.55] font-normal text-de9-slate">
          {isCreate ? t('rechargeInfo') : t('ajoutPiecesInfo')}
        </DialogDescription>
        {state.mode === 'create' ? (
          <RechargeCreateForm onClose={onClose} onDone={onDone} />
        ) : (
          <RechargeDocsForm state={state} onClose={onClose} onDone={onDone} />
        )}
      </DialogContent>
    </Dialog>
  );
}
