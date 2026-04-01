import { jsPDF } from "jspdf";
import { addFooterAllPages, getPageBottom, hexToRgb } from "@/utils/pdfBriefkopf";

/**
 * Erstellt ein professionelles PDF einer Abschlagsrechnung
 * im gleichen Layout wie das Angebot.
 */
export function exportRechnungPDF({ aufmass, project, stammdaten }) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210;
  const H = 297;
  const margin = 20;
  const contentW = W - 2 * margin;
  const isStorno = aufmass.rechnungsnummer?.startsWith("STORNO-");

  const fmt = (n) => (n || 0).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtEur = (n) => fmt(n) + " €";

  const firma = (stammdaten || []).find(s => s.typ === "unternehmen" && s.aktiv) || {};
  const headerColor = firma.angebot_header_farbe ? hexToRgb(firma.angebot_header_farbe) : [70, 130, 180];
  const PAGE_BOTTOM = getPageBottom(H);

  // ===================== SEITE 1 – HEADER (identisch zum Angebot) =====================
  let y = margin;

  // 1. Absenderzeile oben links (klein, grau)
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(120);
  const absLine = [firma.name, firma.briefkopf_strasse, `${firma.briefkopf_plz || ""} ${firma.briefkopf_stadt || ""}`.trim()].filter(Boolean).join(" | ");
  doc.text(absLine, margin, y);

  // 2. Empfängeradresse links
  let addrY = y + 10;
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(40);
  const empfLines = [project.client || "–", project.location || ""].filter(Boolean);
  empfLines.forEach(line => { doc.text(line, margin, addrY); addrY += 5; });

  // 3. Rechts: Dokumenttitel + Metadaten – exakt wie Angebot-Layout
  const infoBoxX = W / 2 + 10;
  // Titel groß, rechtsbündig (wie Angebot aber größer)
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(isStorno ? 120 : 30);
  const titelText = isStorno ? "Stornorechnung" : `${aufmass.ar_nummer || ""}. Abschlagsrechnung`;
  doc.text(titelText, W - margin, y + 10, { align: "right" });

  // Kundennummer aus Stammdaten holen (immer kundennummer-Feld, nie die DB-ID)
  const clientStamm = (stammdaten || []).find(s =>
    (project.client_id && s.id === project.client_id) ||
    (project.client && s.name === project.client && s.typ === "auftraggeber")
  );
  const kundennummer = clientStamm?.kundennummer || "–";

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(40);
  let detailY = y + 17;
  const metaData = [
    ["Projekt-Nr.:", project.project_number || "–"],
    ["ABR-Nr.:", aufmass.rechnungsnummer || "–"],
    ["Datum:", aufmass.datum ? new Date(aufmass.datum).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }) : "–"],
    ["Kunden-Nr.:", kundennummer],
  ];
  metaData.forEach(([label, val]) => {
    doc.setFont("helvetica", label === "ABR-Nr.:" ? "bold" : "normal");
    doc.setTextColor(label === "ABR-Nr.:" ? 30 : 40);
    doc.text(label, infoBoxX, detailY);
    doc.text(val, infoBoxX + 28, detailY);
    detailY += 4;
  });

  // 4. Projektname fett
  let projectY = Math.max(addrY, detailY) + 4;
  doc.setFontSize(9.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(40);
  const projektLines = doc.splitTextToSize(project.project_name || "", contentW * 0.6);
  projektLines.forEach((line, idx) => { doc.text(line, margin, projectY + idx * 4.5); });
  projectY += projektLines.length * 4.5;

  // Trennlinie
  projectY += 3;
  doc.setDrawColor(180);
  doc.line(margin, projectY, W - margin, projectY);
  doc.setDrawColor(0);

  y = projectY + 5;

  // Vortext
  const vortext = firma.rechnung_vortext || "Vielen Dank für Ihren Auftrag, den wir gerne für Sie ausgeführt haben.";
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(60);
  doc.text(vortext, margin, y);
  y += 6;

  // === POSITIONSTABELLE – identisch zum Angebot-Layout ===
  // Spaltenbreiten identisch zum Angebot
  const COL_WIDTHS = [15, 65, 16, 13, 21, 20]; // Pos, Bezeichnung, Menge, ME, EP, GP
  const COL_HEADERS = ["Pos.", "Bezeichnung", "Menge", "ME", "Einzelpreis", "Gesamtpreis"];

  const drawTableHeader = (yy) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setFillColor(...headerColor);
    doc.setTextColor(255, 255, 255);
    doc.rect(margin, yy - 2, contentW, 6, "F");
    let xPos = margin;
    COL_HEADERS.forEach((h, i) => {
      const align = i >= 2 ? "right" : "left";
      const textX = align === "right" ? xPos + COL_WIDTHS[i] - 2 : xPos + 2;
      doc.text(h, textX, yy + 2, { align });
      xPos += COL_WIDTHS[i];
    });
    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "normal");
    return yy + 8;
  };

  // Col-X-Positionen berechnen
  const colX = [];
  let cx = margin;
  COL_WIDTHS.forEach(w => { colX.push(cx); cx += w; });
  // Rechtsbündige Spalten-Endpunkte
  const xMenge = colX[2] + COL_WIDTHS[2] - 2;
  const xME = colX[3] + 1;
  const xEP = colX[4] + COL_WIDTHS[4] - 2;
  const xGP = colX[5] + COL_WIDTHS[5] - 2;

  // Subheader
  doc.setFontSize(8.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(40);
  doc.text(`Projekt-Nr.: ${project.project_number || "–"} / ABR-Nr.: ${aufmass.rechnungsnummer || "–"}`, margin, y);
  y += 4;

  y = drawTableHeader(y);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);

  // Nur Positionen mit tatsächlicher Menge (menge_kumuliert > 0) anzeigen
  const allePositionen = aufmass.positionen || [];
  const positionenMitMenge = new Set(
    allePositionen.filter(p => (p.menge_kumuliert || 0) !== 0).map(p => p.oz)
  );

  // Hilfsfunktion: Prüft ob ein Unter-/Haupttitel mindestens eine sichtbare Position hat
  const hauptTitelHatPositionen = (hauptOz) =>
    allePositionen.some(p => p.oz && p.oz.startsWith(hauptOz + ".") && positionenMitMenge.has(p.oz));
  const unterTitelHatPositionen = (unterOz) =>
    allePositionen.some(p => p.oz && p.oz.startsWith(unterOz + ".") && positionenMitMenge.has(p.oz));

  const isHauptTitel = (oz) => oz && /^\d{2}$/.test(oz.trim());
  const isUnterTitel = (oz) => oz && /^\d{2}\.\d{2}$/.test(oz.trim());

  const renderNewPage = () => {
    doc.addPage();
    y = margin;
    doc.setFontSize(8.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(40);
    doc.text(`Projekt-Nr.: ${project.project_number || "–"} / ABR-Nr.: ${aufmass.rechnungsnummer || "–"}`, margin, y);
    y += 4;
    y = drawTableHeader(y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
  };

  let rowIndex = 0;
  for (const pos of allePositionen) {
    const oz = (pos.oz || "").trim();

    // Haupttitel: nur anzeigen wenn darunter sichtbare Positionen
    if (isHauptTitel(oz)) {
      if (!hauptTitelHatPositionen(oz)) continue;
      if (y > PAGE_BOTTOM - 8) renderNewPage();
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setFillColor(...headerColor);
      doc.setTextColor(255, 255, 255);
      doc.rect(margin, y - 2, contentW, 6, "F");
      doc.text(oz, margin + 1, y + 2);
      doc.text(pos.short_text || "", margin + 20, y + 2);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(40);
      y += 8;
      continue;
    }

    // Untertitel: nur anzeigen wenn darunter sichtbare Positionen
    if (isUnterTitel(oz)) {
      if (!unterTitelHatPositionen(oz)) continue;
      if (y > PAGE_BOTTOM - 8) renderNewPage();
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setFillColor(230, 240, 250);
      doc.setTextColor(40);
      doc.rect(margin, y - 2, contentW, 6, "F");
      doc.text(oz, margin + 1, y + 2);
      doc.text(pos.short_text || "", margin + 20, y + 2);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(40);
      y += 8;
      continue;
    }

    // Normale Position: nur anzeigen wenn Menge vorhanden
    if (!positionenMitMenge.has(oz)) continue;

    if (y > PAGE_BOTTOM - 8) renderNewPage();

    const textLines = doc.splitTextToSize(pos.short_text || "", COL_WIDTHS[1] - 2);
    const rowH = Math.max(7, textLines.length * 3.5) + 2;

    if (rowIndex % 2 === 1) {
      doc.setFillColor(248, 248, 248);
      doc.rect(margin, y - 2.5, contentW, rowH, "F");
    }
    rowIndex++;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(40);

    doc.text(oz, margin + 1, y + 1);
    textLines.forEach((line, idx) => doc.text(line, margin + 20, y + 1 + idx * 3.5));

    const mengeKum = pos.menge_kumuliert || 0;
    doc.text(mengeKum.toLocaleString("de-DE", { minimumFractionDigits: 2 }), xMenge, y + 1, { align: "right" });
    if (pos.einheit) doc.text(pos.einheit, xME, y + 1);
    doc.text(fmtEur(pos.ep || 0), xEP, y + 1, { align: "right" });
    doc.setFont("helvetica", "bold");
    doc.text(fmtEur(pos.gp_kumuliert || 0), xGP, y + 1, { align: "right" });
    doc.setFont("helvetica", "normal");

    y += rowH;
    doc.setDrawColor(220);
    doc.line(margin, y, W - margin, y);
    doc.setDrawColor(0);
    y += 1;
  }

  // ===================== SUMMENBLOCK =====================
  if (y > PAGE_BOTTOM - 40) {
    doc.addPage();
    y = margin + 10;
    doc.setFontSize(8.5);
    doc.setFont("helvetica", "bold");
    doc.text(`Projekt-Nr.: ${project.project_number || "–"} / ABR-Nr.: ${aufmass.rechnungsnummer || "–"}`, margin, y);
    y += 8;
  }

  y += 4;
  doc.setDrawColor(40);
  doc.line(margin, y, W - margin, y);
  y += 5;

  const betragNetto = aufmass.betrag_netto || 0;
  const mwstSatz = 19;
  const mwstBetrag = betragNetto * (mwstSatz / 100);
  const betragBrutto = betragNetto + mwstBetrag;
  const gezahlt = aufmass.zahlungseingang || 0;
  const nochOffen = Math.max(0, betragBrutto - gezahlt);

  const sumBlock = [
    ["Summe-Netto:", fmtEur(betragNetto), false],
    [`${mwstSatz},00 % MwSt.:`, fmtEur(mwstBetrag), false],
    ["Summe-Brutto:", fmtEur(isStorno ? -betragBrutto : betragBrutto), true],
  ];
  if (gezahlt > 0) {
    sumBlock.push(["Abzüglich geleistete Zahlungen:", `-${fmtEur(gezahlt)}`, false]);
    sumBlock.push(["Noch zu zahlender Betrag:", fmtEur(nochOffen), true]);
  }

  const labelX = W - margin - 80;
  const valX = W - margin;
  doc.setFontSize(9);
  sumBlock.forEach(([label, val, bold]) => {
    if (bold) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
    } else {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
    }
    doc.setTextColor(40);
    doc.text(label, labelX, y, { align: "right" });
    doc.text(val, valX, y, { align: "right" });
    y += bold ? 6.5 : 5.5;
  });

  // Fälligkeit
  y += 3;
  if (aufmass.datum) {
    const fällig = new Date(new Date(aufmass.datum).getTime() + 30 * 24 * 60 * 60 * 1000);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(40);
    doc.text(`Bitte überweisen Sie den Rechnungsbetrag ohne Abzug bis zum: ${fällig.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" })}`, margin, y);
    y += 6;
  }

  // Schlusstext
  const schlusstext = firma.rechnung_schlusstext || "Wir bedanken uns herzlich für die angenehme Zusammenarbeit und stehen Ihnen bei Fragen jederzeit gerne zur Verfügung.";
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(40);
  const schlussLines = doc.splitTextToSize(schlusstext, contentW);
  doc.text(schlussLines, margin, y);

  // === FOOTER auf allen Seiten ===
  addFooterAllPages(doc, firma, W, H, margin, margin);

  // === SPEICHERN ===
  const prefix = isStorno ? "STORNO" : aufmass.rechnungsnummer || "Rechnung";
  const filename = `${prefix}_${project.project_number || ""}.pdf`.replace(/\s/g, "_");
  doc.save(filename);
}