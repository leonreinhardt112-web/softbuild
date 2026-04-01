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

  // 3. Rechts: Dokumenttitel + Metadaten
  const infoBoxX = W / 2 + 10;
  // Titel: "X. Abschlagsrechnung" mit Nummer
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(isStorno ? 150 : 40);
  const titelText = isStorno ? "Stornorechnung" : `${aufmass.ar_nummer || ""}. Abschlagsrechnung`;
  doc.text(titelText, infoBoxX, y + 12);

  // Kundennummer aus Stammdaten holen
  const clientStamm = (stammdaten || []).find(s => s.id === project.client_id || s.name === project.client);
  const kundennummer = clientStamm?.kundennummer || project.client_id || "–";

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(40);
  let detailY = y + 19;
  const metaData = [
    ["Projekt-Nr.:", project.project_number || "–"],
    ["ABR-Nr.:", aufmass.rechnungsnummer || "–"],
    ["Datum:", aufmass.datum ? new Date(aufmass.datum).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }) : "–"],
    ["Kunden-Nr.:", kundennummer],
  ];
  metaData.forEach(([label, val]) => {
    doc.setFont("helvetica", label === "ABR-Nr.:" ? "bold" : "normal");
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

  // === POSITIONSTABELLE ===
  const drawTableHeader = (yy) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setFillColor(...headerColor);
    doc.setTextColor(255, 255, 255);
    doc.rect(margin, yy - 2, contentW, 6, "F");
    const headers = ["Pos.", "Bezeichnung", "Menge", "ME", "Einzelpreis", "Gesamtpreis"];
    const colWidths = [18, 72, 16, 14, 24, 26];
    let xPos = margin;
    headers.forEach((h, i) => {
      const align = i >= 2 ? "right" : "left";
      const textX = align === "right" ? xPos + colWidths[i] - 2 : xPos + 2;
      doc.text(h, textX, yy + 2, { align });
      xPos += colWidths[i];
    });
    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "normal");
    return yy + 8;
  };

  // Subheader
  doc.setFontSize(8.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(40);
  doc.text(`Projekt-Nr.: ${project.project_number || "–"} / ABR-Nr.: ${aufmass.rechnungsnummer || "–"}`, margin, y);
  y += 4;

  y = drawTableHeader(y);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);

  const positionen = aufmass.positionen || [];

  for (const pos of positionen) {
    // Neue Seite?
    if (y > PAGE_BOTTOM - 8) {
      doc.addPage();
      y = margin;
      // Wiederholungs-Subheader
      doc.setFontSize(8.5);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(40);
      doc.text(`Projekt-Nr.: ${project.project_number || "–"} / ABR-Nr.: ${aufmass.rechnungsnummer || "–"}`, margin, y);
      y += 4;
      y = drawTableHeader(y);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
    }

    const textLines = doc.splitTextToSize(pos.short_text || "", 72);
    const rowH = Math.max(5, textLines.length * 4.2) + 1;

    // Gruppenüberschrift (keine Menge → fett)
    const isSumLine = !pos.einheit && !pos.ep;
    if (isSumLine) {
      doc.setFont("helvetica", "bold");
      doc.text(pos.oz || "", margin, y + 3);
      const titleLines = doc.splitTextToSize(pos.short_text || "", 130);
      doc.text(titleLines, margin + 18, y + 3);
      doc.setFont("helvetica", "normal");
      // Summe rechts
      if (pos.gp_kumuliert) {
        doc.setFont("helvetica", "bold");
        doc.text(`Summe ${pos.oz}`, W - margin - 28, y + 3, { align: "right" });
        doc.text(fmtEur(pos.gp_kumuliert), W - margin, y + 3, { align: "right" });
        doc.setFont("helvetica", "normal");
      }
      y += rowH + 1;
      continue;
    }

    doc.text(pos.oz || "", margin, y + 3);
    doc.text(textLines, margin + 18, y + 3);

    // Menge kumuliert (=abgerechnete Menge)
    const mengeKum = pos.menge_kumuliert || 0;
    if (mengeKum !== 0) {
      doc.text(fmt(mengeKum), W - margin - 72, y + 3, { align: "right" });
    }
    if (pos.einheit) doc.text(pos.einheit, W - margin - 52, y + 3);
    if (pos.ep) {
      doc.text(fmtEur(pos.ep), W - margin - 28, y + 3, { align: "right" });
      doc.text(fmtEur(pos.gp_kumuliert || 0), W - margin, y + 3, { align: "right" });
    } else if (pos.gp_kumuliert) {
      doc.text(fmtEur(pos.gp_kumuliert), W - margin, y + 3, { align: "right" });
    }

    y += rowH;
    doc.setDrawColor(220);
    doc.line(margin, y, W - margin, y);
    doc.setDrawColor(40);
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