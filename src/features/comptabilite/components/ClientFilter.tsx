import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { useT } from '@/lib/i18n';
import { useCreditClient, useCreditClients } from '@/features/credits/api/credits';

const SEARCH_DEBOUNCE_MS = 300;

/**
 * « Client » type-ahead — GET /credits/clients?q= (every client, a new one
 * included). The page keeps only the id; a deep-linked id reads its name back
 * from GET /credits/clients/{id}.
 */
export function ClientFilter({ clientId, onChange }: { clientId: string; onChange: (id: string | null) => void }) {
  const t = useT();
  const [saisie, setSaisie] = useState('');
  const [debounced, setDebounced] = useState('');
  const [focused, setFocused] = useState(false);
  const chosen = useCreditClient(clientId || null);
  const suggestions = useCreditClients(debounced, focused && !clientId);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(saisie.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [saisie]);

  if (clientId) {
    return (
      <div className="inline-flex max-w-[280px] items-center gap-1.5 rounded-sm border border-secondary-container bg-secondary-container py-[7px] ps-3 pe-1.5 text-[12.5px] font-bold text-on-secondary-container">
        <span className="truncate">
          {t('fClient')} : {chosen.data?.nom ?? '…'}
        </span>
        <button
          type="button"
          onClick={() => onChange(null)}
          aria-label={t('comptaClientRetirer')}
          className="flex size-6 flex-none cursor-pointer items-center justify-center rounded-full hover:bg-white/15"
        >
          <X className="size-3.5" />
        </button>
      </div>
    );
  }

  const items = suggestions.data?.items ?? [];
  return (
    <div className="relative w-full sm:w-[240px]">
      <input
        value={saisie}
        onChange={(e) => setSaisie(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={t('comptaClientPh')}
        aria-label={t('fClient')}
        autoComplete="off"
        className="w-full rounded-xs border border-outline bg-card px-3 py-2.5 text-[12.5px] text-de9-ink outline-none"
      />
      {focused && (
        <div className="absolute z-20 mt-1 max-h-64 w-full min-w-[260px] overflow-y-auto rounded-md border border-de9-line bg-card shadow-e2">
          {suggestions.isPending ? (
            <div className="p-3 text-xs text-de9-gray">…</div>
          ) : items.length === 0 ? (
            <div className="p-3 text-xs text-de9-gray">{t('rClientAucun')}</div>
          ) : (
            items.map((it) => (
              <button
                key={it.id}
                type="button"
                // Keep the input focused so the click lands before the list closes.
                onMouseDown={(ev) => ev.preventDefault()}
                onClick={() => {
                  setSaisie('');
                  setFocused(false);
                  onChange(it.id);
                }}
                className="block w-full cursor-pointer px-3.5 py-2.5 text-start hover:bg-secondary"
              >
                <span className="block truncate text-[13px] font-bold text-de9-ink">{it.nom}</span>
                <span className="block truncate text-[11px] text-de9-gray">
                  {[it.nif && `NIF ${it.nif}`, it.email ?? it.wilaya].filter(Boolean).join(' · ')}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
