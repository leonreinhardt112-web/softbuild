import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, FileDown, Info } from "lucide-react";
import { format, parseISO, addDays, differenceInDays } from "date-fns";
import jsPDF from "jspdf";
import { drawAbsenderzeile, addFooterAllPages, hexToRgb } from "@/utils/pdfBriefkopf";

const fmt = (v) => (v || 0).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
const fmtDate = (d) => { try { return d ? format(parseISO(d), "dd.MM.yyyy") : "–"; } catch { return "–"; } };

const STUFE_LABELS = { 1: "1. Mahnung", 2: "2. Mahnung", 3: "Letzte Mahnung / Zahlungsaufforderung" };
const STUFE_LABELS_SHORT = { 1: "1. Mahnung", 2: "2. Mahnung", 3: "Letzte Mahnung" };
const STUFE_COLORS = { 1: "bg-amber-100 text-amber-700", 2: "bg-orange-100 text-orange-700", 3: "bg-red-100 text-red-700" };
const DEFAULT_GEBUEHREN = { 1: 0, 2: 10, 3: 25 };

// Aktueller Basiszins (wird 2x jährlich angepasst, Stand Jan 2025: 2,90 %)
const BASISZINS_AKTUELL = 2.90;
const VERZUGSZINS_AUFSCHLAG = 9;

const STANDARD_TEXTE = {
  1: (rechnung) =>
    `trotz unserer Rechnung vom ${fmtDate(rechnung.rechnungsdatum)} (Rechnungsnummer: ${rechnung.rechnungsnummer}, Fälligkeit: ${fmtDate(rechnung.faellig_am)}) haben wir bislang keinen Zahlungseingang feststellen können.\n\nWir bitten Sie höflich, den ausstehenden Betrag innerhalb der unten genannten Frist auf unser Konto zu überweisen. Möglicherweise haben Sie diese Rechnung übersehen – in diesem Fall bitten wir Sie, den Betrag umgehend zu begleichen.`,
  2: (rechnung) =>
    `wir haben Ihnen mit Schreiben vom ${fmtDate(rechnung.letzte_mahnung_am || rechnung.rechnungsdatum)} bereits eine Zahlungserinnerung übersandt. Leider ist bis heute kein Zahlungseingang für unsere Rechnung vom ${fmtDate(rechnung.rechnungsdatum)} (Rechnungsnummer: ${rechnung.rechnungsnummer}) bei uns eingegangen.\n\nWir fordern Sie hiermit letztmalig freundlich auf, den fälligen Betrag zuzüglich der entstandenen Mahnkosten bis zur unten genannten Frist zu begleichen. Sollten Sie Einwände gegen die Forderung haben, bitten wir Sie, umgehend mit uns Kontakt aufzunehmen.`,
  3: (rechnung) =>
    `trotz unserer vorherigen Mahnungen ist die Zahlung unserer Rechnung vom ${fmtDate(rechnung.rechnungsdatum)} (Rechnungsnummer: ${rechnung.rechnungsnummer}, Fälligkeit: ${fmtDate(rechnung.faellig_am)}) weiterhin ausstehend.\n\nWir sehen uns nunmehr gezwungen, Sie mit dieser letzten Aufforderung zur sofortigen Zahlung aufzufordern. Sollte der Gesamtbetrag nicht bis zur gesetzten Frist eingehen, werden wir ohne weitere Ankündigung rechtliche Schritte einleiten und die Forderung an unseren Rechtsanwalt bzw. ein Inkassobüro übergeben. Die dabei entstehenden Kosten gehen zu Ihren Lasten.`,
};

