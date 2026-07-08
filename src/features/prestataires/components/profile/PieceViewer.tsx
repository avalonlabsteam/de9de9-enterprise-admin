// Piece / document viewer overlay — ported from src/admin/views/RechargeAndPiece.tsx (PieceViewer).
import { Dialog as DialogPrimitive } from 'radix-ui';
import { toast } from 'sonner';
import { Dialog, DialogOverlay, DialogPortal, DialogTitle } from '@/components/ui/dialog';
import { useT } from '@/lib/i18n';

export interface PieceView {
  title: string;
  fileName: string;
}

export function PieceViewer({ piece, onClose }: { piece: PieceView | null; onClose: () => void }) {
  const t = useT();
  return (
    <Dialog
      open={!!piece}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogPortal>
        <DialogOverlay className="z-[98] animate-fade-in bg-[rgba(20,28,40,.5)] supports-backdrop-filter:backdrop-blur-none" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className="fixed start-1/2 top-1/2 z-[98] max-h-[90vh] w-full max-w-[calc(100%-24px)] -translate-x-1/2 -translate-y-1/2 animate-sheet-up overflow-y-auto rounded-[20px] bg-card text-de9-ink shadow-[0_30px_70px_rgba(20,30,45,.4)] outline-none sm:w-[calc(100%-48px)] sm:max-w-[520px] rtl:translate-x-1/2"
        >
          {piece && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-de9-line px-4 py-[18px] sm:px-[22px]">
                <DialogTitle className="text-[16px] leading-normal font-extrabold text-de9-ink">
                  {piece.title}
                </DialogTitle>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => toast.success(t('docToastTelechargement'))}
                    className="flex cursor-pointer items-center gap-1.5 rounded-[10px] bg-de9-ink px-3.5 py-[9px] text-xs font-bold text-white dark:text-[#151923]"
                  >
                    ⤓ {t('telecharger')}
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-[10px] bg-secondary text-base text-de9-slate"
                  >
                    ✕
                  </button>
                </div>
              </div>
              <div className="p-4 sm:p-[22px]">
                <div className="overflow-hidden rounded-xl border border-de9-line shadow-[0_6px_20px_rgba(38,50,69,.06)]">
                  <div className="bg-[repeating-linear-gradient(45deg,#F5F7F9,#F5F7F9_12px,#EEF1F4_12px,#EEF1F4_24px)] px-[22px] py-[52px] text-center dark:bg-[repeating-linear-gradient(45deg,#262C3B,#262C3B_12px,#2C3345_12px,#2C3345_24px)]">
                    <div className="text-[48px]">📄</div>
                    <div className="mt-2.5 text-[13.5px] font-bold text-de9-slate">{piece.fileName}</div>
                    <div className="mt-[2px] text-[11px] text-de9-gray">{t('apercu')}</div>
                  </div>
                </div>
                <div className="mt-[13px] text-center text-[11px] text-de9-gray">{t('donneesAVenir')}</div>
              </div>
            </>
          )}
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}
