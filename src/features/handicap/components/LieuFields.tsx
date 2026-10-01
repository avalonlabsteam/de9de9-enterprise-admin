// Wilaya + commune of a demande or of a person, taken from the geo dictionary
// so both sides of a placement carry the same words — the lists filter on the
// exact name. Lives inside a react-hook-form <FormProvider>.
import { Controller, useFormContext, useWatch } from 'react-hook-form';
import { useL, useT } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { useCommunes, useWilayas } from '@/features/geo/api/geo';
import { INPUT_CLS } from '../lib/handicap';
import { FormField } from './shared';

interface LieuValues {
  wilaya: string;
  commune: string;
}

export function LieuFields() {
  const t = useT();
  const L = useL();
  const { control, setValue } = useFormContext<LieuValues>();
  const wilaya = useWatch({ control, name: 'wilaya' });
  const commune = useWatch({ control, name: 'commune' });

  const { data: wilayas } = useWilayas();
  const code = wilayas?.find((w) => w.nom === wilaya)?.code ?? null;
  const { data: communes } = useCommunes(code);

  // A value the dictionary does not list (still loading, or typed elsewhere)
  // stays selectable, so saving the form does not silently drop it.
  const wilayaListed = (wilayas ?? []).some((w) => w.nom === wilaya);
  const communeListed = (communes ?? []).some((c) => c.nom === commune);

  // Both selects are controlled: their options arrive after the form (the
  // communes on demand), and an uncontrolled <select> would fall back to its
  // first option meanwhile.
  return (
    <>
      <FormField label={t('fWilaya')}>
        <Controller
          control={control}
          name="wilaya"
          render={({ field }) => (
            <select
              ref={field.ref}
              name={field.name}
              value={field.value}
              onBlur={field.onBlur}
              onChange={(e) => {
                field.onChange(e.target.value);
                setValue('commune', '', { shouldDirty: true });
              }}
              className={INPUT_CLS}
            >
              <option value="">—</option>
              {field.value && !wilayaListed && <option value={field.value}>{field.value}</option>}
              {(wilayas ?? []).map((w) => (
                <option key={w.code} value={w.nom}>
                  {L(w.nom, w.nomAr)}
                </option>
              ))}
            </select>
          )}
        />
      </FormField>
      <FormField label={t('fCommune')}>
        <Controller
          control={control}
          name="commune"
          render={({ field }) => (
            <select
              ref={field.ref}
              name={field.name}
              value={field.value}
              onBlur={field.onBlur}
              onChange={(e) => field.onChange(e.target.value)}
              disabled={!wilaya}
              className={cn(INPUT_CLS, 'disabled:opacity-60')}
            >
              <option value="">—</option>
              {field.value && !communeListed && <option value={field.value}>{field.value}</option>}
              {(communes ?? []).map((c) => (
                <option key={c.code} value={c.nom}>
                  {L(c.nom, c.nomAr)}
                </option>
              ))}
            </select>
          )}
        />
      </FormField>
    </>
  );
}
