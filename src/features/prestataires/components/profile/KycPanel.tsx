// KYC tab of the prestataire profile — ported from src/admin/views/PresProfile.tsx (tKyc)
// and logic.ts buildKycVM / setKycStatus / setKycMotif / addKycDoc / replaceKycDoc / removeKycDoc.
//
// Status, pieces and the review event come from GET /prestataires/{companyId}
// (dossier.kyc). Nothing here is writable server-side, so every edit — status,
// motif, adding / replacing / removing a piece — is a local overlay the host
// keeps, exactly as the prototype did.
import type { ChangeEvent } from 'react';
import { cn } from '@/lib/utils';
import { Textarea } from '@/components/ui/textarea';
import { useT } from '@/lib/i18n';
import type { KycAuditEntry, KycDoc, KycStatus } from '../../schemas/prestataire';
import { kycMeta } from './lib';

const STATUSES: KycStatus[] = ['verified', 'pending', 'rejected'];

interface KycPanelProps {
  status: KycStatus;
  motif: string;
  docs: KycDoc[];
  audit: KycAuditEntry[];
  onStatusChange: (status: KycStatus) => void;
  onMotifChange: (motif: string) => void;
  onAddDoc: (label: string, fileName: string) => void;
  onReplaceDoc: (docId: string, fileName: string) => void;
  onRemoveDoc: (docId: string) => void;
  onOpenPiece: (title: string, fileName: string) => void;
}

export function KycPanel({
  status,
  motif,
  docs,
  audit,
  onStatusChange,
  onMotifChange,
  onAddDoc,
  onReplaceDoc,
  onRemoveDoc,
  onOpenPiece,
}: KycPanelProps) {
  const t = useT();
  const meta = kycMeta(status, t);

  const onAddFile = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    onAddDoc(f.name.replace(/\.[^.]+$/, ''), f.name);
    e.target.value = '';
  };

  const onReplaceFile = (docId: string) => (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    onReplaceDoc(docId, f.name);
    e.target.value = '';
  };

  return (
    <div className="flex flex-col gap-3.5">
      {/* current status chip */}
      <span
        className="inline-flex items-center gap-1.5 self-start rounded-full px-3 py-1.5 text-xs font-extrabold"
        style={{ background: meta.bg, color: meta.fg }}
      >
        {meta.icon} {meta.label}
      </span>

      {/* change status */}
      <div>
        <div className="mb-[7px] text-[11px] font-extrabold tracking-[.04em] text-de9-gray uppercase">
          {t('kycChangeStatut')}
        </div>
        <div className="flex flex-wrap gap-[7px]">
          {STATUSES.map((st) => {
            const active = status === st;
            return (
              <button
                key={st}
                type="button"
                onClick={() => onStatusChange(st)}
                className={cn(
                  'cursor-pointer rounded-[10px] border-[1.5px] px-3.5 py-[9px] text-xs font-bold',
                  active
                    ? 'border-de9-ink bg-de9-ink text-white dark:text-[#151923]'
                    : 'border-de9-line bg-card text-de9-slate',
                )}
              >
                {kycMeta(st, t).label}
              </button>
            );
          })}
        </div>
        <Textarea
          value={motif}
          onChange={(e) => onMotifChange(e.target.value)}
          placeholder={t('kycMotif')}
          className="mt-[9px] min-h-[52px] w-full resize-y rounded-xl border-[1.5px] border-de9-line bg-card px-[13px] py-[11px] text-[13px] text-de9-ink shadow-none outline-none focus-visible:ring-0 focus-visible:border-de9-line md:text-[13px]"
        />
      </div>

      {/* documents */}
      <div>
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="text-[11px] font-extrabold tracking-[.04em] text-de9-gray uppercase">
            {t('kycDocs')}
          </div>
          <label className="cursor-pointer rounded-[9px] bg-[#E5F7F4] px-3 py-[7px] text-[11.5px] font-bold text-de9-teal-dark dark:bg-[#178A82]/15">
            ＋ {t('kycAjouterDoc')}
            <input type="file" accept="image/*,application/pdf" onChange={onAddFile} className="hidden" />
          </label>
        </div>
        <div className="flex flex-col gap-2">
          {docs.map((kd) => (
            <div
              key={kd.id}
              className="flex items-center gap-[9px] rounded-xl border-[1.5px] border-de9-line px-3 py-2.5"
            >
              <span className="flex-none text-[17px]">📄</span>
              <div className="min-w-0 flex-1">
                <div className="text-[12.5px] font-bold text-de9-ink">{kd.label}</div>
                <div className="truncate text-[10.5px] text-de9-gray">{kd.name}</div>
              </div>
              <button
                type="button"
                onClick={() => onOpenPiece(kd.label, kd.name)}
                className="flex-none cursor-pointer rounded-[9px] bg-de9-ink px-2.5 py-[7px] text-[11px] font-bold text-white dark:text-[#151923]"
              >
                {t('voir')}
              </button>
              <label className="flex-none cursor-pointer rounded-[9px] bg-secondary px-2.5 py-[7px] text-[11px] font-bold text-de9-slate">
                {t('remplacer')}
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={onReplaceFile(kd.id)}
                  className="hidden"
                />
              </label>
              <button
                type="button"
                onClick={() => onRemoveDoc(kd.id)}
                className="flex-none cursor-pointer text-[14px] text-de9-gray"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* journal */}
      {audit.length > 0 && (
        <div>
          <div className="mb-[7px] text-[11px] font-extrabold tracking-[.04em] text-de9-gray uppercase">
            {t('kycJournal')}
          </div>
          <div className="flex flex-col gap-2">
            {audit.map((ka, i) => (
              <div key={i} className="flex items-start gap-[9px]">
                <div className="flex h-[26px] w-[26px] flex-none items-center justify-center rounded-full bg-de9-ink text-[11px] font-bold text-white dark:text-[#151923]">
                  {(ka.who || '?').slice(0, 1)}
                </div>
                <div className="flex-1">
                  <div className="text-xs text-de9-ink">
                    <b>{ka.who}</b> · {ka.action}
                  </div>
                  <div className="text-[10.5px] text-de9-gray">{ka.date}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
