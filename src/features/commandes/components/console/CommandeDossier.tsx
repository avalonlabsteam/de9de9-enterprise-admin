// The commande's dossier, under « Où en est chaque partie »: who asked
// (client), who receives the commande (prestataires), what was asked (demande)
// and every file, as GET /commandes/worklist/{id} groups them. The same blocks
// for every status and every kind of line — only their content changes: a
// demande lists everyone consulted, a contract its retained company first, a
// contract created by phone has no demande. Read-only: the actions stay in the
// summary above.
import { Fragment, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight, Download, ExternalLink, File as FileIcon, FileText, ImageIcon, Megaphone, Star, type LucideIcon } from 'lucide-react';
import { documentIdFrom } from '@/api/documents';
import { Glyph } from '@/components/common/Glyph';
import { useT } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { kycPill, tonChip } from '@/features/annonces/lib/annonces';
import { fmtAlger } from '@/features/comptabilite/lib/comptabilite';
import { useDocPreview, useSaveDocument } from '@/features/kyc/api/preview';
import { PreviewDialog } from '@/features/kyc/components/DocPreview';
import { fmtSize } from '@/features/kyc/lib/kyc';
import type {
  CommandeClient,
  CommandeDemande,
  CommandeFichier,
  CommandeFichiers,
  CommandePrestataire,
  WorklistDetail,
} from '../../schemas/worklistDetail';
import { BALL_COLOR } from '../../lib/worklistDisplay';

const SECTION_LABEL = 'text-[11px] font-bold uppercase tracking-[.04em] text-de9-gray';
const BOX = 'rounded-md border border-de9-line px-4 py-3.5';
const CHIP = 'rounded-full px-2 py-[2px] text-[10.5px] font-bold whitespace-nowrap';
const LINK = 'cursor-pointer text-[12px] font-bold text-de9-teal-dark underline-offset-2 hover:underline';
const SMALL_BTN =
  'inline-flex flex-none cursor-pointer items-center gap-1 rounded-full border border-de9-line bg-card px-2.5 py-1.5 text-[11px] font-bold text-de9-slate no-underline hover:bg-de9-row disabled:cursor-not-allowed disabled:opacity-50';

const DASH = '—';
const fmtCredits = (n: number): string => n.toLocaleString('fr-FR');
const fmtDay = (iso: string | null | undefined): string => fmtAlger(iso, false) ?? DASH;
/** A public address is only followed when it is one. */
const isWebUrl = (url: string | null | undefined): url is string => !!url && /^https?:\/\//i.test(url);

function initialsOf(nom: string): string {
  const words = nom.split(/\s+/).filter(Boolean);
  return ((words[0]?.[0] ?? '') + (words[1]?.[0] ?? '')).toUpperCase() || '?';
}

/**
 * A logo as stored: a document URL needs the bearer token — fetched as a blob
 * like every document — while a public URL or a `data:` URI is a plain src.
 * No logo, or one that does not load: the initials.
 */
function Logo({ url, nom }: { url: string | null | undefined; nom: string }) {
  const documentId = url && /\/documents\/[^/]+\/download/i.test(url) ? documentIdFrom(url) : null;
  const { preview } = useDocPreview(documentId);
  const src = documentId ? (preview?.url ?? null) : (url ?? null);
  const [failed, setFailed] = useState<string | null>(null);
  if (src && failed !== src) {
    return <img src={src} alt="" onError={() => setFailed(src)} className="size-11 flex-none rounded-md object-cover" />;
  }
  return (
    <div className="flex size-11 flex-none items-center justify-center rounded-md bg-primary-container text-[14px] font-extrabold text-on-primary-container">
      {initialsOf(nom)}
    </div>
  );
}

/** The company's KYC state — the server's label — opening its review. */
function KycChip({ kyc, companyId }: { kyc: CommandeClient['kyc']; companyId: string }) {
  const t = useT();
  if (!kyc) return null;
  const pill = kycPill(kyc.statut, t);
  return (
    <Link
      to={`/kyc/${encodeURIComponent(companyId)}`}
      className={cn(CHIP, 'no-underline hover:underline', pill?.chip ?? tonChip('neutre'))}
    >
      KYC · {kyc.label || pill?.label || kyc.statut}
    </Link>
  );
}

