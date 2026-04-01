import React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, Percent, FileDown } from "lucide-react";
import { jsPDF } from "jspdf";
import { format, isPast, isAfter, parseISO } from "date-fns";

const fmt = (v) => v ? v.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €" : "–";
const fmtDate = (d) => { try { return d ? format(parseISO(d), "dd.MM.yy") : "–"; } catch { return "–"; } };

const DEBITOR_STATUS_COLORS = { entwurf: "bg-secondary text-secondary-foreground", gestellt: "bg-blue-100 text-blue-700", teilbezahlt: "bg-amber-100 text-amber-700", bezahlt: "bg-green-100 text-green-700", gemahnt: "bg-red-100 text-red-700", storniert: "bg-gray-100 text-gray-500" };
const DEBITOR_STATUS_LABELS = { entwurf: "Entwurf", gestellt: "Gestellt", teilbezahlt: "Teilbezahlt", bezahlt: "Bezahlt", gemahnt: "Gemahnt", storniert: "Storniert" };
const KREDITOR_STATUS_COLORS = { eingegangen: "bg-secondary text-secondary-foreground", geprueft: "bg-blue-100 text-blue-700", freigegeben: "bg-indigo-100 text-indigo-700", teilbezahlt: "bg-amber-100 text-amber-700", bezahlt: "bg-green-100 text-green-700", gesperrt: "bg-red-100 text-red-700", storniert: "bg-gray-100 text-gray-500" };
const KREDITOR_STATUS_LABELS = { eingegangen: "Eingegangen", geprueft: "Geprüft", freigegeben: "Freigegeben", teilbezahlt: "Teilbezahlt", bezahlt: "Bezahlt", gesperrt: "Gesperrt", storniert: "Storniert" };

function exportDebitorPDF(r, proj) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const margin = 20;
  const W = 210;
  const isStorno = r.rechnungsnummer?.startsWith("STORNO");
  let y = margin;

  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(isStorno ? 180 : 30, isStorno ? 30 : 100, isStorno ? 30 : 180);
  doc.text(isStorno ? "STORNORECHNUNG" : "ABSCHLAGSRECHNUNG", margin, y);
  y += 10;

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(0);

  const info = [
    ["Rechnungsnummer:", r.rechnungsnummer || "–"],
    ["Projekt:", proj ? `${proj.project_name} (${proj.project_number})` : "–"],
    ["Auftraggeber:", proj?.client || "–"],
    ["Rechnungsdatum:", r.rechnungsdatum ? new Date(r.rechnungsdatum).toLocaleDateString("de-DE") : "–"],
    ["Fällig am:", r.faellig_am ? new Date(r.faellig_am).toLocaleDateString("de-DE") : "–"],
    ["Rechnungsart:", r.rechnungsart || "–"],
  ];
  info.forEach(([label, val]) => {
    doc.setFont("helvetica", "bold"); doc.text(label, margin, y);
    doc.setFont("helvetica", "normal"); doc.text(val, margin + 55, y);
    y += 6;
  });
  y += 4;

  doc.setDrawColor(200); doc.line(margin, y, W - margin, y); y += 6;

  const betragNetto = r.betrag_netto || 0;
  const mwstSatz = r.mwst_satz || 19;
  const mwstBetrag = betragNetto * (mwstSatz / 100);
  const betragBrutto = r.betrag_brutto || (betragNetto + mwstBetrag);
  const gezahlt = r.zahlungseingang || 0;
  const offen = Math.max(0, betragBrutto - gezahlt - (r.einbehalt || 0));

  const sumRows = [
    ["Rechnungsbetrag netto:", `${betragNetto.toLocaleString("de-DE", {minimumFractionDigits:2})} €`],
    [`zzgl. MwSt. ${mwstSatz}%:`, `${mwstBetrag.toLocaleString("de-DE", {minimumFractionDigits:2})} €`],
    ["Rechnungsbetrag brutto:", `${betragBrutto.toLocaleString("de-DE", {minimumFractionDigits:2})} €`],
    ["Bereits gezahlt:", `${gezahlt.toLocaleString("de-DE", {minimumFractionDigits:2})} €`],
    ["Noch offen:", `${offen.toLocaleString("de-DE", {minimumFractionDigits:2})} €`],
  ];

  sumRows.forEach(([label, val], i) => {
    if (i === 2 || i === 4) { doc.setFont("helvetica", "bold"); doc.setFontSize(10); } 
    else { doc.setFont("helvetica", "normal"); doc.setFontSize(9); }
    doc.text(label, margin + 70, y, { align: "right" });
    doc.text(val, W - margin, y, { align: "right" });
    y += 6;
  });

  if (r.notes) {
    y += 4;
    doc.setFont("helvetica", "italic"); doc.setFontSize(8); doc.setTextColor(120);
    doc.text(r.notes, margin, y);
  }

  doc.setFontSize(7); doc.setTextColor(150); doc.setFont("helvetica", "normal");
  doc.text(`Erstellt am ${new Date().toLocaleDateString("de-DE")}`, W / 2, 285, { align: "center" });

  const filename = `${r.rechnungsnummer || "Rechnung"}.pdf`.replace(/\s/g, "_");
  doc.save(filename);
}

