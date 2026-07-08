import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { useT, type TKey } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  rechargeInputSchema,
  type PieceFile,
  type RechargeInput,
  type RechargeMethode,
} from '../schemas/credit';
import { useCreateRecharge } from '../api/credits';

/** Modal state — 'create' = nouvelle recharge, 'docs' = pièces of an existing one. */
export type RechargeModalState =
  | { mode: 'create' }
  | { mode: 'docs'; ref: string; client: string; justif: PieceFile | null; facture: PieceFile | null };

export interface RechargeDocs {
  justif: PieceFile | null;
  facture: PieceFile | null;
}

interface RechargeModalProps {
  state: RechargeModalState;
  onClose: () => void;
  /** docs mode — persist the pieces for an existing recharge (prototype rechargeDocs). */
  onSaveDocs: (ref: string, docs: RechargeDocs) => void;
  /** create mode — after the recharge is saved (prototype resets creditFilter to 'all'). */
  onCreated: () => void;
}

const METHODES: ReadonlyArray<{ key: RechargeMethode; labelKey: TKey }> = [
  { key: 'Virement', labelKey: 'mVirement' },
  { key: 'Versement', labelKey: 'mVersement' },
  { key: 'Chèque', labelKey: 'mCheque' },
  { key: 'Carte', labelKey: 'mCarte' },
];

const inputCls =
  'w-full rounded-xl border-[1.5px] border-de9-line p-3 text-sm text-de9-ink outline-none';

/* ---- shared upload slot (justificatif / facture émise) ---- */
function PieceSlot({
  label,
  hint,
  file,
  onFile,
  onRemove,
}: {
  label: string;
  hint: string;
  file: PieceFile | null;
  onFile: (f: PieceFile) => void;
  onRemove: () => void;
}) {
  const t = useT();
  const pick = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const f = e.target.files?.[0];
    if (f) onFile({ name: f.name });
    e.target.value = '';
  };
  return (
    <div>
      <div className="mb-1.5 text-xs font-bold text-de9-ink">{label}</div>
      {file ? (
        <div className="flex items-center gap-2.5 rounded-xl border-[1.5px] border-[#BFE6D6] bg-[#EAF7F1] px-3.5 py-3 dark:border-[#2FA86A]/40 dark:bg-[#2FA86A]/15">
          <span className="text-lg">📄</span>
          <span className="flex-1 overflow-hidden text-[12.5px] font-semibold text-ellipsis whitespace-nowrap text-de9-teal-dark">
            {file.name}
          </span>
          <label className="cursor-pointer text-[11.5px] font-bold whitespace-nowrap text-de9-slate">
            {t('remplacer')}
            <input type="file" accept="image/*,application/pdf" onChange={pick} className="hidden" />
          </label>
          <button
            type="button"
            onClick={onRemove}
            className="cursor-pointer text-sm text-de9-gray"
          >
            ✕
          </button>
        </div>
      ) : (
        <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border-[1.5px] border-dashed border-de9-line p-3.5">
          <span className="text-lg">📎</span>
          <div className="flex-1">
            <div className="text-[13px] font-bold text-de9-slate">{t('deposerFichier')}</div>
            <div className="text-[11px] text-de9-gray">{hint}</div>
          </div>
          <input type="file" accept="image/*,application/pdf" onChange={pick} className="hidden" />
        </label>
      )}
    </div>
  );
}

