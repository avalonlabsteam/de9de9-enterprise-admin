// Internal notes modal (commerciaux). Visual ground truth: NotesModal in
// src/admin/views/ReviewAndNotes.tsx; add-note behavior from logic.ts addNote,
// per-note handled toggle from toggleHandled (POST /commandes/:id/notes/:index/handled).
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useT, useL } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Field, FieldError } from '@/components/ui/field';
import { useCommande, useAddNote, useToggleNoteHandled } from '../api/commandes';
import { noteInputSchema, type NoteInput } from '../schemas/commande';

interface NotesModalProps {
  commandeId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NotesModal({ commandeId, open, onOpenChange }: NotesModalProps) {
  const t = useT();
  const l = useL();
  const id = commandeId ?? '';
  const { data: commande } = useCommande(id);
  const addNote = useAddNote(id);
  const toggleHandled = useToggleNoteHandled(id);

  const form = useForm<NoteInput>({
    resolver: zodResolver(noteInputSchema),
    defaultValues: { text: '' },
  });

  const onSubmit = async (values: NoteInput): Promise<void> => {
    if (!values.text.trim()) return;
    await addNote.mutateAsync({ text: values.text.trim() });
    form.reset({ text: '' });
  };

  const notes = commande?.notes ?? [];

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
          <div>
            <DialogTitle className="text-lg font-extrabold">{t('notesTitle')}</DialogTitle>
            <div className="text-[12.5px] font-normal text-de9-gray">
              {commande ? commande.id + ' · ' + commande.client : id}
            </div>
          </div>
        </div>
        <div className="mt-2.5 text-[11.5px] font-bold text-[#B6BEC8]">🔒 {t('notesSub')}</div>

        <div className="mt-4 flex flex-col gap-[11px]">
          {notes.length === 0 && (
            <div className="p-[18px] text-center text-[13px] text-[#B6BEC8]">{t('notesEmpty')}</div>
          )}
          {notes.map((n, i) => (
            <div key={i} className="flex items-start gap-[11px]">
              <div className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-[#232838] text-xs font-bold text-white">
                {(n.author || '?').slice(0, 1).toUpperCase()}
              </div>
              <div className="flex-1 rounded-[13px] border border-de9-line bg-secondary px-[13px] py-[11px]">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[12.5px] font-bold text-de9-ink">{n.author}</span>
                  <span className="text-[10.5px] text-[#B0B8C2]">{n.date}</span>
                </div>
                <div className="mt-1 text-[13px] leading-[1.45] text-de9-slate">{n.text}</div>
                <button
                  type="button"
                  disabled={toggleHandled.isPending}
                  onClick={() => toggleHandled.mutate(i)}
                  className="mt-2 flex cursor-pointer items-center gap-1.5 disabled:opacity-60"
                >
                  <span
                    className={cn(
                      'flex h-4 w-4 flex-none items-center justify-center rounded-[5px] border-[1.8px] text-[10px] text-white',
                      n.handled ? 'border-[#2FA86A] bg-[#2FA86A]' : 'border-[#D7DEE4] bg-card dark:border-[#3A4459]',
                    )}
                  >
                    {n.handled ? '✓' : ''}
                  </span>
                  <span
                    className={cn(
                      'text-[11px] font-bold',
                      n.handled ? 'text-[#2FA86A] dark:text-[#6FCF97]' : 'text-de9-gray',
                    )}
                  >
                    {n.handled ? t('worklistTraite') : t('worklistAFaire')}
                  </span>
                </button>
              </div>
            </div>
          ))}
        </div>

        <form onSubmit={form.handleSubmit(onSubmit)}>
          <Field className="gap-0">
            <Textarea
              {...form.register('text')}
              placeholder={t('notesPh')}
              aria-invalid={!!form.formState.errors.text}
              className="mt-4 min-h-[74px] w-full resize-y rounded-xl border-[1.5px] border-de9-line bg-card px-3.5 py-3 text-[13.5px] text-de9-ink shadow-none md:text-[13.5px]"
            />
            <div className="min-h-[18px] pt-0.5">
              {form.formState.errors.text && (
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
              disabled={form.formState.isSubmitting}
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
