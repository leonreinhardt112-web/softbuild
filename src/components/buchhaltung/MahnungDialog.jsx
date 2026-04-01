import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, FileDown, Info } from "lucide-react";
import { format, parseISO, addDays, differenceInDays } from "date-fns";
import jsPDF from "jspdf";
import { hexToRgb, addFooterAllPages } from "@/utils/pdfBriefkopf";
import { base44 } from "@/api/base44Client";

const fmt = (v) => (v || 0).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
const fmtDate = (d) => { try { return d ? format(parseISO(d), "dd.MM.yyyy") : "–"; } catch { return "–"; } };

const STUFE_LABELS = { 1: "1. Mahnung", 2: "2. Mahnung", 3: "Letzte Mahnung / Zahlungsaufforderung" };
const STUFE_COLORS = { 1: "bg-amber-100 text-amber-700", 2: "bg-orange-100 text-orange-700", 3: "bg-red-100 text-red-700" };
const DEFAULT_GEBUEHREN = { 1: 0, 2: 10, 3: 25 };
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

const ML = 20;
const MR = 20;
const MT = 20;

async function exportMahnungPDF({ rechnung, projekt, mahnstufe, mahngebuehr, verzugspauschale, basiszins, zahlungsfrist, mahntext }) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const PW = doc.internal.pageSize.getWidth();
  const PH = doc.internal.pageSize.getHeight();
  const CW = PW - ML - MR;

  let firma = null;
  let clientStamm = null;
  try {
    const stammdaten = await base44.entities.Stammdatum.list();
    firma = stammdaten.find(s => s.typ === "unternehmen" && s.aktiv) || {};
    clientStamm = stammdaten.find(s =>
      (projekt.client_id && s.id === projekt.client_id) ||
      (!projekt.client_id && projekt.client && s.name === projekt.client && s.typ === "auftraggeber")
    );
  } catch (e) {
    firma = {};
    clientStamm = null;
  }

  const headerColor = firma.angebot_header_farbe ? hexToRgb(firma.angebot_header_farbe) : [70, 130, 180];
  const stufenLabel = { 1: "1. Mahnung", 2: "2. Mahnung", 3: "Letzte Mahnung" }[mahnstufe];

  // ─── HEADER (identisch zu Angebot/Rechnung) ───────────────────────────────
  // Absenderzeile
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(120);
  const absLine = [firma.name, firma.briefkopf_strasse,
    `${firma.briefkopf_plz || ""} ${firma.briefkopf_stadt || ""}`.trim()
  ].filter(Boolean).join(" | ");
  doc.text(absLine, ML, MT);

  // Empfängeradresse links
  let addrY = MT + 10;
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(40);
  if (clientStamm) {
    doc.text(clientStamm.name || "", ML, addrY); addrY += 5;
    if (clientStamm.adresse) {
      clientStamm.adresse.split(", ").forEach(l => { doc.text(l, ML, addrY); addrY += 4; });
    } else {
      if (clientStamm.briefkopf_strasse) { doc.text(clientStamm.briefkopf_strasse, ML, addrY); addrY += 4; }
      const plzStadt = `${clientStamm.briefkopf_plz || ""} ${clientStamm.briefkopf_stadt || ""}`.trim();
      if (plzStadt) { doc.text(plzStadt, ML, addrY); addrY += 4; }
    }
  } else if (projekt.client) {
    doc.text(projekt.client, ML, addrY); addrY += 5;
    if (projekt.location) { doc.text(projekt.location, ML, addrY); addrY += 4; }
  }

  // Rechts: Titel + Metadaten (wie Angebot/Rechnung)
  const infoBoxX = PW / 2 + 10;
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(40);
  doc.text(stufenLabel, infoBoxX, MT + 12);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(40);
  let detailY = MT + 19;
  const meta = [
    ["Projekt-Nr.:", projekt.project_number || "–"],
    ["Rechnung:", rechnung.rechnungsnummer || "–"],
    ["Datum:", format(new Date(), "dd.MM.yyyy")],
  ];
  meta.forEach(([label, val]) => {
    doc.text(label, infoBoxX, detailY);
    doc.text(val, infoBoxX + 28, detailY);
    detailY += 4;
  });

  // Projektname links
  let projectY = Math.max(addrY, detailY) + 4;
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(40);
  const projLines = doc.splitTextToSize(projekt.project_name || "", CW * 0.6);
  projLines.forEach((l, i) => doc.text(l, ML, projectY + i * 5));
  projectY += projLines.length * 5 + 3;

  // Trennlinie
  doc.setDrawColor(180);
  doc.line(ML, projectY, PW - MR, projectY);
  doc.setDrawColor(0);
  let y = projectY + 5;

  // ─── FLIESSTEXT ───────────────────────────────────────────────────────────
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(40);

  const textLines = [
    "Sehr geehrte Damen und Herren,",
    "",
    mahntext || STANDARD_TEXTE[mahnstufe]?.(rechnung) || "",
  ];

  textLines.forEach(line => {
    if (line === "") {
      y += 3;
    } else {
      const wrapped = doc.splitTextToSize(line, CW);
      wrapped.forEach(l => { doc.text(l, ML, y); y += 4; });
    }
  });
  y += 5;

  // ─── TABELLE (Forderung) ──────────────────────────────────────────────────
  doc.setFillColor(230, 240, 250);
  doc.rect(ML, y - 2, CW, 8, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(40);
  doc.text("Position", ML + 2, y + 4);
  doc.text("Betrag", PW - MR - 2, y + 4, { align: "right" });
  y += 10;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);

  const offen = (rechnung.betrag_brutto || 0) - (rechnung.zahlungseingang || 0) - (rechnung.einbehalt || 0);
  const verzugszins = basiszins + VERZUGSZINS_AUFSCHLAG;
  const verzugtage = differenceInDays(new Date(), parseISO(rechnung.faellig_am || rechnung.rechnungsdatum));
  const zinsbetrag = verzugtage > 0 ? offen * (verzugszins / 100) * (verzugtage / 365) : 0;

  const rows = [
    [`Rechnungsbetrag (brutto) – ${rechnung.rechnungsnummer}`, fmt(rechnung.betrag_brutto)],
    rechnung.zahlungseingang > 0 ? [`Bisherige Zahlungen`, `- ${fmt(rechnung.zahlungseingang)}`] : null,
  ].filter(Boolean);

  if (mahngebuehr > 0) rows.push([`Mahngebühr (${stufenLabel})`, fmt(mahngebuehr)]);
  if (verzugspauschale > 0) rows.push([`Verzugspauschale (§ 288 Abs. 5 BGB)`, fmt(verzugspauschale)]);
  if (zinsbetrag > 0) {
    rows.push([
      `Verzugszinsen ${verzugszins.toFixed(2)} % p.a. (Basiszins ${basiszins.toFixed(2)} % + 9 PP)\nfür ${verzugtage} Tage seit ${fmtDate(rechnung.faellig_am)}`,
      fmt(zinsbetrag),
    ]);
  }

  const gesamtForderung = offen + (mahngebuehr || 0) + (verzugspauschale || 0) + zinsbetrag;

  rows.forEach(([label, val], i) => {
    const textLines = doc.splitTextToSize(label, PW - ML - MR - 40);
    doc.text(textLines, ML + 2, y);
    doc.text(val, PW - MR - 2, y + (textLines.length > 1 ? 0 : 0), { align: "right" });
    y += Math.max(textLines.length * 4, 6);
  });

  // Gesamtforderung (fett, mit Trennlinie)
  doc.setDrawColor(150);
  doc.line(ML, y - 1, PW - MR, y - 1);
  y += 3;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Gesamtforderung", ML + 2, y);
  doc.text(fmt(gesamtForderung), PW - MR - 2, y, { align: "right" });
  y += 8;

  // ─── ZAHLUNGSAUFFORDERUNG ─────────────────────────────────────────────────
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(`Bitte überweisen Sie den Gesamtbetrag von ${fmt(gesamtForderung)} bis spätestens ${fmtDate(zahlungsfrist)}.`, ML, y);
  y += 10;

  // ─── SIGNATUR ──────────────────────────────────────────────────────────────
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("Mit freundlichen Grüßen,", ML, y);
  y += 6;
  doc.setFont("helvetica", "bold");
  doc.text(firma.name || "", ML, y);

  // Footer
  addFooterAllPages(doc, firma, PW, PH, ML, MR);

  doc.save(`Mahnung_${stufenLabel.replace(/\. /g, "_").replace(/ /g, "_")}_${rechnung.rechnungsnummer}.pdf`);
}

