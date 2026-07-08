// Document viewer — visual ground truth: src/admin/views/DocViewer.tsx;
// view-model ported from logic.ts buildDoc() (brief + devis prestataire docs).
import { toast } from "sonner";
import { useT } from "@/lib/i18n";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import type { Commande } from "../../schemas/commande";

export type DocState = { kind: "brief" } | { kind: "devis"; presId: string };

const fmt = (n: number): string => n.toLocaleString("fr-FR");

const FIELD_LABEL =
  "text-[10.5px] font-extrabold uppercase tracking-[.04em] text-de9-gray";

interface DocViewerProps {
  commande: Commande;
  doc: DocState | null;
  onOpenChange: (open: boolean) => void;
}

export function DocViewer({ commande, doc, onOpenChange }: DocViewerProps) {
  const t = useT();

  const downloadDoc = (): void => {
    toast.success(t("docToastTelechargement"));
  };

  // ---- view-model (logic.ts buildDoc) ----
  const brief = commande.brief;
  const devis =
    doc?.kind === "devis"
      ? (commande.devis ?? []).find((d) => d.presId === doc.presId)
      : undefined;

  const devisStatusMeta: Record<string, [string, string, string]> = {
    recu: [t("consoleBadgeDevisRecu"), "#EAF2FD", "#2F7FD0"],
    valide: [t("commonValide"), "#E7F6EE", "#2FA86A"],
    refuse: [t("commonRefuse"), "#FDECEC", "#E7464E"],
    attente: [t("commonEnAttente"), "#FEF3E2", "#D9871F"],
  };
  const dsm = (devis && devisStatusMeta[devis.status]) ?? [
    "",
    "#F1F4F6",
    "#9AA4B2",
  ];

  const title =
    doc?.kind === "brief" ? t("briefTitle") : t("docDevisPrestataire");
  const fileName =
    doc?.kind === "brief"
      ? (brief?.ref || "brief") + ".pdf"
      : devis?.docName || "devis-" + (devis?.raison ?? "") + ".pdf";

  const budget =
    brief && (brief.budgetMin || brief.budgetMax)
      ? (brief.budgetMin || "?") + " – " + (brief.budgetMax || "?") + " cr"
      : t("briefNonPrecise");
  const localisation = brief
    ? [brief.adresse, brief.commune, brief.wilaya].filter(Boolean).join(", ") ||
      commande.wilaya
    : commande.wilaya;
  const superficie = brief?.superficie ? brief.superficie + " m²" : "—";

  return (
    <Dialog open={doc !== null} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="block max-h-[90vh] w-full max-w-[calc(100%-2rem)] gap-0 overflow-y-auto rounded-[20px] bg-card p-0 text-de9-ink shadow-[0_30px_70px_rgba(20,30,45,.4)] ring-0 sm:max-w-[560px]"
      >
        {/* header */}
        <div className="flex items-center justify-between gap-3 border-b border-de9-line px-[22px] py-[18px]">
          <DialogTitle className="text-base font-extrabold leading-normal text-de9-ink">
            {title}
          </DialogTitle>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={downloadDoc}
              className="flex cursor-pointer items-center gap-1.5 rounded-[10px] bg-[#232838] px-3.5 py-[9px] text-xs font-bold text-white"
            >
              ⤓ {t("telecharger")}
            </button>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-[10px] bg-secondary text-base text-de9-slate"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="p-[22px]">
          <div className="overflow-hidden rounded-xl border border-de9-line shadow-[0_6px_20px_rgba(38,50,69,.06)]">
            {/* document masthead */}
            <div className="flex items-center justify-between gap-3 bg-[#232838] px-5 py-[18px] text-white">
              <div>
                <div className="text-[15px] font-extrabold">
                  <span className="text-de9-red">De9</span>{" "}
                  <span className="text-de9-teal">De9</span>
                </div>
                <div className="mt-[2px] text-[11px] text-[#AEB6C2]">
                  {fileName}
                </div>
              </div>
              {doc?.kind === "brief" && (
                <div className="rounded-full bg-de9-red px-[11px] py-[5px] text-[11px] font-extrabold">
                  {t("briefBadge")}
                </div>
              )}
              {doc?.kind === "devis" && (
                <div
                  className="rounded-full px-[11px] py-[5px] text-[11px] font-extrabold"
                  style={{ background: dsm[1], color: dsm[2] }}
                >
                  {dsm[0]}
                </div>
              )}
            </div>

            <div className="p-5">
              {/* ---- brief document ---- */}
              {doc?.kind === "brief" && (
                <>
                  <div className="text-lg font-extrabold">
                    {t("briefTitle")}
                  </div>
                  <div className="mt-[2px] text-xs text-de9-gray">
                    {brief?.ref ?? ""} · {commande.client} · {commande.contact}
                  </div>
                  <div className="mt-4 flex flex-col gap-[13px]">
                    <div>
                      <div className={FIELD_LABEL}>{t("bService")}</div>
                      <div className="mt-[3px] text-[13.5px] font-semibold">
                        {brief?.service || commande.service}
                      </div>
                    </div>
                    <div>
                      <div className={FIELD_LABEL}>{t("fDescription")}</div>
                      <div className="mt-[3px] text-[13px] leading-[1.55] text-de9-ink">
                        {brief?.description || "—"}
                      </div>
                    </div>
                    <div className="grid grid-cols-1 gap-[13px] sm:grid-cols-2">
                      <div>
                        <div className={FIELD_LABEL}>{t("bBudget")}</div>
                        <div className="mt-[3px] text-[13px] font-semibold">
                          {budget}
                        </div>
                      </div>
                      <div>
                        <div className={FIELD_LABEL}>{t("bSuperficie")}</div>
                        <div className="mt-[3px] text-[13px] font-semibold">
                          {superficie}
                        </div>
                      </div>
                      <div>
                        <div className={FIELD_LABEL}>{t("bLoc")}</div>
                        <div className="mt-[3px] text-[13px] font-semibold">
                          {localisation}
                        </div>
                      </div>
                      <div>
                        <div className={FIELD_LABEL}>{t("bFreq")}</div>
                        <div className="mt-[3px] text-[13px] font-semibold">
                          {brief?.frequence || "—"}
                        </div>
                      </div>
                      <div>
                        <div className={FIELD_LABEL}>{t("bDates")}</div>
                        <div className="mt-[3px] text-[13px] font-semibold">
                          {brief?.dates || "—"}
                        </div>
                      </div>
                    </div>
                    <div>
                      <div className={FIELD_LABEL}>{t("fContraintes")}</div>
                      <div className="mt-[3px] text-[13px] leading-[1.5] text-de9-ink">
                        {brief?.contraintes || "—"}
                      </div>
                    </div>
                    {brief && brief.photos.length > 0 && (
                      <div>
                        <div className={FIELD_LABEL}>{t("fPhotos")}</div>
                        <div className="mt-[7px] grid grid-cols-3 gap-2">
                          {brief.photos.map((ph, i) => (
                            <div
                              key={i}
                              className="overflow-hidden rounded-[9px] border border-de9-line"
                            >
                              <div className="flex h-[62px] items-center justify-center bg-[repeating-linear-gradient(45deg,#EEF1F4,#EEF1F4_8px,#E4E9ED_8px,#E4E9ED_16px)] text-xl dark:bg-[repeating-linear-gradient(45deg,#1E2430,#1E2430_8px,#2C3345_8px,#2C3345_16px)]">
                                🖼️
                              </div>
                              <div className="truncate px-1.5 py-1 text-[9.5px] text-de9-gray">
                                {ph.name}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {brief && brief.docs.length > 0 && (
                      <div>
                        <div className={FIELD_LABEL}>{t("fDocs")}</div>
                        <div className="mt-1.5 flex flex-col gap-[5px]">
                          {brief.docs.map((dd, i) => (
                            <div
                              key={i}
                              className="flex items-center gap-[7px] text-xs text-de9-slate"
                            >
                              📎 {dd.name}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* ---- devis document ---- */}
              {doc?.kind === "devis" && (
                <>
                  <div className="flex flex-wrap items-start justify-between gap-2.5">
                    <div>
                      <div className="text-lg font-extrabold">
                        {devis?.raison ?? ""}
                      </div>
                      <div className="mt-[2px] text-xs text-de9-gray">
                        {t("devisPour")} {commande.client} ·{" "}
                        {brief?.service || commande.service}
                      </div>
                    </div>
                    <div className="text-end">
                      <div className="text-2xl font-extrabold text-de9-ink">
                        {devis?.montant ? fmt(devis.montant) : "—"}
                      </div>
                      <div className="text-[11px] text-[#B0B8C2]">
                        {t("credits")}
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-[13px]">
                    <div className="min-w-[120px] flex-1 rounded-[11px] bg-secondary p-[13px]">
                      <div className="text-[10.5px] font-extrabold uppercase text-de9-gray">
                        {t("devisDelai")}
                      </div>
                      <div className="mt-[3px] text-sm font-bold">
                        ⏱ {devis?.delai || "—"}
                      </div>
                    </div>
                    <div className="min-w-[200px] flex-[2] rounded-[11px] bg-secondary p-[13px]">
                      <div className="text-[10.5px] font-extrabold uppercase text-de9-gray">
                        {t("devisDetails")}
                      </div>
                      <div className="mt-[3px] text-[12.5px] leading-[1.5] text-de9-ink">
                        {devis?.details || "—"}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
          <div className="mt-[13px] text-center text-[11px] text-[#B0B8C2]">
            {t("docFooter")}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
