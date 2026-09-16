// POST /appels-offres/:rfqId/demander-devis — mock twin of sending an existing
// appel d'offres' brief to prestataires (S2 → S3). Reads the multipart body
// (`payload` JSON + `files`), validates the payload against the contract, then
// records the brief on the mock commande and opens one devis per invited
// prestataire (statut 'attente'). The live response isn't documented; the twin
// answers with the updated worklist detail, like the other roadmap routes.
import { demandeDevisPayloadSchema } from '@/features/prestataires/schemas/demandeDevis';
import type { MockHandler, MockResponse } from './router';
import { addAudit, cmdById, db, nowStamp } from './db';
import { worklistDetailOf } from './worklistDetail';

function problem(status: number, title: string, detail: string): MockResponse {
  return { status, data: { type: 'about:blank', title, status, detail } };
}

export const demanderDevisHandler: MockHandler = (req) => {
  const id = req.pathParams['rfqId'] ?? '';
  const cmd = cmdById(id);
  if (!cmd) return problem(404, 'Not Found', `Appel d'offres introuvable : ${id}`);
  if (!(req.body instanceof FormData)) {
    return problem(400, 'Bad Request', 'Corps multipart/form-data attendu (payload + files).');
  }
  const form = req.body;
  const rawPayload = form.get('payload');
  if (typeof rawPayload !== 'string' || !rawPayload.trim()) {
    return problem(400, 'Bad Request', 'La partie « payload » est requise (prestataireCompanyIds, brief).');
  }
  let json: unknown;
  try {
    json = JSON.parse(rawPayload);
  } catch {
    return problem(400, 'Bad Request', 'La partie « payload » doit être un JSON valide.');
  }
  const parsed = demandeDevisPayloadSchema.safeParse(json);
  if (!parsed.success) {
    const detail = parsed.error.issues.map((i) => `${i.path.join('.')} : ${i.message}`).join(' · ');
    return problem(400, 'Bad Request', detail);
  }

  const { brief, ...p } = parsed.data;
  const files = form.getAll('files').filter((f): f is File => typeof f !== 'string');
  const single = form.get('file');
  if (single instanceof File) files.push(single);

  cmd.setup = 'devis';
  cmd.proposedToClient = false;
  cmd.service = brief.title || cmd.service;
  cmd.wilaya = brief.wilaya || cmd.wilaya;
  cmd.commune = brief.commune || cmd.commune;
  cmd.brief = {
    ref: cmd.brief?.ref ?? cmd.id,
    service: brief.title,
    description: brief.description,
    budgetMin: p.budgetMinCredits ?? brief.budgetMinDzd ?? '',
    budgetMax: p.budgetMaxCredits ?? brief.budgetMaxDzd ?? '',
    adresse: brief.adresseExacte,
    commune: brief.commune,
    wilaya: brief.wilaya,
    superficie: brief.superficieM2 ?? '',
    frequence: '',
    dates: brief.dateSouhaitee ?? '',
    contraintes: brief.contraintes,
    photos: files.filter((f) => f.type.startsWith('image/')).map((f) => ({ name: f.name })),
    docs: files.filter((f) => !f.type.startsWith('image/')).map((f) => ({ name: f.name })),
    sentAt: nowStamp(),
  };
  cmd.devis = p.prestataireCompanyIds.map((pid) => {
    const pres = db.prestataires.find((x) => x.id === pid || x.name === pid);
    return {
      presId: pres?.id ?? pid,
      raison: pres?.name ?? pid,
      phone: pres?.phone ?? '',
      wa: pres?.wa ?? '',
      email: pres?.email ?? '',
      status: 'attente' as const,
      montant: 0,
      delai: '',
      details: '',
      docName: '',
    };
  });
  addAudit(
    cmd,
    `Brief de demande de devis envoyé à ${p.prestataireCompanyIds.length} prestataire(s) — par de9de9.`,
    'de9',
  );
  return { data: worklistDetailOf(cmd) };
};
