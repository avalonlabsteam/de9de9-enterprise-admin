// Worker fiche overlay — visual ground truth: WorkerView in
// src/admin/views/WorkerSalarieSelection.tsx. Opened by the search param
// `?worker=<name>` (survives navigation, per the blueprint's overlay convention);
// missions are derived from the commandes whose occurrences reference the worker
// (logic.ts renderVals workerVM). Self-contained — mounted globally by the layout.
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useT } from '@/lib/i18n';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { useCommandes } from '../../api/commandes';

export function WorkerViewHost() {
  const t = useT();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const worker = searchParams.get('worker');
  const open = worker !== null && worker !== '';
  const { data: cmds } = useCommandes();

  const missions = open
    ? (cmds ?? []).filter((c) => c.occurrences.some((o) => o.ouvrier === worker))
    : [];

  const close = (): void => {
    const sp = new URLSearchParams(searchParams);
    sp.delete('worker');
    setSearchParams(sp);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) close();
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="block max-h-[88vh] w-full max-w-[calc(100%-2rem)] gap-0 overflow-y-auto rounded-[20px] bg-card px-6 pb-[22px] pt-6 text-de9-ink shadow-[0_30px_70px_rgba(20,30,45,.4)] ring-0 sm:max-w-[420px]"
      >
        <div className="flex items-center gap-[13px]">
          <div className="flex h-[52px] w-[52px] flex-none items-center justify-center rounded-[14px] bg-[#232838] text-xl font-extrabold text-white">
            {(worker ?? '').slice(0, 1)}
          </div>
          <div>
            <DialogTitle className="text-lg font-extrabold leading-normal text-de9-ink">{worker}</DialogTitle>
            <div className="text-xs text-de9-gray">{t('ficheOuvrier')}</div>
          </div>
        </div>

        <div className="mt-4 text-[11px] font-extrabold uppercase tracking-[.04em] text-de9-gray">
          {t('missionsAffectees')} ({missions.length})
        </div>
        <div className="mt-[9px] flex flex-col gap-2">
          {missions.map((c) => (
            <div
              key={c.id}
              onClick={() => navigate('/commandes/' + c.id)}
              className="flex cursor-pointer items-center gap-2.5 rounded-xl border-[1.5px] border-de9-line px-[13px] py-[11px]"
            >
              <div className="min-w-0 flex-1">
                <div className="text-[12.5px] font-bold">
                  {c.id} · {c.service}
                </div>
                <div className="text-[11px] text-de9-gray">
                  {c.client} · {c.prestataire ? c.prestataire.name : '—'}
                </div>
              </div>
              <span className="text-sm text-[#C2CAD3]">›</span>
            </div>
          ))}
          {missions.length === 0 && (
            <div className="p-3.5 text-center text-[12.5px] text-[#B0B8C2]">{t('aucuneDonnee')}</div>
          )}
        </div>

        <button
          type="button"
          onClick={close}
          className="mt-[18px] w-full cursor-pointer rounded-[13px] bg-[#232838] p-[13px] text-center text-[13.5px] font-bold text-white"
        >
          {t('btnClose')}
        </button>
      </DialogContent>
    </Dialog>
  );
}