/* ---- create mode form ---- */
function RechargeCreateForm({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const t = useT();
  const createRecharge = useCreateRecharge();
  const [montantText, setMontantText] = useState('');

  const form = useForm<RechargeInput>({
    resolver: zodResolver(rechargeInputSchema),
    defaultValues: {
      client: '',
      montant: 0,
      methode: 'Virement',
      reference: '',
      justif: null,
      facture: null,
      visibleClient: false,
    },
  });
  const errors = form.formState.errors;

  const onSubmit = async (input: RechargeInput): Promise<void> => {
    await createRecharge.mutateAsync(input);
    toast.success(t('rechargeToastEnregistree'));
    onCreated();
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
      {/* client */}
      <div className="mt-4">
        <div className="mb-1.5 text-xs font-semibold text-de9-slate">{t('rClient')}</div>
        <input
          {...form.register('client')}
          placeholder={t('rClientPh')}
          aria-invalid={!!errors.client}
          className={inputCls}
        />
        <p className="min-h-4 pt-0.5 text-[11px] font-semibold text-de9-red">
          {errors.client?.message ?? ''}
        </p>
      </div>
      {/* montant + référence */}
      <div className="mt-1 flex flex-col gap-3 sm:flex-row">
        <div className="flex-1">
          <div className="mb-1.5 text-xs font-semibold text-de9-slate">{t('rMontant')}</div>
          <Controller
            control={form.control}
            name="montant"
            render={({ field }) => (
              <input
                type="number"
                value={montantText}
                onChange={(e) => {
                  setMontantText(e.target.value);
                  field.onChange(parseInt(e.target.value, 10) || 0);
                }}
                placeholder="0"
                aria-invalid={!!errors.montant}
                className={inputCls}
              />
            )}
          />
          <p className="min-h-4 pt-0.5 text-[11px] font-semibold text-de9-red">
            {errors.montant?.message ?? ''}
          </p>
        </div>
        <div className="flex-1">
          <div className="mb-1.5 text-xs font-semibold text-de9-slate">{t('rReference')}</div>
          <input
            {...form.register('reference')}
            placeholder={t('rReferencePh')}
            aria-invalid={!!errors.reference}
            className={inputCls}
          />
          <p className="min-h-4 pt-0.5 text-[11px] font-semibold text-de9-red">
            {errors.reference?.message ?? ''}
          </p>
        </div>
      </div>
      {/* méthode */}
      <div className="mt-1">
        <div className="mb-1.5 text-xs font-semibold text-de9-slate">{t('rMethode')}</div>
        <Controller
          control={form.control}
          name="methode"
          render={({ field }) => (
            <div className="flex flex-wrap gap-[7px]">
              {METHODES.map((m) => {
                const active = field.value === m.key;
                return (
                  <button
                    key={m.key}
                    type="button"
                    onClick={() => field.onChange(m.key)}
                    className={cn(
                      'cursor-pointer rounded-full border-[1.5px] px-3.5 py-[9px] text-xs font-bold',
                      active
                        ? 'border-de9-teal-dark bg-de9-teal-dark text-white'
                        : 'border-de9-line bg-card text-de9-slate',
                    )}
                  >
                    {t(m.labelKey)}
                  </button>
                );
              })}
            </div>
          )}
        />
      </div>
      {/* pièces */}
      <div className="mt-[18px]">
        <Controller
          control={form.control}
          name="justif"
          render={({ field }) => (
            <PieceSlot
              label={t('pieceJustif')}
              hint={t('pieceJustifHint')}
              file={field.value ?? null}
              onFile={field.onChange}
              onRemove={() => field.onChange(null)}
            />
          )}
        />
      </div>
      <div className="mt-3.5">
        <Controller
          control={form.control}
          name="facture"
          render={({ field }) => (
            <PieceSlot
              label={t('pieceFacture')}
              hint={t('pieceFactureHint')}
              file={field.value ?? null}
              onFile={field.onChange}
              onRemove={() => field.onChange(null)}
            />
          )}
        />
      </div>
      {/* visible client */}
      <Controller
        control={form.control}
        name="visibleClient"
        render={({ field }) => (
          <button
            type="button"
            onClick={() => field.onChange(!field.value)}
            className="mt-4 flex cursor-pointer items-center gap-2.5"
          >
            <span
              className={cn(
                'flex size-5 flex-none items-center justify-center rounded-md border-2 text-xs font-extrabold text-white',
                field.value ? 'border-de9-teal-dark bg-de9-teal-dark' : 'border-de9-line bg-card',
              )}
            >
              {field.value ? '✓' : ''}
            </span>
            <span className="text-[12.5px] font-semibold text-de9-slate">
              {t('visibleClient')}
            </span>
          </button>
        )}
      />
      {/* actions */}
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
          type="submit"
          disabled={form.formState.isSubmitting}
          className="h-auto flex-[1.4] rounded-[13px] bg-de9-teal-dark p-3.5 text-center text-sm font-bold text-white shadow-[0_10px_22px_rgba(23,138,130,.38)] hover:bg-de9-teal-dark/90"
        >
          {t('enregistrerRecharge')}
        </Button>
      </div>
    </form>
  );
}

/* ---- docs mode (pièces of an existing recharge) ---- */
function RechargeDocsForm({
  refCode,
  client,
  initial,
  onClose,
  onSaveDocs,
}: {
  refCode: string;
  client: string;
  initial: RechargeDocs;
  onClose: () => void;
  onSaveDocs: (ref: string, docs: RechargeDocs) => void;
}) {
  const t = useT();
  const [justif, setJustif] = useState<PieceFile | null>(initial.justif);
  const [facture, setFacture] = useState<PieceFile | null>(initial.facture);

  return (
    <div>
      <div className="mt-4 rounded-xl bg-secondary px-3.5 py-3 text-[12.5px] text-de9-slate">
        {t('rClient')} : <b className="text-de9-ink">{client}</b> · {refCode}
      </div>
      <div className="mt-[18px]">
        <PieceSlot
          label={t('pieceJustif')}
          hint={t('pieceJustifHint')}
          file={justif}
          onFile={setJustif}
          onRemove={() => setJustif(null)}
        />
      </div>
      <div className="mt-3.5">
        <PieceSlot
          label={t('pieceFacture')}
          hint={t('pieceFactureHint')}
          file={facture}
          onFile={setFacture}
          onRemove={() => setFacture(null)}
        />
      </div>
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
          onClick={() => {
            onSaveDocs(refCode, { justif, facture });
            toast.success(t('rechargeToastPieces'));
          }}
          className="h-auto flex-[1.4] rounded-[13px] bg-de9-teal-dark p-3.5 text-center text-sm font-bold text-white shadow-[0_10px_22px_rgba(23,138,130,.38)] hover:bg-de9-teal-dark/90"
        >
          {t('enregistrerPieces')}
        </Button>
      </div>
    </div>
  );
}

/** "Nouvelle recharge" / "Pièces de la recharge" dialog. */
export function RechargeModal({ state, onClose, onSaveDocs, onCreated }: RechargeModalProps) {
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
          <RechargeCreateForm onClose={onClose} onCreated={onCreated} />
        ) : (
          <RechargeDocsForm
            refCode={state.ref}
            client={state.client}
            initial={{ justif: state.justif, facture: state.facture }}
            onClose={onClose}
            onSaveDocs={onSaveDocs}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
