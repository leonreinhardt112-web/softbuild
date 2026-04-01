import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, FileDown } from "lucide-react";
import { format, parseISO, addDays } from "date-fns";
import jsPDF from "jspdf";

const fmt = (v) => v ? v.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €" : "–";
const fmtDate = (d) => { try { return d ? format(parseISO(d), "dd.MM.yyyy") : "–"; } catch { return "–"; } };

const STUFE_LABELS = { 1: "1. Mahnung", 2: "2. Mahnung", 3: "Letzte Mahnung" };
const STUFE_COLORS = { 1: "bg-amber-100 text-amber-700", 2: "bg-orange-100 text-orange-700", 3: "bg-red-100 text-red-700" };
const DEFAULT_GEBUEHREN = { 1: 0, 2: 10, 3: 25 };

function exportMahnungPDF({ rechnung, projekt, stammdaten, mahnstufe, mahngebuehr, zahlungsfrist, mahntext }) {
  const firma = stammdaten?.find(s => s.typ === "unternehmen");
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const W = 210; const M = 20;

  // Header
  doc.setFontSize(9);
  doc.setTextColor(100);
  doc.text(`${firma?.name || "Unternehmen"} · ${firma?.briefkopf_strasse || ""} · ${firma?.briefkopf_plz || ""} ${firma?.briefkopf_stadt || ""}`, M, 28);
  doc.setDrawColor(200);
  doc.line(M, 30, W - M, 30);

  // Empfänger
  doc.setFontSize(10);
  doc.setTextColor(30);
  doc.text(projekt?.client || "Auftraggeber", M, 50);

  // Datum + Ort
  doc.setFontSize(9);
  doc.setTextColor(80);
  const heute = format(new Date(), "dd.MM.yyyy");
  doc.text(`${firma?.briefkopf_stadt || ""}, ${heute}`, W - M, 50, { align: "right" });

  // Betreff
  const stufenLabel = STUFE_LABELS[mahnstufe] || `${mahnstufe}. Mahnung`;
  doc.setFontSize(12);
  doc.setFont(undefined, "bold");
  doc.setTextColor(30);
  doc.text(`${stufenLabel} – Rechnung ${rechnung.rechnungsnummer}`, M, 70);
  doc.setFont(undefined, "normal");

  // Fließtext
  doc.setFontSize(10);
  doc.setTextColor(40);
  const offen = (rechnung.betrag_brutto || 0) - (rechnung.zahlungseingang || 0) - (rechnung.einbehalt || 0);
  const textLines = [
    `Sehr geehrte Damen und Herren,`,
    ``,
    mahntext || `trotz unserer Rechnung vom ${fmtDate(rechnung.rechnungsdatum)} (Fälligkeit: ${fmtDate(rechnung.faellig_am)}) haben wir`,
    `noch keinen Zahlungseingang feststellen können.`,
    ``,
    `Wir bitten Sie höflich, den ausstehenden Betrag bis zum ${fmtDate(zahlungsfrist)} auf unser Konto zu überweisen.`,
  ];
  let y = 82;
  textLines.forEach(line => { doc.text(line, M, y); y += 6; });

  // Tabelle
  y += 4;
  doc.setFillColor(240, 244, 248);
  doc.rect(M, y, W - 2 * M, 8, "F");
  doc.setFont(undefined, "bold");
  doc.setFontSize(9);
  doc.text("Position", M + 2, y + 5.5);
  doc.text("Betrag", W - M - 2, y + 5.5, { align: "right" });
  y += 10;
  doc.setFont(undefined, "normal");
  doc.setFontSize(9);

  const rows = [
    [`Rechnungsbetrag (brutto) – ${rechnung.rechnungsnummer}`, fmt(rechnung.betrag_brutto)],
    [`Bisherige Zahlungen`, `- ${fmt(rechnung.zahlungseingang || 0)}`],
  ];
  if (rechnung.einbehalt > 0) rows.push([`Sicherheitseinbehalt`, `- ${fmt(rechnung.einbehalt)}`]);
  rows.push([`Offener Betrag`, fmt(offen)]);
  if (mahngebuehr > 0) rows.push([`Mahngebühr (${stufenLabel})`, fmt(mahngebuehr)]);

  rows.forEach(([label, val], i) => {
    if (i === rows.length - 1) {
      doc.setFont(undefined, "bold");
      doc.setDrawColor(180);
      doc.line(M, y - 1, W - M, y - 1);
    }
    doc.text(label, M + 2, y + 4);
    doc.text(val, W - M - 2, y + 4, { align: "right" });
    y += 8;
    doc.setFont(undefined, "normal");
  });

  y += 6;
  doc.setFontSize(10);
  doc.text(`Bitte überweisen Sie den Gesamtbetrag von ${fmt(offen + (mahngebuehr || 0))} bis spätestens ${fmtDate(zahlungsfrist)}.`, M, y);

  y += 14;
  doc.text("Mit freundlichen Grüßen,", M, y);
  y += 6;
  doc.text(firma?.name || "", M, y);

  // Footer
  doc.setFontSize(7.5);
  doc.setTextColor(120);
  const footerY = 282;
  if (firma?.pdf_footer_links) doc.text(firma.pdf_footer_links, M, footerY);
  if (firma?.pdf_footer_mitte) doc.text(firma.pdf_footer_mitte, W / 2, footerY, { align: "center" });
  if (firma?.pdf_footer_rechts) doc.text(firma.pdf_footer_rechts, W - M, footerY, { align: "right" });

  doc.save(`Mahnung_${stufenLabel.replace(/\. /g, "_").replace(/ /g, "_")}_${rechnung.rechnungsnummer}.pdf`);
}

