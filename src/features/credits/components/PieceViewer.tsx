import { toast } from 'sonner';
import { useT } from '@/lib/i18n';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';

export interface PieceView {
  title: string;
  fileName: string;
}

interface PieceViewerProps {
  piece: PieceView;
  onClose: () => void;
}

/** Document preview dialog — title bar + download row + file preview placeholder. */
export function PieceViewer({ piece, onClose }: PieceViewerProps) {
  const t = useT();

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="block max-h-[90vh] w-full max-w-[520px] gap-0 overflow-y-auto rounded-[20px] bg-card p-0 text-de9-ink shadow-[0_30px_70px_rgba(20,30,45,.4)] sm:max-w-[520px]"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-de9-line px-[22px] py-[18px]">
          <DialogTitle className="text-base font-extrabold text-de9-ink">
            {piece.title}
          </DialogTitle>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => toast.success(t('docToastTelechargement'))}
              className="flex cursor-pointer items-center gap-1.5 rounded-[10px] bg-[#232838] px-3.5 py-[9px] text-xs font-bold text-white"
            >
              ⤓ {t('telecharger')}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex size-9 cursor-pointer items-center justify-center rounded-[10px] bg-secondary text-base text-de9-slate"
            >
              ✕
            </button>
          </div>
        </div>
        <div className="p-[22px]">
          <div className="overflow-hidden rounded-xl border border-de9-line shadow-[0_6px_20px_rgba(38,50,69,.06)]">
            <div className="bg-[repeating-linear-gradient(45deg,#F5F7F9,#F5F7F9_12px,#EEF1F4_12px,#EEF1F4_24px)] px-[22px] py-[52px] text-center dark:bg-[repeating-linear-gradient(45deg,#1A1F2B,#1A1F2B_12px,#222939_12px,#222939_24px)]">
              <div className="text-[48px]">📄</div>
              <div className="mt-2.5 text-[13.5px] font-bold text-de9-slate">{piece.fileName}</div>
              <div className="mt-[2px] text-[11px] text-de9-gray">{t('apercu')}</div>
            </div>
          </div>
          <div className="mt-[13px] text-center text-[11px] text-de9-gray">
            {t('donneesAVenir')}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
