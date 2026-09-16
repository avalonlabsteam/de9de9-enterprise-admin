// Contrat de partenariat tab — ported from src/admin/views/PresProfile.tsx (tContrat)
// and logic.ts buildContractVM / setContractFile / toggleContractStatus / removeContract.
//
// The signed contract comes from GET /prestataires/{companyId} (dossier.contrat).
// Uploading, toggling and removing have no API route, so those still write to the
// client-side store, which then shadows the server value for this session.
import type { ChangeEvent } from 'react';
import { toast } from 'sonner';
import { useT } from '@/lib/i18n';
import { contractsActions, useContractsStore } from './contractsStore';
import type { ContratView } from './fromFiche';

interface ContratPanelProps {
  presId: string;
  contrat: ContratView | null;
  onOpenPiece: (title: string, fileName: string) => void;
}

export function ContratPanel({ presId, contrat, onOpenPiece }: ContratPanelProps) {
  const t = useT();
  const local = useContractsStore((s) => s.contracts[presId]);
  const contract =
    local ??
    (contrat
      ? {
          fileName: contrat.fileName,
          signedDate: contrat.signedDate,
          validUntil: '',
          status: contrat.signed ? ('signed' as const) : ('unsigned' as const),
        }
      : undefined);

  const has = !!contract?.fileName;
  const signed = contract?.status === 'signed';

  const onFile = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    contractsActions.upload(presId, f.name);
    toast.success(t('presToastContratTeleverse'));
    e.target.value = '';
  };

  const onRemove = () => {
    contractsActions.remove(presId);
    toast.success(t('presToastContratSupprime'));
  };

  const badge = (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11.5px] font-extrabold"
      style={{
        background: signed ? '#E7F6EE' : '#F1F4F6',
        color: signed ? '#178A82' : '#8A94A0',
      }}
    >
      {signed ? '✓' : '○'} {signed ? t('contratSigne') : t('contratNonSigne')}
    </span>
  );

  return (
    <div className="border-t border-de9-line pt-4">
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div>
          <div className="text-[13px] font-extrabold">{t('contratSection')}</div>
          <div className="mt-[2px] text-[11.5px] text-de9-gray">{t('contratHint')}</div>
        </div>
        {badge}
      </div>

      {has && contract && (
        <div className="mt-3 overflow-hidden rounded-[14px] border-[1.5px] border-de9-line">
          <div className="flex items-center gap-3 bg-secondary px-4 py-3.5">
            <div className="flex h-[42px] w-[42px] flex-none items-center justify-center rounded-[11px] bg-de9-ink text-[20px] text-white dark:text-[#151923]">
              📄
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-bold text-de9-ink">{contract.fileName}</div>
              <div className="mt-[1px] text-[11px] text-de9-gray">PDF</div>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-px bg-de9-line sm:grid-cols-2">
            <div className="bg-card px-4 py-3">
              <div className="text-[10.5px] font-extrabold tracking-[.04em] text-de9-gray uppercase">
                {t('dateSignature')}
              </div>
              <div className="mt-[3px] text-[13px] font-bold">{contract.signedDate || '—'}</div>
            </div>
            <div className="bg-card px-4 py-3">
              <div className="text-[10.5px] font-extrabold tracking-[.04em] text-de9-gray uppercase">
                {t('dateEcheance')}
              </div>
              <div className="mt-[3px] text-[13px] font-bold">
                {contract.validUntil || t('presContratNonRenseignee')}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 px-4 py-3">
            <button
              type="button"
              onClick={() => onOpenPiece(t('contratSection'), contract.fileName)}
              className="cursor-pointer rounded-[10px] bg-de9-ink px-[15px] py-[9px] text-xs font-bold text-white dark:text-[#151923]"
            >
              👁 {t('voir')}
            </button>
            <button
              type="button"
              onClick={() => toast.success(t('docToastTelechargement'))}
              className="cursor-pointer rounded-[10px] bg-secondary px-[15px] py-[9px] text-xs font-bold text-de9-slate"
            >
              ⤓ {t('telecharger')}
            </button>
            <label className="cursor-pointer rounded-[10px] border-[1.5px] border-de9-line bg-card px-[15px] py-[9px] text-xs font-bold text-de9-slate">
              {t('remplacer')}
              <input type="file" accept="application/pdf" onChange={onFile} className="hidden" />
            </label>
            <button
              type="button"
              onClick={() => contractsActions.toggle(presId)}
              className="cursor-pointer rounded-[10px] px-[15px] py-[9px] text-xs font-bold"
              style={{
                background: signed ? '#FBF4E4' : '#E7F6EE',
                color: signed ? '#B68A2E' : '#178A82',
              }}
            >
              {signed ? t('marquerNonSigne') : t('marquerSigne')}
            </button>
            <button
              type="button"
              onClick={onRemove}
              className="cursor-pointer rounded-[10px] bg-[#FDECEC] px-[15px] py-[9px] text-xs font-bold text-de9-red dark:bg-[#E7464E]/15"
            >
              {t('supprimer')}
            </button>
          </div>
        </div>
      )}

      {!has && (
        <div className="mt-3">
          <div className="mb-2.5 text-[12.5px] text-de9-gray">{t('contratAbsent')}</div>
          <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border-[1.5px] border-dashed border-de9-line p-4">
            <span className="text-[20px]">📎</span>
            <div className="flex-1">
              <div className="text-[13px] font-bold text-de9-slate">{t('televerserContrat')}</div>
              <div className="text-[11px] text-de9-gray">{t('deposerFichier')}</div>
            </div>
            <input type="file" accept="application/pdf" onChange={onFile} className="hidden" />
          </label>
        </div>
      )}
    </div>
  );
}
