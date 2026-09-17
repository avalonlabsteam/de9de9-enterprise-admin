// Internal notes modal (commerciaux), backed by the live worklist routes:
//   GET    /commandes/worklist/{id}/notes
//   POST   /commandes/worklist/{id}/notes        { body, auteurNom }
//   DELETE /commandes/worklist/{id}/notes/{noteId}
// Visual ground truth: NotesModal in src/admin/views/ReviewAndNotes.tsx.
//
// Two deliberate differences from the mock console version this replaces:
//  - the header no longer reads the commande (GET /commandes/{id} is contract
//    keyed and 404s for worklist ids), so it shows the row id;
//  - `aFaire` is rendered but not toggleable: the API documents create, list
//    and delete only, so a checkbox here would post to nothing.
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { useT, useL } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { problemMessage } from '@/api/problem';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Field, FieldError } from '@/components/ui/field';
import { useWorklistNotes, useAddWorklistNote, useDeleteWorklistNote } from '../api/commandes';
import { worklistNoteInputSchema, type WorklistNoteInput } from '../schemas/worklistDetail';

interface NotesModalProps {
  commandeId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** ISO 8601 → 'dd/mm/yyyy · hh:mm', the stamp the rest of the console uses. */
function stamp(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number): string => n.toString().padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} · ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function NotesModal({ commandeId, open, onOpenChange }: NotesModalProps) {
  const t = useT();
  const l = useL();
  const id = commandeId ?? '';
  // Only fetch while the modal is open — the table renders a row per commande.
  const notesQ = useWorklistNotes(id, open);
  const addNote = useAddWorklistNote(id);
  const deleteNote = useDeleteWorklistNote(id);

  const form = useForm<WorklistNoteInput>({
    resolver: zodResolver(worklistNoteInputSchema),
    defaultValues: { body: '' },
  });

  const onSubmit = async (values: WorklistNoteInput): Promise<void> => {
    const body = values.body.trim();
    if (!body) return;
    try {
      // `auteurNom` is left out: the API knows who is calling from the token.
      await addNote.mutateAsync({ body });
      form.reset({ body: '' });
      toast.success(t('noteAjouteeOk'));
    } catch (err) {
      toast.error(problemMessage(err));
    }
  };

  const removeNote = (noteId: string): void => {
    deleteNote.mutate(noteId, {
      onSuccess: () => toast.success(t('noteSupprimeeOk')),
      onError: (err) => toast.error(problemMessage(err)),
    });
  };

  const notes = notesQ.data?.notes ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="block max-h-[90vh] w-full max-w-[calc(100%-2rem)] gap-0 overflow-y-auto rounded-[22px] bg-card p-[26px] text-de9-ink shadow-[0_30px_70px_rgba(20,30,45,.4)] ring-0 sm:max-w-[480px]"
      >
        <div className="flex items-center gap-[13px]">
          <div className="flex h-[50px] w-[50px] flex-none items-center justify-center rounded-[14px] bg-[#F4EFFB] text-2xl dark:bg-[#7C57C7]/15">
            💬
          </div>
          <div className="min-w-0">
            <DialogTitle className="text-lg font-extrabold">{t('notesTitle')}</DialogTitle>
            <div className="truncate text-[12.5px] font-normal text-de9-gray">
              {id}
              {notesQ.data ? ' · ' + notesQ.data.count : ''}
            </div>
          </div>
        </div>
        <div className="mt-2.5 text-[11.5px] font-bold text-[#B6BEC8]">🔒 {t('notesSub')}</div>

        <div className="mt-4 flex flex-col gap-[11px]">
          {notesQ.isPending && open && (
            <div className="p-[18px] text-center text-[13px] text-[#B6BEC8]">{t('apercuActionEnCours')}</div>
          )}
          {notesQ.isError && (
            <div className="p-[18px] text-center text-[13px] font-semibold text-de9-red">
              {problemMessage(notesQ.error)}
            </div>
          )}
          {!notesQ.isPending && !notesQ.isError && notes.length === 0 && (
            <div className="p-[18px] text-center text-[13px] text-[#B6BEC8]">{t('notesEmpty')}</div>
          )}
          {notes.map((n) => (
            <div key={n.id} className="flex items-start gap-[11px]">
              <div className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-[#232838] text-xs font-bold text-white">
                {(n.authorDisplayName || '?').slice(0, 1).toUpperCase()}
              </div>
              <div className="flex-1 rounded-[13px] border border-de9-line bg-secondary px-[13px] py-[11px]">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-[12.5px] font-bold text-de9-ink">{n.authorDisplayName}</span>
                  <span className="flex-none text-[10.5px] text-[#B0B8C2]">{stamp(n.createdAt)}</span>
                </div>
                <div className="mt-1 whitespace-pre-wrap text-[13px] leading-[1.45] text-de9-slate">{n.body}</div>
                <div className="mt-2 flex items-center justify-between gap-2">
                  {/* Read-only: no endpoint flips this flag. */}
                  <span
                    className={cn(
                      'text-[11px] font-bold',
                      n.aFaire ? 'text-de9-gray' : 'text-[#2FA86A] dark:text-[#6FCF97]',
                    )}
                  >
                    {n.aFaire ? '○ ' + t('worklistAFaire') : '✓ ' + t('worklistTraite')}
                  </span>
                  <button
                    type="button"
                    disabled={deleteNote.isPending}
                    onClick={() => removeNote(n.id)}
                    className="cursor-pointer text-[11px] font-bold text-de9-red disabled:opacity-50"
                  >
                    {t('noteSupprimer')}
                  </button>
                </div>
              </div>
            </div>
          ))}
          {notesQ.data?.truncated && (
            <div className="text-center text-[11px] font-semibold text-de9-gray">{t('notesTronquees')}</div>
          )}
        </div>

        <form onSubmit={form.handleSubmit(onSubmit)}>
          <Field className="gap-0">
            <Textarea
              {...form.register('body')}
              placeholder={t('notesPh')}
              aria-invalid={!!form.formState.errors.body}
              className="mt-4 min-h-[74px] w-full resize-y rounded-xl border-[1.5px] border-de9-line bg-card px-3.5 py-3 text-[13.5px] text-de9-ink shadow-none md:text-[13.5px]"
            />
            <div className="min-h-[18px] pt-0.5">
              {form.formState.errors.body && (
                <FieldError className="text-[11.5px] font-semibold text-de9-red">
                  {l('La note ne peut pas être vide', 'لا يمكن أن تكون الملاحظة فارغة')}
                </FieldError>
              )}
            </div>
          </Field>
          <div className="mt-1.5 flex gap-[11px]">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              className="h-auto flex-1 rounded-[13px] bg-secondary p-3.5 text-center text-sm font-bold text-de9-slate hover:bg-de9-bg hover:text-de9-slate"
            >
              {t('fermer')}
            </Button>
            <Button
              type="submit"
              disabled={form.formState.isSubmitting || addNote.isPending}
              className="h-auto flex-1 rounded-[13px] bg-[#7C57C7] p-3.5 text-center text-sm font-bold text-white shadow-[0_10px_22px_rgba(124,87,199,.4)] hover:bg-[#6C49B5] disabled:opacity-70"
            >
              {t('ajouterNote')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