export default function MahnungDialog({ rechnung, projekt, stammdaten, open, onClose, onSave }) {
  const currentStufe = rechnung?.mahnstufe || 0;
  const nextStufe = Math.min(currentStufe + 1, 3);
  const [mahngebuehr, setMahngebuehr] = useState(DEFAULT_GEBUEHREN[nextStufe] || 0);
  const [verzugspauschale, setVerzugspauschale] = useState(40);
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

  const handlePDF = async () => {
    await exportMahnungPDF({ rechnung, projekt, mahnstufe: nextStufe, mahngebuehr, verzugspauschale, basiszins, zahlungsfrist, mahntext });
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
                  Verzugspauschale (€) <span className="font-normal">§ 288 Abs. 5</span>
                </label>
                <Input type="number" value={verzugspauschale} onChange={e => setVerzugspauschale(parseFloat(e.target.value) || 0)} className="h-8 text-xs" min={0} step={10} />
                <p className="text-[10px] text-muted-foreground mt-0.5">Pauschal 40 € bei B2B</p>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">
                  Basiszins (%) <span className="font-normal">aktuell</span>
                </label>
                <Input type="number" value={basiszins} onChange={e => setBasiszins(parseFloat(e.target.value) || 0)} className="h-8 text-xs" min={-5} max={15} step={0.1} />
                <p className="text-[10px] text-muted-foreground mt-0.5">Bundesbank, halbj. Anpassung</p>
              </div>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-md px-3 py-2 flex items-start gap-2">
              <Info className="w-3.5 h-3.5 text-amber-600 mt-0.5 shrink-0" />
              <div className="text-xs text-amber-800">
                <span className="font-semibold">Verzugszins: {(basiszins + VERZUGSZINS_AUFSCHLAG).toFixed(2)} % p.a.</span>
                {" "}(Basiszins {basiszins.toFixed(2)} % + 9 PP gem. § 288 Abs. 2 BGB)
                {verzugtage > 0 && (
                  <span className="block mt-0.5">Verzug seit {verzugtage} Tagen → ca. {fmt(zinsbetrag)}</span>
                )}
              </div>
            </div>
          </div>

          {/* Mahntext */}
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">
              Mahntext (Standardtext – anpassbar)
            </label>
            <textarea
              className="w-full border border-input rounded-md px-3 py-2 text-xs bg-background resize-none h-24"
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