function exportMahnungPDF({ rechnung, projekt, stammdaten, mahnstufe, mahngebuehr, verzugspauschale, basiszins, zahlungsfrist, mahntext }) {
  const firma = stammdaten?.find(s => s.typ === "unternehmen");
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const W = 210;
  const M = 25;
  const MR = 20;

  const headerColor = firma?.angebot_header_farbe || "#4682B4";
  const rgb = hexToRgb(headerColor);

  // --- LOGO ---
  let logoBottom = 15;
  if (firma?.briefkopf_logo_url) {
    try {
      doc.addImage(firma.briefkopf_logo_url, "JPEG", M, 10, 50, 18, undefined, "FAST");
      logoBottom = 30;
    } catch (e) { logoBottom = 15; }
  }

  // --- Farbige Kopfzeile (Absender klein) ---
  const headerBarY = logoBottom - 2;
  doc.setFillColor(...rgb);
  doc.rect(0, headerBarY, W, 8, "F");
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(255, 255, 255);
  const absenderParts = [
    firma?.name,
    firma?.briefkopf_strasse,
    `${firma?.briefkopf_plz || ""} ${firma?.briefkopf_stadt || ""}`.trim(),
    firma?.briefkopf_telefon,
    firma?.briefkopf_email,
  ].filter(Boolean);
  doc.text(absenderParts.join(" · "), M, headerBarY + 5.2);
  doc.setTextColor(0, 0, 0);

  // --- Empfänger (linke Spalte) ---
  let adressY = headerBarY + 18;
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(50);
  // Kleine Absenderzeile über Adresse (DIN 5008)
  doc.setFontSize(7);
  doc.setTextColor(120);
  doc.text([firma?.name, firma?.briefkopf_strasse, `${firma?.briefkopf_plz || ""} ${firma?.briefkopf_stadt || ""}`.trim()].filter(Boolean).join(" · "), M, adressY);
  doc.setDrawColor(180);
  doc.setLineWidth(0.2);
  doc.line(M, adressY + 1.5, M + 75, adressY + 1.5);
  adressY += 6;
  doc.setFontSize(10);
  doc.setTextColor(20);
  doc.setFont("helvetica", "normal");
  const empfaengerLines = (projekt?.client || "Auftraggeber").split("\n");
  empfaengerLines.forEach(line => { doc.text(line, M, adressY); adressY += 5.5; });

  // --- Ort + Datum (rechte Spalte) ---
  const datumY = headerBarY + 18;
  doc.setFontSize(9);
  doc.setTextColor(60);
  doc.text(`${firma?.briefkopf_stadt || ""}, ${format(new Date(), "dd.MM.yyyy")}`, W - MR, datumY + 10, { align: "right" });

  // --- Betreff ---
  const betreffY = adressY + 10;
  const stufenLabel = STUFE_LABELS_SHORT[mahnstufe] || `${mahnstufe}. Mahnung`;
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...rgb);
  doc.text(`${stufenLabel} – Rechnung ${rechnung.rechnungsnummer}`, M, betreffY);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(0, 0, 0);

  // --- Fließtext ---
  doc.setFontSize(10);
  doc.setTextColor(30);
  let y = betreffY + 10;
  doc.text("Sehr geehrte Damen und Herren,", M, y);
  y += 8;

  const bodyText = mahntext || STANDARD_TEXTE[mahnstufe]?.(rechnung) || "";
  const bodyLines = doc.splitTextToSize(bodyText, W - M - MR);
  doc.text(bodyLines, M, y);
  y += bodyLines.length * 5 + 8;

  // --- Tabelle ---
  const offen = (rechnung.betrag_brutto || 0) - (rechnung.zahlungseingang || 0) - (rechnung.einbehalt || 0);
  const verzugszins = basiszins + VERZUGSZINS_AUFSCHLAG;
  const verzugtage = differenceInDays(new Date(), parseISO(rechnung.faellig_am || rechnung.rechnungsdatum));
  const zinsbetrag = verzugtage > 0 ? offen * (verzugszins / 100) * (verzugtage / 365) : 0;

  // Tabellenheader
  doc.setFillColor(240, 243, 248);
  doc.rect(M, y, W - M - MR, 7, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(40);
  doc.text("Position", M + 3, y + 5);
  doc.text("Betrag", W - MR - 3, y + 5, { align: "right" });
  y += 8;
  doc.setFont("helvetica", "normal");

  const rows = [
    [`Rechnungsbetrag (brutto) – ${rechnung.rechnungsnummer}`, fmt(rechnung.betrag_brutto)],
    [`Bisherige Zahlungen`, rechnung.zahlungseingang > 0 ? `- ${fmt(rechnung.zahlungseingang)}` : "–"],
  ];
  if (rechnung.einbehalt > 0) rows.push([`Sicherheitseinbehalt`, `- ${fmt(rechnung.einbehalt)}`]);
  if (mahngebuehr > 0) rows.push([`Mahngebühr (${stufenLabel})`, fmt(mahngebuehr)]);
  if (verzugspauschale > 0) rows.push([`Verzugspauschale (§ 288 Abs. 5 BGB)`, fmt(verzugspauschale)]);
  if (zinsbetrag > 0) rows.push([
    `Verzugszinsen ${verzugszins.toFixed(2)} % p.a. (Basiszins ${basiszins.toFixed(2)} % + 9 PP)\nfür ${verzugtage} Tage seit ${fmtDate(rechnung.faellig_am)}`,
    fmt(zinsbetrag),
  ]);

  const gesamtForderung = offen + (mahngebuehr || 0) + (verzugspauschale || 0) + zinsbetrag;
  rows.push([`Gesamtforderung`, fmt(gesamtForderung)]);

  rows.forEach(([label, val], i) => {
    const isLast = i === rows.length - 1;
    if (isLast) {
      doc.setDrawColor(150);
      doc.setLineWidth(0.4);
      doc.line(M, y - 1, W - MR, y - 1);
      doc.setFont("helvetica", "bold");
    }
    // Mehrzeilige Labels (Zinszeile)
    const labelLines = doc.splitTextToSize(label, W - M - MR - 40);
    doc.text(labelLines, M + 3, y + 4.5);
    doc.text(val, W - MR - 3, y + 4.5, { align: "right" });
    y += Math.max(labelLines.length * 5, 7.5);
    doc.setFont("helvetica", "normal");
    doc.setLineWidth(0.1);
    doc.setDrawColor(220);
    doc.line(M, y, W - MR, y);
    y += 1;
  });

  y += 8;
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30);
  doc.text(`Bitte überweisen Sie den Gesamtbetrag von ${fmt(gesamtForderung)} bis spätestens ${fmtDate(zahlungsfrist)}.`, M, y, { maxWidth: W - M - MR });

  y += 16;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("Mit freundlichen Grüßen,", M, y);
  y += 6;
  doc.setFont("helvetica", "bold");
  doc.text(firma?.name || "", M, y);

  // Footer
  addFooterAllPages(doc, firma, W, 297, M, MR);

  doc.save(`Mahnung_${stufenLabel.replace(/\. /g, "_").replace(/ /g, "_")}_${rechnung.rechnungsnummer}.pdf`);
}