export default function OffenePostenTabelle({ rows, typ, projects, onZahlung, isLoading }) {
  const isDebitor = typ === "debitor";
  const STATUS_COLORS = isDebitor ? DEBITOR_STATUS_COLORS : KREDITOR_STATUS_COLORS;
  const STATUS_LABELS = isDebitor ? DEBITOR_STATUS_LABELS : KREDITOR_STATUS_LABELS;

  if (isLoading) return <div className="space-y-2 p-4">{Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>;
  if (!rows.length) return <p className="text-sm text-muted-foreground py-10 text-center">Keine offenen Posten vorhanden</p>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/30 text-left">
            <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Re-Nr.</th>
            <th className="px-4 py-3 text-xs font-medium text-muted-foreground">{isDebitor ? "Debitor (Auftraggeber)" : "Kreditor (NU / Lieferant)"}</th>
            <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Projekt</th>
            <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Datum</th>
            <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Fällig</th>
            <th className="px-4 py-3 text-xs font-medium text-muted-foreground text-right">Brutto</th>
            <th className="px-4 py-3 text-xs font-medium text-muted-foreground text-right">Offen</th>
            <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Status</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {rows.map(r => {
            const proj = projects.find(p => p.id === r.project_id);
            const gezahlt = isDebitor ? (r.zahlungseingang || 0) : (r.zahlungsausgang || 0);
            const offen = (r.betrag_brutto || 0) - gezahlt - (r.einbehalt || 0);
            const ueberfaellig = r.faellig_am && isPast(parseISO(r.faellig_am)) && offen > 0;
            const partnerName = isDebitor ? (proj?.client || "–") : (r.kreditor_name || "–");

            return (
              <tr key={r.id} className="border-b border-border hover:bg-accent/30">
                <td className="px-4 py-3 text-xs font-medium">{r.rechnungsnummer}</td>
                <td className="px-4 py-3 text-xs font-medium">{partnerName}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{proj?.project_name || "–"}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{fmtDate(r.rechnungsdatum)}</td>
                <td className="px-4 py-3 text-xs">
                  <span className={ueberfaellig ? "text-red-600 font-medium flex items-center gap-1" : "text-muted-foreground"}>
                    {ueberfaellig && <AlertTriangle className="w-3 h-3" />}
                    {fmtDate(r.faellig_am)}
                  </span>
                  {!isDebitor && r.skonto_prozent > 0 && r.skonto_frist && isAfter(parseISO(r.skonto_frist), new Date()) && (
                    <span className="flex items-center gap-0.5 text-green-600 font-medium mt-0.5">
                      <Percent className="w-2.5 h-2.5" />{r.skonto_prozent}% bis {fmtDate(r.skonto_frist)}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-right">{fmt(r.betrag_brutto)}</td>
                <td className={`px-4 py-3 text-xs text-right font-semibold ${offen > 0 ? "text-amber-600" : "text-green-600"}`}>
                  {offen > 0 ? fmt(offen) : "–"}
                </td>
                <td className="px-4 py-3">
                  <Badge className={`text-[10px] ${STATUS_COLORS[r.status] || "bg-secondary"}`}>
                    {STATUS_LABELS[r.status] || r.status}
                  </Badge>
                </td>
                <td className="px-4 py-3 whitespace-nowrap flex items-center gap-1">
                  {isDebitor && (
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground"
                      title="PDF exportieren"
                      onClick={() => exportDebitorPDF(r, proj)}>
                      <FileDown className="w-3.5 h-3.5" />
                    </Button>
                  )}
                  {offen > 0 && onZahlung && (
                    <Button variant="ghost" size="sm" className="h-7 text-xs text-green-600"
                      onClick={() => onZahlung(r)}>
                      {isDebitor ? "Zahlung erhalten" : "Zahlung buchen"}
                    </Button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}