import { jsPDF } from "jspdf";
import { addFooterAllPages, getPageBottom, hexToRgb } from "@/utils/pdfBriefkopf";

export function exportSchlussrechnungPDF({ schlussrechnung, project, stammdaten, vorherigeAufmasse }) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210;
  const H = 297;
  const margin = 20;
  const contentW = W - 2 * margin;

  const fmt = (n) => (n || 0).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtEur = (n) => fmt(n) + " €";

  const firma = (stammdaten || []).find(s => s.typ === "unternehmen" && s.aktiv) || {};
  const headerColor = firma.angebot_header_farbe ? hexToRgb(firma.angebot_header_farbe) : [70, 130, 180];
  const PAGE_BOTTOM = getPageBottom(H);

  let y = margin;

  // Absenderzeile
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(120);
  const absLine = [firma.name, firma.briefkopf_strasse, `${firma.briefkopf_plz || ""} ${firma.briefkopf_stadt || ""}`.trim()].filter(Boolean).join(" | ");
  doc.text(absLine, margin, y);

  // Empfänger
  let addrY = y + 10;
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(40);
  const empfLines = [project.client || "–", project.location || ""].filter(Boolean);
  empfLines.forEach(line => { doc.text(line, margin, addrY); addrY += 5; });

  // Titel rechtsbündig
  const infoBoxX = W / 2 + 10;
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30);
  doc.text("Schlussrechnung", W - margin, y + 10, { align: "right" });

  // Kundennummer
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
    ["Rech.-Nr.:", schlussrechnung.rechnungsnummer || "–"],
    ["Datum:", schlussrechnung.datum ? new Date(schlussrechnung.datum).toLocaleDateString("de-DE") : "–"],
    ["Kunden-Nr.:", kundennummer],
  ];
  metaData.forEach(([label, val]) => {
    doc.setFont("helvetica", label === "Rech.-Nr.:" ? "bold" : "normal");
    doc.setTextColor(label === "Rech.-Nr.:" ? 30 : 40);
    doc.text(label, infoBoxX, detailY);
    doc.text(val, infoBoxX + 28, detailY);
    detailY += 4;
  });

  // Projektname
  let projectY = Math.max(addrY, detailY) + 4;
  doc.setFontSize(9.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(40);
  const projektLines = doc.splitTextToSize(project.project_name || "", contentW * 0.6);
  projektLines.forEach((line, idx) => doc.text(line, margin, projectY + idx * 4.5));
  projectY += projektLines.length * 4.5;

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

  // Tabellenkopf
  const COL_WIDTHS = [15, 65, 16, 13, 21, 20];
  const COL_HEADERS = ["Pos.", "Bezeichnung", "Menge", "ME", "Einzelpreis", "Gesamtpreis"];
  const colX = [];
  let cx = margin;
  COL_WIDTHS.forEach(w => { colX.push(cx); cx += w; });
  const xMenge = colX[2] + COL_WIDTHS[2] - 2;
  const xME = colX[3] + 1;
  const xEP = colX[4] + COL_WIDTHS[4] - 2;
  const xGP = colX[5] + COL_WIDTHS[5] - 2;

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
    doc.setTextColor(0); doc.setFont("helvetica", "normal");
    return yy + 8;
  };

  doc.setFontSize(8.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(40);
  doc.text(`Projekt-Nr.: ${project.project_number || "–"} / SR-Nr.: ${schlussrechnung.rechnungsnummer || "–"}`, margin, y);
  y += 4;
  y = drawTableHeader(y);

  const positionen = schlussrechnung.positionen || [];
  const isHauptTitel = (oz) => oz && /^\d{2}$/.test(oz.trim());
  const isUnterTitel = (oz) => oz && /^\d{2}\.\d{2}$/.test(oz.trim());

  let rowIndex = 0;
  for (const pos of positionen) {
    if (y > PAGE_BOTTOM - 8) {
      doc.addPage();
      y = margin;
      doc.setFontSize(8.5); doc.setFont("helvetica", "bold"); doc.setTextColor(40);
      doc.text(`Projekt-Nr.: ${project.project_number || "–"} / SR-Nr.: ${schlussrechnung.rechnungsnummer || "–"}`, margin, y);
      y += 4;
      y = drawTableHeader(y);
    }

    const oz = (pos.oz || "").trim();

    if (isHauptTitel(oz)) {
      doc.setFont("helvetica", "bold"); doc.setFontSize(10);
      doc.setFillColor(...headerColor); doc.setTextColor(255, 255, 255);
      doc.rect(margin, y - 2, contentW, 6, "F");
      doc.text(oz, margin + 1, y + 2);
      doc.text(pos.short_text || "", margin + 20, y + 2);
      doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(40);
      y += 8; continue;
    }

    if (isUnterTitel(oz)) {
      doc.setFont("helvetica", "bold"); doc.setFontSize(9);
      doc.setFillColor(230, 240, 250); doc.setTextColor(40);
      doc.rect(margin, y - 2, contentW, 6, "F");
      doc.text(oz, margin + 1, y + 2);
      doc.text(pos.short_text || "", margin + 20, y + 2);
      doc.setFont("helvetica", "normal"); doc.setTextColor(40);
      y += 8; continue;
    }

    const textLines = doc.splitTextToSize(pos.short_text || "", COL_WIDTHS[1] - 2);
    const rowH = Math.max(7, textLines.length * 3.5) + 2;

    if (rowIndex % 2 === 1) {
      doc.setFillColor(248, 248, 248);
      doc.rect(margin, y - 2.5, contentW, rowH, "F");
    }
    rowIndex++;

    doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(40);
    doc.text(oz, margin + 1, y + 1);
    textLines.forEach((line, idx) => doc.text(line, margin + 20, y + 1 + idx * 3.5));

    const menge = pos.menge_gesamt || 0;
    if (menge !== 0) doc.text(menge.toLocaleString("de-DE", { minimumFractionDigits: 2 }), xMenge, y + 1, { align: "right" });
    if (pos.einheit) doc.text(pos.einheit, xME, y + 1);
    if (pos.ep) {
      doc.text(fmtEur(pos.ep), xEP, y + 1, { align: "right" });
      doc.setFont("helvetica", "bold");
      doc.text(fmtEur(pos.gp_gesamt || 0), xGP, y + 1, { align: "right" });
      doc.setFont("helvetica", "normal");
    }

    y += rowH;
    doc.setDrawColor(220); doc.line(margin, y, W - margin, y); doc.setDrawColor(0);
    y += 1;
  }

  // Summenblock
  if (y > PAGE_BOTTOM - 60) { doc.addPage(); y = margin + 10; }
  y += 4;
  doc.setDrawColor(40); doc.line(margin, y, W - margin, y); y += 5;

  const betragGesamt = schlussrechnung.betrag_netto || 0;
  const summeARs = schlussrechnung.betrag_vorperioden || 0;
  const restbetrag = schlussrechnung.betrag_aktuell || 0;
  const mwst = restbetrag * 0.19;
  const brutto = restbetrag + mwst;

  const labelX = W - margin - 90;
  const valX = W - margin;
  doc.setFontSize(9);

  const sumBlock = [
    ["Gesamtleistung netto:", fmtEur(betragGesamt), false],
    ["Abzug Abschlagsrechnungen:", `- ${fmtEur(summeARs)}`, false],
    ["Restbetrag netto:", fmtEur(restbetrag), false],
    ["19,00 % MwSt.:", fmtEur(mwst), false],
    ["Summe-Brutto:", fmtEur(brutto), true],
  ];

  sumBlock.forEach(([label, val, bold]) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(bold ? 10 : 9);
    doc.setTextColor(40);
    doc.text(label, labelX, y, { align: "right" });
    doc.text(val, valX, y, { align: "right" });
    y += bold ? 6.5 : 5.5;
  });

  // Vorherige ARs auflisten
  y += 3;
  const freigegebeneARs = (vorherigeAufmasse || []).filter(a => a.status === "freigegeben" || a.status === "abgerechnet");
  if (freigegebeneARs.length > 0) {
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(40);
    doc.text("Abzug Abschlagsrechnungen:", margin, y);
    y += 4;
    freigegebeneARs.forEach(a => {
      doc.setFont("helvetica", "normal");
      doc.text(`  ${a.bezeichnung}${a.rechnungsnummer ? " · " + a.rechnungsnummer : ""}`, margin, y);
      doc.text(`- ${fmtEur(a.betrag_netto)}`, W - margin, y, { align: "right" });
      y += 4;
    });
    y += 2;
  }

  if (schlussrechnung.datum) {
    const fällig = new Date(new Date(schlussrechnung.datum).getTime() + 30 * 24 * 60 * 60 * 1000);
    doc.setFontSize(9); doc.setFont("helvetica", "normal"); doc.setTextColor(40);
    doc.text(`Bitte überweisen Sie den Rechnungsbetrag ohne Abzug bis zum: ${fällig.toLocaleDateString("de-DE")}`, margin, y);
    y += 6;
  }

  const schlusstext = firma.rechnung_schlusstext || "Wir bedanken uns herzlich für die angenehme Zusammenarbeit und stehen Ihnen bei Fragen jederzeit gerne zur Verfügung.";
  doc.setFontSize(9); doc.setFont("helvetica", "normal"); doc.setTextColor(40);
  doc.text(doc.splitTextToSize(schlusstext, contentW), margin, y);

  addFooterAllPages(doc, firma, W, H, margin, margin);

  const filename = `SR_${schlussrechnung.rechnungsnummer || "Schlussrechnung"}_${project.project_number || ""}.pdf`.replace(/\s/g, "_");
  doc.save(filename);
}