export default function MahnungDialog({ rechnung, projekt, stammdaten, open, onClose, onSave }) {
  const currentStufe = rechnung?.mahnstufe || 0;
  const nextStufe = Math.min(currentStufe + 1, 3);
  const [mahngebuehr, setMahngebuehr] = useState(DEFAULT_GEBUEHREN[nextStufe] || 0);
  const [verzugspauschale, setVerzugspauschale] = useState(40); // § 288 Abs. 5 BGB Pauschale
  const [basiszins, setBasiszins] = useState(BASISZINS_AKTUELL);
  const [zahlungsfrist, setZahlungsfrist] = useState(format(addDays(new Date(), 14), "yyyy-MM-dd"));
  const [mahntext, setMahntext] = useState("");

  useEffect(() => {
    if (rechnung) {
      setMahngebuehr(DEFAULT_GEBUEHREN[nextStufe] || 0);
      setMahntext(STANDARD_TEXTE[nextStufe]?.(rechnung) || "");
    }
  }, [rechnung, nextStufe]);

  if (!rechnung) return null;

  const offen = (rechnung.betrag_brutto || 0) - (rechnung.zahlungseingang || 0) - (rechnung.einbehalt || 0);
  const verzugszins = basiszins + VERZUGSZINS_AUFSCHLAG;
  const verzugtage = differenceInDays(new Date(), parseISO(rechnung.faellig_am || rechnung.rechnungsdatum));
  const zinsbetrag = verzugtage > 0 ? offen * (verzugszins / 100) * (verzugtage / 365) : 0;

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
    exportMahnungPDF({ rechnung, projekt, stammdaten, mahnstufe: nextStufe, mahngebuehr, verzugspauschale, basiszins, zahlungsfrist, mahntext });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            Mahnung erstellen – {rechnung.rechnungsnummer}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Status */}
          <div className="bg-muted/40 rounded-lg p-3 space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Offener Betrag:</span>
              <span className="font-bold text-amber-600">{fmt(offen)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Bisherige Mahnstufe:</span>
              <span>{currentStufe === 0 ? "Keine" : `${currentStufe}. Mahnung`}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Neue Mahnstufe:</span>
              <Badge className={STUFE_COLORS[nextStufe] || "bg-secondary"}>
                {STUFE_LABELS[nextStufe]}
              </Badge>
            </div>
          </div>

          {/* Zahlungsfrist + Mahngebühr */}
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

          {/* Verzugspauschale + Basiszins */}
          <div className="border border-border rounded-lg p-3 space-y-3">
            <p className="text-xs font-semibold text-foreground">Verzugskosten (§ 288 BGB)</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">
                  Verzugspauschale (€)
                  <span className="ml-1 text-muted-foreground font-normal">§ 288 Abs. 5 BGB</span>
                </label>
                <Input type="number" value={verzugspauschale} onChange={e => setVerzugspauschale(parseFloat(e.target.value) || 0)} className="h-8 text-xs" min={0} step={10} />
                <p className="text-[10px] text-muted-foreground mt-0.5">Pauschal 40 € bei B2B-Forderungen</p>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">
                  Basiszins (%)
                  <span className="ml-1 text-muted-foreground font-normal">aktuell</span>
                </label>
                <Input type="number" value={basiszins} onChange={e => setBasiszins(parseFloat(e.target.value) || 0)} className="h-8 text-xs" min={-5} max={15} step={0.1} />
                <p className="text-[10px] text-muted-foreground mt-0.5">Wird halbj. von der Bundesbank festgelegt</p>
              </div>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-md px-3 py-2 flex items-start gap-2">
              <Info className="w-3.5 h-3.5 text-amber-600 mt-0.5 shrink-0" />
              <div className="text-xs text-amber-800">
                <span className="font-semibold">Verzugszins: {(basiszins + VERZUGSZINS_AUFSCHLAG).toFixed(2)} % p.a.</span>
                {" "}(Basiszins {basiszins.toFixed(2)} % + 9 Prozentpunkte gem. § 288 Abs. 2 BGB)
                {verzugtage > 0 && (
                  <span className="block mt-0.5">
                    Verzug seit {verzugtage} Tagen → Zinsbetrag ca. <strong>{fmt(zinsbetrag)}</strong>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Mahntext */}
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">
              Mahntext (Standardtext vorausgefüllt – anpassbar)
            </label>
            <textarea
              className="w-full border border-input rounded-md px-3 py-2 text-xs bg-background resize-none h-28"
              value={mahntext}
              onChange={e => setMahntext(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>Abbrechen</Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={handlePDF}>
            <FileDown className="w-3.5 h-3.5" /> PDF erstellen
          </Button>
          <Button size="sm" onClick={handleSave}>
            Mahnstufe setzen &amp; speichern
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}