export default function MahnungDialog({ rechnung, projekt, stammdaten, open, onClose, onSave }) {
  const currentStufe = rechnung?.mahnstufe || 0;
  const nextStufe = Math.min(currentStufe + 1, 3);
  const [mahngebuehr, setMahngebuehr] = useState(DEFAULT_GEBUEHREN[nextStufe] || 0);
  const [zahlungsfrist, setZahlungsfrist] = useState(
    format(addDays(new Date(), 14), "yyyy-MM-dd")
  );
  const [mahntext, setMahntext] = useState("");

  if (!rechnung) return null;

  const offen = (rechnung.betrag_brutto || 0) - (rechnung.zahlungseingang || 0) - (rechnung.einbehalt || 0);

  const handleSave = () => {
    onSave(rechnung.id, {
      mahnstufe: nextStufe,
      letzte_mahnung_am: format(new Date(), "yyyy-MM-dd"),
      mahngebuehr: (rechnung.mahngebuehr || 0) + mahngebuehr,
      status: "gemahnt",
    });
    onClose();
  };

  const handlePDF = () => {
    exportMahnungPDF({ rechnung, projekt, stammdaten, mahnstufe: nextStufe, mahngebuehr, zahlungsfrist, mahntext });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            Mahnung erstellen – {rechnung.rechnungsnummer}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="bg-muted/40 rounded-lg p-3 space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Offener Betrag:</span><span className="font-bold text-amber-600">{fmt(offen)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Bisherige Mahnstufe:</span><span>{currentStufe === 0 ? "Keine" : `${currentStufe}. Mahnung`}</span></div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Neue Mahnstufe:</span>
              <Badge className={STUFE_COLORS[nextStufe] || "bg-secondary"}>
                {STUFE_LABELS[nextStufe]}
              </Badge>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Zahlungsfrist bis</label>
              <Input type="date" value={zahlungsfrist} onChange={e => setZahlungsfrist(e.target.value)} className="h-8 text-xs" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Mahngebühr (€)</label>
              <Input type="number" value={mahngebuehr} onChange={e => setMahngebuehr(parseFloat(e.target.value) || 0)} className="h-8 text-xs" min={0} step={5} />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">Individuelltextvorgabe (optional)</label>
            <textarea
              className="w-full border border-input rounded-md px-3 py-2 text-xs bg-background resize-none h-20"
              placeholder="Überschreibe den Standardtext im PDF…"
              value={mahntext}
              onChange={e => setMahntext(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>Abbrechen</Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={handlePDF}>
            <FileDown className="w-3.5 h-3.5" /> PDF Vorschau
          </Button>
          <Button size="sm" onClick={handleSave}>
            Mahnstufe setzen &amp; speichern
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}