/** Whose card it is, in the party's colour — as the cards of « Où en est chaque partie ». */
function PartyLabel({ color, children }: { color: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-1.5 text-[11px] font-extrabold tracking-[.04em] uppercase" style={{ color }}>
      <span className="size-2 rounded-full" style={{ background: color }} />
      {children}
    </div>
  );
}

function Rows({ rows }: { rows: [label: string, value: ReactNode][] }) {
  return (
    <dl className="mt-3 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-[12.5px]">
      {rows.map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="text-de9-gray">{label}</dt>
          <dd className="min-w-0 font-semibold break-words text-de9-ink">{value ?? DASH}</dd>
        </div>
      ))}
    </dl>
  );
}

/** A number to read or copy, not a call link. */
const tel = (n: string | null | undefined): ReactNode => (n ? <span className="num select-all">{n}</span> : DASH);
const mail = (e: string | null | undefined): ReactNode =>
  e ? (
    <a href={'mailto:' + e} dir="ltr" className="text-de9-ink underline decoration-[#C7CFD7] decoration-dotted underline-offset-[3px]">
      {e}
    </a>
  ) : (
    DASH
  );
const place = (...parts: (string | null | undefined)[]): string => parts.filter(Boolean).join(' · ') || DASH;

// ------------------------------------------------------------------ client --

function ClientCard({ client: c }: { client: CommandeClient }) {
  const t = useT();
  const legal = c.raisonSociale && c.raisonSociale !== c.nom ? c.raisonSociale : null;
  return (
    <div className={BOX}>
      <div className="flex items-center justify-between gap-2">
        <PartyLabel color={BALL_COLOR.client}>{t('roleClient')}</PartyLabel>
        <Link to={`/entreprises/${encodeURIComponent(c.companyId)}`} className={cn(LINK, 'no-underline')}>
          {t('cmdVoirEntreprise')} <Glyph icon={ArrowRight} className="rtl:rotate-180" />
        </Link>
      </div>
      <div className="mt-2.5 flex items-center gap-3">
        <Logo url={c.logoUrl} nom={c.nom} />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <bdi className="text-[14.5px] font-extrabold text-de9-ink">{c.nom}</bdi>
            <KycChip kyc={c.kyc} companyId={c.companyId} />
            {c.actif === false && (
              <span className={cn(CHIP, 'bg-[#FDECEC] text-de9-red dark:bg-[#E7464E]/15')}>{t('accesDesactivee')}</span>
            )}
          </div>
          {legal && (
            <div dir="auto" className="mt-0.5 text-[11.5px] text-de9-gray ltr:text-left rtl:text-right">
              {legal}
            </div>
          )}
        </div>
      </div>
      <Rows
        rows={[
          [t('cmdContact'), c.contact],
          [t('cmdTelephone'), tel(c.telephone)],
          [t('cmdEmail'), mail(c.email)],
          [t('cmdAdresse'), place(c.adresse, c.commune, c.wilaya)],
          ['RC', c.rc ? <span dir="ltr">{c.rc}</span> : DASH],
          ['NIF', c.nif ? <span dir="ltr">{c.nif}</span> : DASH],
          ['NIS', c.nis ? <span dir="ltr">{c.nis}</span> : DASH],
          [t('cmdEffectif'), c.effectif != null ? <span className="num">{c.effectif}</span> : DASH],
          [t('cmdInscritLe'), <span className="num">{fmtDay(c.inscritLe)}</span>],
        ]}
      />
    </div>
  );
}

// ------------------------------------------------------------ prestataires --

/** attente · recu · valide · refuse → the tone of its chip. */
const DEVIS_TON: Record<string, string> = { attente: 'neutre', recu: 'info', valide: 'succes', refuse: 'danger' };

