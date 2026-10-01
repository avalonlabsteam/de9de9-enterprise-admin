// Tab « Sync » of the company fiche — the company's link to the de9de9 app.
//   state    GET  /admin/companies/{id}/legacy-sync
//   retry    POST /admin/companies/{id}/legacy-sync/retry
//   grant    POST /admin/companies/{id}/b2c/resume
//   revoke   POST /admin/companies/{id}/b2c/suspend   { reason }
// The two b2c routes keep their historical names, but `b2cEnabled` means
// « accès B2C accordé »: the buttons say accorder / retirer, never
// reprendre / suspendre. Each of the three POSTs answers the refreshed state,
// which replaces what the tab shows.
import { useState, type FormEvent, type ReactNode } from 'react';
import { toast } from 'sonner';
import { ArrowRight, RotateCw } from 'lucide-react';
import { useT } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { Glyph } from '@/components/common/Glyph';
import { fmtAlger } from '@/features/comptabilite/lib/comptabilite';
import { reloadLegacySync, useFicheB2c, useLegacySync, useRetryLegacySync } from '../api/acces';
import {
  MOTIF_MAX,
  accesErrorMessage,
  accesProblem,
  kindLabel,
  rowStatut,
  syncStatut,
  tonPill,
  type Translate,
} from '../lib/acces';
import type { OutboxRow } from '../schemas/acces';

const PILL = 'inline-flex items-center rounded-full px-2.5 py-[5px] text-[11px] font-bold';
const BTN = 'cursor-pointer rounded-full px-3.5 py-[9px] text-xs font-bold disabled:cursor-not-allowed disabled:opacity-60';
const BTN_PRIMARY = cn(BTN, 'bg-primary text-primary-foreground');
const BTN_DANGER = cn(BTN, 'bg-de9-red text-white');
const BTN_DANGER_OUTLINE = cn(BTN, 'border border-de9-red bg-card text-de9-red');
const BTN_OUTLINE = cn(BTN, 'border border-de9-line bg-card text-de9-slate');

function SectionLabel({ children }: { children: ReactNode }) {
  return <div className="text-[11px] font-extrabold tracking-[.04em] text-de9-gray uppercase">{children}</div>;
}

/** « 30/09/2026 10:02 », Algiers time, kept in reading order inside Arabic text. */
function When({ iso }: { iso: string | null | undefined }) {
  return <span className="num">{fmtAlger(iso) ?? '—'}</span>;
}

