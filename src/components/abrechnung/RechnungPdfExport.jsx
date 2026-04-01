import { jsPDF } from "jspdf";

/**
 * Erstellt ein professionelles PDF einer Abschlagsrechnung
 * im Stil des OWL-Bau-Brieflayouts.
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

  // Unternehmensdaten aus Stammdaten
  const firma = (stammdaten || []).find(s => s.typ === "unternehmen" && s.aktiv) || {};

  const FOOTER_H = 20; // Fußzeile reserviert
  const PAGE_BOTTOM = H - FOOTER_H - 5;

  let currentPage = 1;
  let totalPages = 1; // wird am Ende gesetzt

  const addFooter = () => {
    const pg = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pg; i++) {
      doc.setPage(i);
      // Fußzeilen-Hintergrund
      const footerY = H - FOOTER_H;
      doc.setFillColor(245, 245, 245);
      doc.rect(0, footerY, W, FOOTER_H, "F");
      doc.setDrawColor(200);
      doc.line(0, footerY, W, footerY);

      doc.setFontSize(7);
      doc.setTextColor(100);
      doc.setFont("helvetica", "normal");

      const col = W / 3;
      const lines1 = (firma.pdf_footer_links || `${firma.name || ""}\n${firma.briefkopf_strasse || ""}\n${firma.briefkopf_plz || ""} ${firma.briefkopf_stadt || ""}\nT: ${firma.briefkopf_telefon || ""}\nE: ${firma.briefkopf_email || ""}`).split("\n");
      const lines2 = (firma.pdf_footer_mitte || "").split("\n");
      const lines3 = (firma.pdf_footer_rechts || "").split("\n");

      let fy = footerY + 4;
      lines1.forEach(l => { doc.text(l.trim(), margin, fy); fy += 3.2; });

      fy = footerY + 4;
      lines2.forEach(l => { doc.text(l.trim(), W / 2, fy, { align: "center" }); fy += 3.2; });

      fy = footerY + 4;
      lines3.forEach(l => { doc.text(l.trim(), W - margin, fy, { align: "right" }); fy += 3.2; });

      // Seitenzahl
      doc.setFont("helvetica", "bold");
      doc.text(`Seite ${i} von ${pg}`, W - margin, H - 4, { align: "right" });
    }
  };

  const drawPageHeader = (y) => {
    // Absenderzeile oben (klein, grau)
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(120);
    const absenderZeile = [firma.name, firma.briefkopf_strasse, `D-${firma.briefkopf_plz} ${firma.briefkopf_stadt}`].filter(Boolean).join(" | ");
    doc.text(absenderZeile, margin, y);
    return y + 8;
  };

  // ===================== SEITE 1 =====================
  let y = margin;

  // === Rechte Seite: Firmeninfo Box ===
  const infoBoxX = W / 2 + 10;
  const infoBoxW = W - margin - infoBoxX;

  // Firmenname bold
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(40);
  doc.text(firma.name || "Unser Unternehmen", infoBoxX, y);
  y += 5;

  // Kategorien (kursiv, blau)
  if (firma.qualifikation) {
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(30, 80, 160);
    const qualLines = doc.splitTextToSize(firma.qualifikation, infoBoxW);
    doc.text(qualLines, infoBoxX, y);
    y += qualLines.length * 3.5 + 2;
  }

  // Absenderzeile
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(80);
  const absenderZeile2 = [firma.name, firma.briefkopf_strasse, `D-${firma.briefkopf_plz || ""} ${firma.briefkopf_stadt || ""}`].filter(Boolean).join(" | ");
  doc.text(absenderZeile2, margin, y + 2);

  // AR-Nummer Box (rechts oben)
  const arBoxY = margin;
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(isStorno ? 180 : 40);
  doc.text(`${aufmass.ar_nummer || ""}.`, infoBoxX, arBoxY + 8);
  doc.setFontSize(14);
  doc.text(isStorno ? "Stornorechnung" : "Abschlagsrechnung", infoBoxX, arBoxY + 16);

  // Metadaten (Projekt-Nr., ABR-Nr., Datum, Kunden-Nr.)
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(40);
  const metaY = arBoxY + 20;
  const metaData = [
    ["Projekt-Nr.:", project.project_number || "–"],
    ["ABR-Nr.:", aufmass.rechnungsnummer || "–"],
    ["Datum:", aufmass.datum ? new Date(aufmass.datum).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }) : "–"],
    ["Kunden-Nr.:", project.client_id || "–"],
  ];
  metaData.forEach(([label, val], i) => {
    doc.setFont("helvetica", label === "ABR-Nr.:" ? "bold" : "normal");
    doc.text(label, infoBoxX, metaY + i * 5);
    doc.setFont("helvetica", label === "ABR-Nr.:" ? "bold" : "normal");
    doc.text(val, infoBoxX + 25, metaY + i * 5);
  });

  y = margin + 18;

  // === Empfängeradresse (links) ===
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(40);
  const empfLines = [
    project.client || "–",
    project.location || "",
  ].filter(Boolean);
  empfLines.forEach(line => { doc.text(line, margin, y); y += 5; });

  y = Math.max(y, metaY + metaData.length * 5 + 8);
  y += 6;

  // === Betreff / Projektname ===
  doc.setFontSize(9.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(40);
  const projektText = [
    project.project_name,
    project.location ? `Vergabenummer ${project.project_number}` : "",
  ].filter(Boolean);
  projektText.forEach(line => { doc.text(line, margin, y); y += 4.5; });
  y += 3;

  // Vortext
  if (firma.rechnung_vortext) {
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(60);
    doc.text(firma.rechnung_vortext, margin, y);
    y += 5;
  } else {
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(60);
    doc.text("Vielen Dank für Ihren Auftrag, den wir gerne für Sie ausgeführt haben.", margin, y);
    y += 5;
  }
  y += 2;

  // === POSITIONSTABELLE ===
  // Header-Zeile
  const drawTableHeader = (yy) => {
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(40);
    doc.setDrawColor(40);
    doc.line(margin, yy, W - margin, yy);
    yy += 4;
    doc.text("Pos.", margin, yy);
    doc.text("Bezeichnung", margin + 18, yy);
    doc.text("Menge", W - margin - 72, yy, { align: "right" });
    doc.text("ME", W - margin - 55, yy);
    doc.text("Einzelpreis", W - margin - 28, yy, { align: "right" });
    doc.text("Gesamtpreis", W - margin, yy, { align: "right" });
    yy += 2;
    doc.line(margin, yy, W - margin, yy);
    return yy + 4;
  };

  // Projekt-Nr. / ABR-Nr. Subheader
  doc.setFontSize(8.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(40);
  doc.text(`Projekt-Nr.: ${project.project_number || "–"} / ABR-Nr.: ${aufmass.rechnungsnummer || "–"}`, margin, y);
  y += 2;

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
      doc.text(`Projekt-Nr.: ${project.project_number || "–"} / ABR-Nr.: ${aufmass.rechnungsnummer || "–"}`, margin, y);
      y += 2;
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
  addFooter();

  // === SPEICHERN ===
  const prefix = isStorno ? "STORNO" : aufmass.rechnungsnummer || "Rechnung";
  const filename = `${prefix}_${project.project_number || ""}.pdf`.replace(/\s/g, "_");
  doc.save(filename);
}