function DevisChip({ devis }: { devis: CommandePrestataire['devis'] }) {
  const t = useT();
  if (!devis) return null;
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <span className={cn(CHIP, tonChip(DEVIS_TON[devis.statut]))}>{devis.statutLabel || devis.statut}</span>
      {devis.montantCredits != null && (
        <span className="num text-[12px] font-extrabold text-de9-ink">
          {fmtCredits(devis.montantCredits)} <span className="text-[10px] font-semibold text-de9-gray">{t('credits')}</span>
        </span>
      )}
    </span>
  );
}

/** « ★ 4,7 · 23 avis · 41 missions · 38 pers. » — what the search card says of the company. */
function reputation(p: CommandePrestataire, t: ReturnType<typeof useT>): ReactNode {
  return (
    <>
      <Glyph icon={Star} filled /> <span className="num">{p.note != null ? p.note.toFixed(1) : DASH}</span>
      {' · '}
      <span className="num">{p.nombreAvis ?? 0}</span> {t('surNAvis')}
      {' · '}
      <span className="num">{p.missions ?? 0}</span> {t('presMissionsCount')}
      {p.effectif != null && (
        <>
          {' · '}
          <span className="num">{p.effectif}</span> {t('presPers')}
        </>
      )}
    </>
  );
}

function PrestatairesCard({ list, onProfile }: { list: CommandePrestataire[]; onProfile: (companyId: string) => void }) {
  const t = useT();
  // A contract puts its retained company first; before one, nobody is retained.
  const retenu = list[0]?.retenu ? list[0] : null;
  const autres = retenu ? list.slice(1) : list;

  return (
    <div className={BOX}>
      <div className="flex items-center justify-between gap-2">
        <PartyLabel color={BALL_COLOR.pro}>
          {retenu || list.length === 0
            ? t('rolePrestataire')
            : t('cmdPrestatairesConsultes').replace('{n}', String(list.length))}
        </PartyLabel>
        {retenu && (
          <button type="button" onClick={() => onProfile(retenu.companyId)} className={LINK}>
            {t('presVoirProfil')} <Glyph icon={ArrowRight} className="rtl:rotate-180" />
          </button>
        )}
      </div>

      {list.length === 0 && <div className="mt-3 text-[12.5px] text-de9-gray">{t('cmdAucunPrestataire')}</div>}

      {retenu && (
        <>
          <div className="mt-2.5 flex items-center gap-3">
            <Logo url={retenu.logoUrl} nom={retenu.nom} />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <bdi className="text-[14.5px] font-extrabold text-de9-ink">{retenu.nom}</bdi>
                <span className={cn(CHIP, tonChip('succes'))}>{retenu.roleLabel || t('cmdRetenu')}</span>
                <KycChip kyc={retenu.kyc} companyId={retenu.companyId} />
              </div>
              {retenu.raisonSociale && retenu.raisonSociale !== retenu.nom && (
                <div dir="auto" className="mt-0.5 text-[11.5px] text-de9-gray ltr:text-left rtl:text-right">
                  {retenu.raisonSociale}
                </div>
              )}
            </div>
          </div>
          <div className="mt-2 text-[12px] text-de9-slate">{reputation(retenu, t)}</div>
          <Rows
            rows={[
              [t('cmdTelephone'), tel(retenu.telephone)],
              [t('cmdEmail'), mail(retenu.email)],
              [t('apercuLieu'), place(retenu.commune, retenu.wilaya)],
              [t('apercuDevis'), retenu.devis ? <DevisChip devis={retenu.devis} /> : DASH],
              [t('cmdConsulteLe'), <span className="num">{fmtDay(retenu.inviteLe)}</span>],
            ]}
          />
        </>
      )}

      {autres.length > 0 && (
        <div className={retenu ? 'mt-3.5 border-t border-de9-line pt-3' : 'mt-2.5'}>
          {retenu && <div className={SECTION_LABEL}>{t('cmdAussiConsultes').replace('{n}', String(autres.length))}</div>}
          <div className={cn('flex flex-col', retenu && 'mt-1')}>
            {autres.map((p) => (
              <div key={p.companyId} className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-de9-line py-2 last:border-b-0">
                <div className="min-w-0 flex-1">
                  <button type="button" onClick={() => onProfile(p.companyId)} className="cursor-pointer text-start text-[12.5px] font-bold text-de9-ink underline-offset-2 hover:underline">
                    <bdi>{p.nom}</bdi>
                  </button>
                  <div className="text-[11px] text-de9-gray">
                    {place(p.commune, p.wilaya)} · {reputation(p, t)}
                  </div>
                </div>
                <DevisChip devis={p.devis} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ demande --

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0">
      <div className={SECTION_LABEL}>{label}</div>
      <div className="mt-1 text-[13px] font-semibold text-de9-ink">{value}</div>
    </div>
  );
}

function budget(d: CommandeDemande, t: ReturnType<typeof useT>): ReactNode {
  const { budgetMinCredits: min, budgetMaxCredits: max } = d;
  if (min == null && max == null) return DASH;
  const text = min != null && max != null ? `${fmtCredits(min)} – ${fmtCredits(max)}` : min != null ? `≥ ${fmtCredits(min)}` : `≤ ${fmtCredits(max ?? 0)}`;
  return (
    <>
      <span className="num">{text}</span> <span className="text-[10.5px] font-semibold text-de9-gray">{t('credits')}</span>
    </>
  );
}

function DemandeBlock({ demande: d }: { demande: CommandeDemande }) {
  const t = useT();
  const services = d.sousCategories ?? [];
  const texts: [string, string | null | undefined][] = [
    [t('cmdContraintes'), d.contraintes],
    [t('cmdCriteres'), d.criteres],
  ];
  return (
    <div className="mt-5">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className={SECTION_LABEL}>{t('cmdDemande')}</div>
        {d.annonce && (
          <Link
            to={`/annonces/${encodeURIComponent(d.annonce.id)}`}
            title={d.annonce.titre ?? undefined}
            className={cn(CHIP, 'max-w-full truncate no-underline hover:underline', tonChip('info'))}
          >
            <Glyph icon={Megaphone} /> {t('cmdDepuisAnnonce')}
            {d.annonce.titre ? ` · ${d.annonce.titre}` : ''}
          </Link>
        )}
      </div>
      <div className={BOX}>
        <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
          <div dir="auto" className="text-[14.5px] font-extrabold text-de9-ink">
            {d.titre || DASH}
          </div>
          {d.reference && <span className="num text-[11.5px] font-semibold text-de9-gray">{d.reference}</span>}
        </div>
        {d.description && (
          <div dir="auto" className="mt-1.5 text-[12.5px] leading-relaxed whitespace-pre-line text-de9-slate ltr:text-left rtl:text-right">
            {d.description}
          </div>
        )}
        {(d.categorie || services.length > 0) && (
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {d.categorie && <span className={cn(CHIP, 'bg-secondary-container text-on-secondary-container')}>{d.categorie.label}</span>}
            {services.map((s) => (
              <span key={s.code} className={cn(CHIP, 'bg-secondary text-de9-slate')}>
                {s.label}
              </span>
            ))}
          </div>
        )}
        <div className="mt-3.5 grid grid-cols-2 gap-x-6 gap-y-3.5 md:grid-cols-4">
          <Field
            label={t('apercuLieu')}
            value={
              <>
                {place(d.commune, d.wilaya)}
                {d.adresseExacte && <div className="text-[11.5px] font-normal text-de9-gray">{d.adresseExacte}</div>}
              </>
            }
          />
          <Field label={t('apercuCadence')} value={[d.cadence, d.frequence].filter(Boolean).join(' · ') || DASH} />
          <Field label={t('cmdSuperficie')} value={d.superficieM2 != null ? <span className="num">{fmtCredits(d.superficieM2)} m²</span> : DASH} />
          <Field label={t('cmdBudget')} value={budget(d, t)} />
          <Field label={t('briefFDateSouhaitee')} value={<span className="num">{fmtDay(d.dateSouhaitee)}</span>} />
          <Field label={t('briefFDeadline')} value={<span className="num">{fmtDay(d.deadline)}</span>} />
          <Field label={t('cmdEnvoyeeLe')} value={<span className="num">{fmtDay(d.envoyeeLe)}</span>} />
          <Field label={t('cmdCreeeLe')} value={<span className="num">{fmtDay(d.creeLe)}</span>} />
        </div>
        {texts.map(
          ([label, text]) =>
            text && (
              <div key={label} className="mt-3.5">
                <div className={SECTION_LABEL}>{label}</div>
                <div dir="auto" className="mt-1 text-[12.5px] leading-relaxed whitespace-pre-line text-de9-slate ltr:text-left rtl:text-right">
                  {text}
                </div>
              </div>
            ),
        )}
      </div>
    </div>
  );
}

// ----------------------------------------------------------------- fichiers --

const TYPE_ICON: Record<string, LucideIcon> = { pdf: FileText, image: ImageIcon };
/** The groups whose files belong to one visit: on a visit line, that visit's come first. */
const GROUPES_PAR_VISITE = new Set(['facture', 'litige']);

function FichierRow({
  fichier: f,
  cetteVisite,
  dim,
  onView,
}: {
  fichier: CommandeFichier;
  /** A facture or litige file of the visit on screen. */
  cetteVisite: boolean;
  /** Another visit's file, on a visit line. */
  dim: boolean;
  onView: () => void;
}) {
  const t = useT();
  const { save, saving } = useSaveDocument();
  const [broken, setBroken] = useState(false);
  // A stored document goes through the panel's authenticated helpers, by id; an annonce photo is public.
  const documentId = f.source === 'document' ? (f.documentId ?? null) : null;
  const publicUrl = documentId ? null : isWebUrl(f.url) ? f.url : null;
  const previewable = f.type === 'pdf' || f.type === 'image';
  const meta = [
    fmtSize(f.tailleOctets, t),
    f.ajouteLe ? fmtDay(f.ajouteLe) : null,
    f.ajoutePar ? t('kycPar').replace('{n}', f.ajoutePar.nom) : null,
  ].filter(Boolean);

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-de9-line py-2.5 last:border-b-0">
      {/* Another visit's file reads fainter; its buttons stay as they are — they work. */}
      <div className={cn('flex min-w-0 flex-1 basis-[240px] items-center gap-3', dim && 'opacity-55')}>
        {publicUrl && f.type === 'image' && !broken ? (
          <img src={publicUrl} alt="" loading="lazy" onError={() => setBroken(true)} className="size-9 flex-none rounded-sm object-cover" />
        ) : (
          <div className="flex size-9 flex-none items-center justify-center rounded-sm bg-secondary text-[16px] text-de9-gray">
            <Glyph icon={TYPE_ICON[f.type ?? ''] ?? FileIcon} />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <bdi className="min-w-0 truncate text-[12.5px] font-bold text-de9-ink" title={f.nom}>
              {f.nom}
            </bdi>
            {f.natureLabel && <span className={cn(CHIP, 'bg-secondary text-de9-slate')}>{f.natureLabel}</span>}
            {f.occurrenceNumero != null && (
              <span className={cn(CHIP, 'bg-secondary text-de9-slate')}>{t('cmdVisiteN').replace('{n}', String(f.occurrenceNumero))}</span>
            )}
            {cetteVisite && <span className={cn(CHIP, 'bg-secondary-container text-on-secondary-container')}>{t('cmdCetteVisite')}</span>}
          </div>
          {/* Each part isolated: « 240 Ko », a date and a French name keep their own order in the Arabic UI. */}
          {meta.length > 0 && (
            <div className="mt-0.5 text-[11px] text-de9-gray">
              {meta.map((part, i) => (
                <Fragment key={i}>
                  {i > 0 && ' · '}
                  <bdi>{part}</bdi>
                </Fragment>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="flex flex-none gap-1.5">
        {documentId && previewable && (
          <button type="button" onClick={onView} className={SMALL_BTN}>
            {t('voir')}
          </button>
        )}
        {documentId && (
          <button type="button" onClick={() => save(documentId, f.nom)} disabled={saving === documentId} className={SMALL_BTN}>
            <Glyph icon={Download} /> {saving === documentId ? t('docTelechargementEnCours') : t('telecharger')}
          </button>
        )}
        {publicUrl && (
          <a href={publicUrl} target="_blank" rel="noopener noreferrer" className={SMALL_BTN}>
            {t('commonOuvrir')} <Glyph icon={ExternalLink} />
          </a>
        )}
      </div>
    </div>
  );
}

function FichiersBlock({ fichiers, surVisite }: { fichiers: CommandeFichiers; surVisite: boolean }) {
  const t = useT();
  const [viewing, setViewing] = useState<CommandeFichier | null>(null);
  const groupes = (fichiers.groupes ?? []).filter((g) => g.fichiers.length > 0);
  const total = fichiers.total ?? groupes.reduce((n, g) => n + g.fichiers.length, 0);

  return (
    <div className="mt-5">
      <div className={cn(SECTION_LABEL, 'mb-2')}>{t('cmdFichiersN').replace('{n}', String(total))}</div>
      {groupes.length === 0 ? (
        <div className={cn(BOX, 'text-[12.5px] text-de9-gray')}>{t('cmdAucunFichier')}</div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {groupes.map((g) => {
            const parVisite = surVisite && GROUPES_PAR_VISITE.has(g.code);
            // The server's order (upload date, visit number) — with this visit's files first on a visit line.
            const rows = parVisite
              ? [...g.fichiers].sort((a, b) => Number(b.deCetteLigne !== false) - Number(a.deCetteLigne !== false))
              : g.fichiers;
            return (
              <div key={g.code} className={cn(BOX, 'py-2')}>
                <div className="flex items-center gap-2 pt-1.5 text-[12px] font-extrabold text-de9-ink">
                  {g.label || g.code}
                  <span className="num rounded-full bg-secondary px-1.5 text-[10.5px] font-bold text-de9-slate">{g.fichiers.length}</span>
                </div>
                {rows.map((f) => (
                  <FichierRow
                    key={f.id}
                    fichier={f}
                    cetteVisite={parVisite && f.deCetteLigne === true}
                    dim={parVisite && f.deCetteLigne === false}
                    onView={() => setViewing(f)}
                  />
                ))}
              </div>
            );
          })}
        </div>
      )}
      {viewing?.documentId && (
        <PreviewDialog
          open
          onOpenChange={(open) => {
            if (!open) setViewing(null);
          }}
          title={viewing.natureLabel || viewing.nom}
          documentId={viewing.documentId}
          fileName={viewing.nom}
          contentType={viewing.contentType}
        />
      )}
    </div>
  );
}

// ------------------------------------------------------------------- dossier --

/** The three sections, in the guide's order. The caller draws it once `detail.client` is there. */
export function CommandeDossier({ detail: d, client }: { detail: WorklistDetail; client: CommandeClient }) {
  const t = useT();
  const [, setSearchParams] = useSearchParams();
  // The profile overlay is the layout's: it opens over the commande, which stays underneath.
  const openProfile = (companyId: string): void =>
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('pres', companyId);
      return next;
    });
  // Should the grouped list not read, the flat member still names the company.
  const flat = d.prestataire?.companyId && d.prestataire.name
    ? [{ companyId: d.prestataire.companyId, nom: d.prestataire.name, telephone: d.prestataire.phone, retenu: d.kind === 'visite' }]
    : [];
  const prestataires: CommandePrestataire[] = d.prestataires ?? flat;

  return (
    <>
      <div className="mt-5">
        <div className={cn(SECTION_LABEL, 'mb-2')}>{t('cmdParties')}</div>
        <div className="grid grid-cols-1 items-start gap-2.5 md:grid-cols-2">
          <ClientCard client={client} />
          <PrestatairesCard list={prestataires} onProfile={openProfile} />
        </div>
      </div>
      {d.demande && <DemandeBlock demande={d.demande} />}
      {d.fichiers && <FichiersBlock fichiers={d.fichiers} surVisite={d.kind === 'visite'} />}
    </>
  );
}