function OutboxList({ rows, t }: { rows: OutboxRow[]; t: Translate }) {
  return (
    <div className="mt-[7px] flex flex-col gap-2">
      {rows.map((row) => {
        const statut = row.status ? rowStatut(row.status, t) : null;
        return (
          <div key={row.id} className="rounded-md border border-de9-line px-3 py-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <div className="text-[12.5px] font-bold text-de9-ink first-letter:uppercase">{kindLabel(row.kind, t)}</div>
              {statut && <span className={cn(PILL, 'px-2 py-[3px] text-[10.5px]', statut.pill)}>{statut.label}</span>}
              {row.attempts != null && (
                <span className="ms-auto text-[11px] text-de9-gray">
                  {t('syncEssais').replace('{n}', String(row.attempts))}
                </span>
              )}
            </div>
            <div className="mt-1 flex flex-wrap gap-x-2 text-[11px] text-de9-gray">
              {row.createdAt && (
                <span>
                  {t('syncCreeLe')} <When iso={row.createdAt} />
                </span>
              )}
              {row.doneAt ? (
                <span>
                  · {t('syncClosLe')} <When iso={row.doneAt} />
                </span>
              ) : row.nextAttemptAt ? (
                <span>
                  · {t('syncProchainEssai')} <When iso={row.nextAttemptAt} />
                </span>
              ) : null}
            </div>
            {row.lastError && (
              <div
                dir="auto"
                className="mt-1.5 rounded-sm bg-[#FDECEC] px-2.5 py-2 font-mono text-[11px] leading-snug break-words text-de9-red ltr:text-left rtl:text-right dark:bg-[#E7464E]/15"
              >
                {row.lastError}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

interface SyncPanelProps {
  companyId: string;
  /** The company's name, for the questions asked before granting or revoking. */
  nom: string;
  /** « Ouvrir dans Accès » — the list, filtered on this company. */
  onOpenAcces: () => void;
}

export function SyncPanel({ companyId, nom, onOpenAcces }: SyncPanelProps) {
  const t = useT();
  const syncQ = useLegacySync(companyId);
  const retry = useRetryLegacySync();
  const b2c = useFicheB2c();
  // The question on screen: none, grant (no body) or revoke (its motif).
  const [asking, setAsking] = useState<'accorder' | 'retirer' | null>(null);
  const [motif, setMotif] = useState('');
  const [motifError, setMotifError] = useState<string | null>(null);

  const reset = (): void => {
    setAsking(null);
    setMotif('');
    setMotifError(null);
  };

  /** A colleague or the sync worker changed the company, or it is gone: what the tab shows is stale. */
  const reloadIfStale = (err: unknown): void => {
    const { status } = accesProblem(err);
    if (status === 404 || status === 409) reloadLegacySync(companyId);
  };

  const onRetry = (): void => {
    retry.mutate(companyId, {
      onSuccess: () => toast.success(t('accesSyncRelancee')),
      onError: (err) => {
        toast.error(accesErrorMessage(err, t));
        reloadIfStale(err);
      },
    });
  };

  const submit = (e: FormEvent): void => {
    e.preventDefault();
    if (!asking || b2c.isPending) return;
    const accorder = asking === 'accorder';
    const text = motif.trim();
    if (!accorder && !text) return;
    b2c.mutate(
      { companyId, accorder, motif: text },
      {
        onSuccess: () => {
          toast.success(t(accorder ? 'syncAccesAccorde' : 'syncAccesRetire'));
          reset();
        },
        onError: (err) => {
          const p = accesProblem(err);
          // 400: nothing changed, the reason goes under the motif (`field: reason`).
          if (!accorder && p.status === 400 && (!p.field || p.field.toLowerCase() === 'reason')) {
            setMotifError(accesErrorMessage(err, t));
            return;
          }
          toast.error(accesErrorMessage(err, t));
          reloadIfStale(err);
        },
      },
    );
  };

  if (syncQ.isPending) {
    return (
      <div className="flex flex-col gap-[9px]">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-[58px] animate-pulse rounded-md bg-secondary" />
        ))}
      </div>
    );
  }

  if (syncQ.isError) {
    return (
      <div className="rounded-md bg-[#FDECEC] px-3.5 py-3 text-[12.5px] font-bold text-de9-red dark:bg-[#E7464E]/15">
        {t('syncErreurChargement')} — {accesErrorMessage(syncQ.error, t)}
      </div>
    );
  }

  const sync = syncQ.data;
  const accorde = sync.b2cEnabled === true;
  const failed = sync.failedOutbox ?? [];
  const waiting = sync.pendingOutbox ?? [];
  const statut = sync.status ? syncStatut(sync.status, t) : null;
  // Without the access and with nothing queued or failed, the server has nothing to relaunch (409).
  const canRetry = accorde || failed.length > 0 || waiting.length > 0 || sync.status === 'Failed';
  const [titleBefore, titleAfter = ''] = t(asking === 'retirer' ? 'accesRetirerTitre1' : 'accesAccorderTitre1').split('{nom}');

  return (
    <div className="flex flex-col gap-4">
      {/* ---------- the access ---------- */}
      <div className="rounded-md border border-de9-line p-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div>
            <SectionLabel>{t('accesColB2c')}</SectionLabel>
            <span className={cn(PILL, 'mt-[7px]', tonPill(accorde ? 'succes' : 'neutre'))}>
              {t(accorde ? 'syncAccorde' : 'syncNonAccorde')}
            </span>
          </div>
          {!asking &&
            (accorde ? (
              <button type="button" onClick={() => setAsking('retirer')} className={BTN_DANGER_OUTLINE}>
                {t('accesRetirerB2c')}
              </button>
            ) : (
              <button type="button" onClick={() => setAsking('accorder')} className={BTN_PRIMARY}>
                {t('accesAccorderB2c')}
              </button>
            ))}
        </div>

        {asking && (
          <form onSubmit={submit} noValidate className="mt-3.5 border-t border-de9-line pt-3.5">
            <div className="text-[13.5px] font-extrabold text-de9-ink">
              {titleBefore}
              <bdi>{nom}</bdi>
              {titleAfter}
            </div>
            <div className="mt-1.5 text-[12.5px] leading-relaxed text-de9-slate">
              {t(asking === 'retirer' ? 'accesRetirerTexte1' : 'accesAccorderTexte1')}
            </div>

            {asking === 'retirer' && (
              <>
                <label className="mt-3 block">
                  <span className="mb-1.5 block text-xs font-semibold text-de9-slate">{t('accesMotifObligatoire')}</span>
                  <textarea
                    value={motif}
                    onChange={(e) => {
                      setMotif(e.target.value);
                      if (motifError) setMotifError(null);
                    }}
                    maxLength={MOTIF_MAX}
                    rows={3}
                    autoFocus
                    disabled={b2c.isPending}
                    aria-invalid={!!motifError}
                    className={cn(
                      'w-full resize-y rounded-xs border bg-card px-3.5 py-2.5 text-[13px] text-de9-ink outline-none disabled:opacity-60',
                      motifError ? 'border-de9-red' : 'border-outline focus:border-de9-teal',
                    )}
                  />
                </label>
                <div className="mt-1 flex justify-between gap-3 text-[11.5px]">
                  {motifError ? (
                    <span role="alert" className="font-semibold text-de9-red">
                      {motifError}
                    </span>
                  ) : (
                    <span className="text-de9-gray">{t('accesMotifEnvoye')}</span>
                  )}
                  <span className="num flex-none text-de9-gray">
                    {motif.trim().length} / {MOTIF_MAX}
                  </span>
                </div>
              </>
            )}

            <div className="mt-3.5 flex flex-wrap justify-end gap-2">
              <button type="button" onClick={reset} disabled={b2c.isPending} className={BTN_OUTLINE}>
                {t('annuler')}
              </button>
              <button
                type="submit"
                disabled={b2c.isPending || (asking === 'retirer' && !motif.trim())}
                className={asking === 'retirer' ? BTN_DANGER : BTN_PRIMARY}
              >
                {b2c.isPending
                  ? t('accesTraitement')
                  : t(asking === 'retirer' ? 'accesRetirerConfirm' : 'accesAccorderConfirm')}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* ---------- the de9de9 app account ---------- */}
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <SectionLabel>{t('syncCompte')}</SectionLabel>
          {canRetry && (
            <button type="button" onClick={onRetry} disabled={retry.isPending} className={BTN_OUTLINE}>
              <Glyph icon={RotateCw} className={cn(retry.isPending && 'animate-spin')} /> {t('accesRelancer')}
            </button>
          )}
        </div>
        <div className="mt-[7px] flex flex-wrap items-center gap-2">
          {statut && <span className={cn(PILL, statut.pill)}>{statut.label}</span>}
          {sync.legacyUserId != null && sync.legacyUserId !== '' ? (
            <span dir="ltr" className="font-mono text-[11.5px] break-all text-de9-slate">
              {String(sync.legacyUserId)}
            </span>
          ) : (
            <span className="text-[12px] text-de9-gray">{t('syncCompteAbsent')}</span>
          )}
        </div>
        {sync.error && (
          <div className="mt-2.5">
            <div className="text-[11px] font-semibold text-de9-gray">{t('syncErreur')}</div>
            <div
              dir="auto"
              className="mt-1 rounded-sm bg-[#FDECEC] px-2.5 py-2 font-mono text-[11px] leading-snug break-words text-de9-red ltr:text-left rtl:text-right dark:bg-[#E7464E]/15"
            >
              {sync.error}
            </div>
          </div>
        )}
      </div>

      {/* ---------- refused for their content, newest first ---------- */}
      {failed.length > 0 && (
        <div>
          <SectionLabel>
            {t('syncEchecs')} · <span className="num">{failed.length}</span>
          </SectionLabel>
          <OutboxList rows={failed} t={t} />
        </div>
      )}

      {/* ---------- still to send, oldest first ---------- */}
      <div>
        <SectionLabel>
          {t('syncEnFile')}
          {waiting.length > 0 && (
            <>
              {' · '}
              <span className="num">{waiting.length}</span>
            </>
          )}
        </SectionLabel>
        {waiting.length > 0 ? (
          <OutboxList rows={waiting} t={t} />
        ) : (
          <div className="mt-[7px] text-[12.5px] text-de9-gray">{t('syncAucunEnvoi')}</div>
        )}
      </div>

      {/* ---------- one warning per line: an annonce left out, the rest of the catalogue sent ---------- */}
      {sync.catalogueWarnings?.trim() && (
        <div>
          <SectionLabel>{t('syncAvertissements')}</SectionLabel>
          <div
            dir="auto"
            className="mt-[7px] rounded-md bg-[#FBF4E4] px-3.5 py-3 text-[12px] leading-relaxed whitespace-pre-line text-[#92702A] ltr:text-left rtl:text-right dark:bg-[#B68A2E]/15 dark:text-[#D9B36A]"
          >
            {sync.catalogueWarnings.trim()}
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={onOpenAcces}
        className="cursor-pointer self-start text-[12.5px] font-bold text-de9-teal-dark hover:underline"
      >
        {t('syncOuvrirAcces')} <Glyph icon={ArrowRight} className="rtl:rotate-180" />
      </button>
    </div>
  );
}
