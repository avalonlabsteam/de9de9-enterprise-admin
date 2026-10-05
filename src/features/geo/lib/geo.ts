// Pure helpers over the geo dictionaries. Rows, params and payloads carry the
// French `nom` of a wilaya or a commune, so an entry is looked up by its name.

/** « Aïn Defla », « ain-defla » and « AIN DEFLA » all fold to « aindefla ». */
const fold = (name: string): string =>
  name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '');

/**
 * The dictionary entry a stored name stands for. The exact `nom` first, then a
 * loose match: names typed by hand before the selects existed (« alger »,
 * « Setif ») still find their entry, and so get its code and its spelling.
 */
export function findByNom<T extends { nom: string }>(
  list: readonly T[] | undefined,
  name: string | null | undefined,
): T | undefined {
  if (!list || !name) return undefined;
  const exact = list.find((x) => x.nom === name);
  if (exact) return exact;
  const key = fold(name);
  return key ? list.find((x) => fold(x.nom) === key) : undefined;
}
