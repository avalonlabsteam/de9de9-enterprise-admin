// KYC tab of a profile that is not a live company (the offline mock): what
// GET /prestataires/{id} holds under dossier.kyc, read-only. A live company's
// tab is the real dossier, decided piece by piece — features/kyc/components/
// KycDossierPanel. Nothing here decides anything: the old « Changer le statut »
// switch only ever changed this screen.
import { FileText } from 'lucide-react';
import { Glyph } from '@/components/common/Glyph';
import { useT } from '@/lib/i18n';
import { docStatutLabel, docTone } from '@/features/kyc/lib/kyc';
import { StatusPill } from '@/features/kyc/components/shared';
import type { KycView } from './fromFiche';
import { kycMeta } from './lib';

interface KycPanelProps {
  kyc: KycView;
  onOpenPiece: (title: string, fileName: string, documentId?: string | null) => void;
}

export function KycPanel({ kyc, onOpenPiece }: KycPanelProps) {
  const t = useT();
  const meta = kycMeta(kyc.status, t);

  return (
    <div className="flex flex-col gap-3.5">
      <span
        className="inline-flex items-center gap-1.5 self-start rounded-full px-3 py-1.5 text-xs font-extrabold tone-chip"
        style={{ background: meta.bg, color: meta.fg }}
      >
        <Glyph icon={meta.icon} /> {meta.label}
      </span>

      {kyc.status === 'rejected' && kyc.motif && (
        <div className="rounded-md border border-[#F3C9CB] bg-[#FDECEC] px-3.5 py-2.5 dark:border-[#E7464E]/40 dark:bg-[#E7464E]/15">
          <div className="text-[10.5px] font-extrabold tracking-[.04em] text-de9-red uppercase">{t('kycMotifEnvoye')}</div>
          <div dir="auto" className="mt-1 text-[12.5px] leading-[1.5] text-de9-ink">
            {kyc.motif}
          </div>
        </div>
      )}

      <div>
        <div className="mb-2 text-[11px] font-extrabold tracking-[.04em] text-de9-gray uppercase">{t('kycDocs')}</div>
        <div className="flex flex-col gap-2">
          {kyc.docs.map((kd) => (
            <div key={kd.id} className="flex items-center gap-[9px] rounded-md border border-de9-line px-3 py-2.5">
              <span className="flex-none text-[17px]">
                <Glyph icon={FileText} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-[12.5px] font-bold text-de9-ink">{kd.label}</div>
                <div className="truncate text-[10.5px] text-de9-gray">{kd.name}</div>
              </div>
              {kd.statut && (
                <StatusPill
                  tone={docTone(kd.statut)}
                  label={docStatutLabel(kd.statut, null, t)}
                  className="px-2 py-[3px] text-[10.5px]"
                />
              )}
              <button
                type="button"
                onClick={() => onOpenPiece(kd.label, kd.name, kd.id)}
                className="flex-none cursor-pointer rounded-full bg-primary px-2.5 py-[7px] text-[11px] font-bold text-primary-foreground"
              >
                {t('voir')}
              </button>
            </div>
          ))}
        </div>
      </div>

      {kyc.audit.length > 0 && (
        <div className="flex flex-col gap-2">
          {kyc.audit.map((ka, i) => (
            <div key={i} className="text-[11.5px] text-de9-gray">
              <b className="font-bold text-de9-slate">{ka.who}</b> · {ka.action} · {ka.date}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
