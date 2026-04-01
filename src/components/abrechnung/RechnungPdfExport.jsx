import jsPDF from "jspdf";
import { hexToRgb, addFooterAllPages, getPageBottom } from "@/utils/pdfBriefkopf";

const ML = 20; // margin left
const MR = 20; // margin right
const MT = 20; // margin top

/**
 * Exportiert eine Abschlagsrechnung als PDF.
 * Formatierung 1:1 wie Angebot (KalkulationPdfExport).
 */
export function exportRechnungPDF({ aufmass, project, stammdaten }) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const PW = doc.internal.pageSize.getWidth();
  const PH = doc.internal.pageSize.getHeight();
  const CW = PW - ML - MR;
  const PAGE_BOTTOM = getPageBottom(PH);

  const firma = (stammdaten || []).find(s => s.typ === "unternehmen" && s.aktiv) || {};
  const clientStamm = (stammdaten || []).find(s =>
    (project.client_id && s.id === project.client_id) ||
    (!project.client_id && project.client && s.name === project.client && s.typ === "auftraggeber")
  );
  const headerColor = firma.angebot_header_farbe ? hexToRgb(firma.angebot_header_farbe) : [70, 130, 180];
  const isStorno = aufmass.rechnungsnummer?.startsWith("STORNO-");
  // Originalnummer extrahieren: "STORNO-RE 26005" → "RE 26005"
  const originalNr = isStorno ? aufmass.rechnungsnummer.replace(/^STORNO-/, "") : null;

  // ── HEADER (identisch zu Angebot) ──────────────────────────────────────────
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
  } else if (project.client) {
    doc.text(project.client, ML, addrY); addrY += 5;
    if (project.location) { doc.text(project.location, ML, addrY); addrY += 4; }
  }

  // Rechts: Titel + Metadaten (wie Angebot)
  const infoBoxX = PW / 2 + 10;
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(40);
  const titleText = isStorno ? "Stornorechnung" : `${aufmass.ar_nummer || ""}. Abschlagsrechnung`;
  doc.text(titleText, infoBoxX, MT + 12);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(40);
  let detailY = MT + 19;
  const meta = [
    ["Projekt-Nr.:", project.project_number || "–"],
    ["ABR-Nr.:", aufmass.rechnungsnummer || "–"],
    ["Datum:", aufmass.datum ? new Date(aufmass.datum).toLocaleDateString("de-DE") : "–"],
    ["Kunden-Nr.:", clientStamm?.kundennummer || "–"],
  ];
  meta.forEach(([label, val]) => {
    const isBold = label === "ABR-Nr.:";
    doc.setFont("helvetica", isBold ? "bold" : "normal");
    doc.setTextColor(isBold ? 30 : 40);
    doc.text(label, infoBoxX, detailY);
    doc.text(val, infoBoxX + 28, detailY);
    detailY += 4;
  });

  // Projektname links
  let projectY = Math.max(addrY, detailY) + 4;
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(40);
  const projLines = doc.splitTextToSize(project.project_name || "", CW * 0.6);
  projLines.forEach((l, i) => doc.text(l, ML, projectY + i * 5));
  projectY += projLines.length * 5 + 3;

  // Trennlinie
  doc.setDrawColor(180);
  doc.line(ML, projectY, PW - MR, projectY);
  doc.setDrawColor(0);
  let y = projectY + 5;

  // Vortext – bei Storno: Pflichthinweis auf Originalrechnung
  let vortext;
  if (isStorno) {
    vortext = `Hiermit stornieren wir unsere Rechnung Nr. ${originalNr} vom ${aufmass.datum ? new Date(aufmass.datum).toLocaleDateString("de-DE") : "–"} in voller Höhe. Diese Stornorechnung hebt die genannte Rechnung vollständig auf.`;
  } else {
    vortext = firma.rechnung_vortext || "Vielen Dank für Ihren Auftrag, den wir gerne für Sie ausgeführt haben.";
  }
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(40);
  doc.splitTextToSize(vortext, CW).forEach(l => { doc.text(l, ML, y); y += 4; });
  y += 2;

  // Spaltenstruktur – identisch zu Angebot (KalkulationPdfExport)
  // Pos=15, Bezeichnung=65, Menge=16, ME=13, EP=21, GP=20 → gesamt=150=CW
  const colW = [15, 65, 16, 13, 21, 20];
  let cx = ML;
  const colX = colW.map(w => { const x = cx; cx += w; return x; });
  // Rechtsbündig an Spaltenende-2mm, ME linksbündig
  const xMenge = colX[2] + colW[2] - 2;   // rechts in Mengenspalte
  const xME    = colX[3] + 1;              // links in ME-Spalte
  const xEP    = colX[4] + colW[4] - 2;   // rechts in EP-Spalte
  const xGP    = colX[5] + colW[5] - 2;   // rechts in GP-Spalte (= PW-MR-2)
  // Bezeichnungstext darf max bis Mengenspaltenanfang reichen
  const bezMaxW = colW[1] - 3;             // 62mm für Bezeichnung

  // ── TABELLEN-HEADER (identisch zu Angebot) ─────────────────────────────────
  const drawTableHeader = (yy) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setFillColor(...headerColor);
    doc.setTextColor(255, 255, 255);
    doc.rect(ML, yy - 2, CW, 6, "F");
    const headers = ["Pos.", "Bezeichnung", "Menge", "ME", "Einzelpreis", "Gesamtpreis"];
    let xp = ML;
    headers.forEach((h, i) => {
      const align = i >= 2 ? "right" : "left";
      doc.text(h, align === "right" ? xp + colW[i] - 2 : xp + 2, yy + 2, { align });
      xp += colW[i];
    });
    doc.setTextColor(0); doc.setFont("helvetica", "normal");
    return yy + 10;
  };

  // Subheader-Zeile
  doc.setFontSize(8.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(40);
  doc.text(`Projekt-Nr.: ${project.project_number || "–"} / ABR-Nr.: ${aufmass.rechnungsnummer || "–"}`, ML, y);
  y += 4;
  y = drawTableHeader(y);

  // ── POSITIONEN (mit Titeln & Untertiteln, nur Menge > 0) ───────────────────
  const allePos = aufmass.positionen || [];
  const positionenMitMenge = new Set(
    allePos.filter(p => (p.menge_kumuliert || 0) !== 0).map(p => p.oz)
  );
  const isHT = (oz) => oz && /^\d{2}$/.test(oz.trim());
  const isUT = (oz) => oz && /^\d{2}\.\d{2}$/.test(oz.trim());
  const htHatPos = (oz) => allePos.some(p => p.oz && p.oz.startsWith(oz + ".") && positionenMitMenge.has(p.oz));
  const utHatPos = (oz) => allePos.some(p => p.oz && p.oz.startsWith(oz + ".") && positionenMitMenge.has(p.oz));

  const newPage = () => {
    doc.addPage();
    y = MT;
    doc.setFontSize(8.5); doc.setFont("helvetica", "bold"); doc.setTextColor(40);
    doc.text(`Projekt-Nr.: ${project.project_number || "–"} / ABR-Nr.: ${aufmass.rechnungsnummer || "–"}`, ML, y);
    y += 4;
    y = drawTableHeader(y);
  };

  // Titel-Summen für "Summe Titel"-Zeile berechnen
  const titelSummen = {};
  let lastUT = null;
  for (const p of allePos) {
    const oz = (p.oz || "").trim();
    if (isUT(oz)) { lastUT = oz; titelSummen[oz] = 0; }
    else if (!isHT(oz) && lastUT) {
      titelSummen[lastUT] = (titelSummen[lastUT] || 0) + (p.gp_kumuliert || 0);
    }
  }

  let rowIndex = 0;
  let currentUT = null;
  for (const pos of allePos) {
    const oz = (pos.oz || "").trim();

    if (isHT(oz)) {
      if (!htHatPos(oz)) continue;
      if (y > PAGE_BOTTOM - 8) newPage();
      doc.setFont("helvetica", "bold"); doc.setFontSize(10);
      doc.setFillColor(...headerColor); doc.setTextColor(255, 255, 255);
      doc.rect(ML, y - 2, CW, 6, "F");
      doc.text(oz, ML + 1, y + 2);
      doc.text(pos.short_text || "", ML + 27, y + 2);
      doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(40);
      y += 8;
      continue;
    }

    if (isUT(oz)) {
      if (!utHatPos(oz)) { currentUT = null; continue; }
      if (y > PAGE_BOTTOM - 8) newPage();
      doc.setFont("helvetica", "bold"); doc.setFontSize(9);
      doc.setFillColor(230, 240, 250); doc.setTextColor(40);
      doc.rect(ML, y - 2, CW, 6, "F");
      doc.text(oz, ML + 1, y + 2);
      doc.text(pos.short_text || "", ML + 27, y + 2);
      doc.setFont("helvetica", "normal"); doc.setTextColor(40);
      y += 8;
      currentUT = oz;
      continue;
    }

    if (!positionenMitMenge.has(oz)) continue;
    if (y > PAGE_BOTTOM - 8) newPage();

    const textLines = doc.splitTextToSize(pos.short_text || "", bezMaxW);
    const rowH = Math.max(7, textLines.length * 3.5) + 2;

    if (rowIndex % 2 === 1) {
      doc.setFillColor(248, 248, 248);
      doc.rect(ML, y - 2.5, CW, rowH, "F");
    }
    rowIndex++;

    doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(40);
    // OZ: ab ML+1, Bezeichnung: ab ML+27 (wie Angebot: MARGIN_LEFT+27)
    doc.text(oz, ML + 1, y + 1);
    textLines.forEach((l, i) => doc.text(l, ML + 27, y + 1 + i * 3.5));
    // Zahlen rechtsbündig in ihrer Spalte
    doc.text((pos.menge_kumuliert || 0).toLocaleString("de-DE", { minimumFractionDigits: 2 }), xMenge, y + 1, { align: "right" });
    if (pos.einheit) doc.text(pos.einheit, xME, y + 1);
    doc.text((pos.ep || 0).toLocaleString("de-DE", { minimumFractionDigits: 2 }) + " €", xEP, y + 1, { align: "right" });
    doc.setFont("helvetica", "bold");
    doc.text((pos.gp_kumuliert || 0).toLocaleString("de-DE", { minimumFractionDigits: 2 }) + " €", xGP, y + 1, { align: "right" });
    doc.setFont("helvetica", "normal");

    y += rowH;
    doc.setDrawColor(220); doc.line(ML, y, PW - MR, y); doc.setDrawColor(0);
    y += 1;

    // "Summe Titel" nach letzter Pos des Untertitels
    const nextPos = allePos[allePos.indexOf(pos) + 1];
    const nextOz = (nextPos?.oz || "").trim();
    if (currentUT && (!nextPos || isUT(nextOz) || isHT(nextOz))) {
      if (y > PAGE_BOTTOM - 8) newPage();
      const sum = titelSummen[currentUT] || 0;
      doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(40);
      doc.text("Summe Titel", ML + 86, y + 2);
      doc.text(sum.toLocaleString("de-DE", { minimumFractionDigits: 2 }) + " €", PW - MR - 2, y + 2, { align: "right" });
      doc.setFont("helvetica", "normal");
      y += 6;
    }
  }

  // ── SUMMENBLOCK (identisch zu Angebot) ─────────────────────────────────────
  if (y > PAGE_BOTTOM - 50) { doc.addPage(); y = MT + 10; }
  y += 4;
  doc.setDrawColor(40); doc.line(ML, y, PW - MR, y); doc.setDrawColor(0);
  y += 7;

  // Bei Storno alle Beträge negativ (Storno hebt Originalrechnung auf)
  const nettoAbs = Math.abs(aufmass.betrag_netto || 0);
  const sign = isStorno ? -1 : 1;
  const netto = sign * nettoAbs;
  const mwst = netto * 0.19;
  const brutto = netto * 1.19;
  const valX = PW - MR - 30;

  doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(40);
  doc.text("Summe-Netto:", ML, y);
  doc.text(netto.toLocaleString("de-DE", { minimumFractionDigits: 2 }) + " €", valX, y, { align: "right" });
  y += 7;
  doc.text("19,00 % MwSt.:", ML, y);
  doc.text(mwst.toLocaleString("de-DE", { minimumFractionDigits: 2 }) + " €", valX, y, { align: "right" });
  y += 7;
  doc.setFont("helvetica", "bold");
  doc.text("Summe-Brutto:", ML, y);
  doc.text(brutto.toLocaleString("de-DE", { minimumFractionDigits: 2 }) + " €", valX, y, { align: "right" });

  // Fälligkeit / Storno-Hinweis + Schlusstext
  y += 10;
  doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(40);
  if (isStorno) {
    doc.text(`Der Betrag von ${Math.abs(brutto).toLocaleString("de-DE", { minimumFractionDigits: 2 })} € wird Ihnen gutgeschrieben.`, ML, y);
    y += 6;
  } else if (aufmass.datum) {
    const faellig = new Date(new Date(aufmass.datum).getTime() + 30 * 24 * 60 * 60 * 1000);
    doc.text(`Bitte überweisen Sie den Rechnungsbetrag ohne Abzug bis zum: ${faellig.toLocaleDateString("de-DE")}`, ML, y);
    y += 6;
  }
  const schlusstext = firma.rechnung_schlusstext || "Wir bedanken uns herzlich für die angenehme Zusammenarbeit und stehen Ihnen bei Fragen jederzeit gerne zur Verfügung.";
  doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(40);
  doc.splitTextToSize(schlusstext, CW).forEach(l => { doc.text(l, ML, y); y += 4; });

  addFooterAllPages(doc, firma, PW, PH, ML, MR);
  const fn = `${isStorno ? "STORNO" : aufmass.rechnungsnummer || "Rechnung"}_${project.project_number || ""}.pdf`.replace(/\s/g, "_");
  doc.save(fn);
}