import { jsPDF } from "jspdf";

/**
 * Erstellt ein professionelles PDF einer Abschlagsrechnung
 */
export function exportRechnungPDF({ aufmass, project, stammdaten }) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210;
  const margin = 20;
  const contentW = W - 2 * margin;
  const isStorno = aufmass.rechnungsnummer?.startsWith("STORNO-");

  const fmt = (n) => (n || 0).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtEur = (n) => fmt(n) + " €";

  // Unternehmensdaten aus Stammdaten
  const firma = stammdaten?.find(s => s.typ === "unternehmen" && s.aktiv) || {};

  let y = margin;

  // --- HEADER ---
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(isStorno ? 200 : 30, isStorno ? 50 : 100, isStorno ? 50 : 180);
  doc.text(isStorno ? "STORNORECHNUNG" : "ABSCHLAGSRECHNUNG", margin, y);
  y += 8;

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100);
  doc.text(aufmass.bezeichnung || "", margin, y);
  y += 12;

  // --- ABSENDER | EMPFÄNGER Spalten ---
  doc.setTextColor(0);
  doc.setFontSize(9);

  const absender = [
    firma.name || "Unser Unternehmen",
    firma.briefkopf_strasse || "",
    `${firma.briefkopf_plz || ""} ${firma.briefkopf_stadt || ""}`.trim(),
    firma.briefkopf_telefon ? `Tel: ${firma.briefkopf_telefon}` : "",
    firma.briefkopf_email || "",
  ].filter(Boolean);

  const empfaenger = [
    project.client || "–",
  ].filter(Boolean);

  doc.setFont("helvetica", "bold");
  doc.text("Absender:", margin, y);
  doc.text("Empfänger:", margin + contentW / 2, y);
  y += 5;
  doc.setFont("helvetica", "normal");

  const maxRows = Math.max(absender.length, empfaenger.length);
  for (let i = 0; i < maxRows; i++) {
    if (absender[i]) doc.text(absender[i], margin, y);
    if (empfaenger[i]) doc.text(empfaenger[i], margin + contentW / 2, y);
    y += 5;
  }
  y += 4;

  // --- RECHNUNGSDETAILS ---
  doc.setDrawColor(220);
  doc.line(margin, y, W - margin, y);
  y += 5;

  const details = [
    ["Rechnungsnummer:", aufmass.rechnungsnummer || "–"],
    ["Projekt:", `${project.project_name} (${project.project_number})`],
    ["Datum:", aufmass.datum ? new Date(aufmass.datum).toLocaleDateString("de-DE") : "–"],
    ["Abrechner:", aufmass.abrechner || "–"],
  ];

  doc.setFontSize(9);
  details.forEach(([label, val]) => {
    doc.setFont("helvetica", "bold");
    doc.text(label, margin, y);
    doc.setFont("helvetica", "normal");
    doc.text(val, margin + 55, y);
    y += 5;
  });
  y += 4;

  doc.line(margin, y, W - margin, y);
  y += 6;

  // --- POSITIONSTABELLE ---
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setFillColor(240, 245, 255);
  doc.rect(margin, y - 3, contentW, 7, "F");
  doc.text("Pos.", margin, y + 1);
  doc.text("Bezeichnung", margin + 12, y + 1);
  doc.text("Vorper.", margin + 95, y + 1, { align: "right" });
  doc.text("Zuwachs", margin + 120, y + 1, { align: "right" });
  doc.text("Kumuliert", margin + 145, y + 1, { align: "right" });
  doc.text("EP (€)", margin + 165, y + 1, { align: "right" });
  doc.text("Betrag (€)", W - margin, y + 1, { align: "right" });
  y += 8;

  doc.setFont("helvetica", "normal");
  const positionen = aufmass.positionen || [];

  for (const pos of positionen) {
    if (y > 260) {
      doc.addPage();
      y = margin;
    }
    const zeile = `${pos.oz || ""}`;
    const textLines = doc.splitTextToSize(pos.short_text || "", 80);
    const rowH = Math.max(5, textLines.length * 4.5);

    doc.text(zeile, margin, y);
    doc.text(textLines, margin + 12, y);
    doc.text(fmt(pos.menge_vorperioden), margin + 95, y, { align: "right" });
    doc.text(fmt(pos.menge_aktuell), margin + 120, y, { align: "right" });
    doc.text(fmt(pos.menge_kumuliert), margin + 145, y, { align: "right" });
    doc.text(fmt(pos.ep), margin + 165, y, { align: "right" });
    doc.text(fmt(pos.gp_kumuliert), W - margin, y, { align: "right" });
    y += rowH + 1;

    doc.setDrawColor(230);
    doc.line(margin, y, W - margin, y);
    y += 1;
  }

  y += 4;

  // --- SUMMENBLOCK ---
  doc.setDrawColor(200);
  doc.line(margin, y, W - margin, y);
  y += 5;

  const betragNetto = aufmass.betrag_netto || 0;
  const betragVorper = aufmass.betrag_vorperioden || 0;
  const betragAktuell = aufmass.betrag_aktuell || 0;
  const mwstSatz = 19;
  const mwstBetrag = betragNetto * (mwstSatz / 100);
  const betragBrutto = betragNetto + mwstBetrag;

  const sumRows = [
    ["Vorperioden gesamt (netto):", fmtEur(betragVorper)],
    ["Zuwachs diese Periode (netto):", fmtEur(betragAktuell)],
    ["Rechnungsbetrag netto:", fmtEur(betragNetto)],
    [`zzgl. MwSt. ${mwstSatz}%:`, fmtEur(mwstBetrag)],
  ];

  doc.setFontSize(9);
  sumRows.forEach(([label, val]) => {
    doc.setFont("helvetica", "normal");
    doc.text(label, margin + 80, y, { align: "right" });
    doc.text(val, W - margin, y, { align: "right" });
    y += 5.5;
  });

  // Gesamtsumme
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setDrawColor(30, 100, 180);
  doc.line(margin + 80, y, W - margin, y);
  y += 5;
  doc.text("Rechnungsbetrag brutto:", margin + 80, y, { align: "right" });
  doc.setTextColor(isStorno ? 180 : 30, isStorno ? 30 : 100, isStorno ? 30 : 180);
  doc.text(fmtEur(isStorno ? -betragBrutto : betragBrutto), W - margin, y, { align: "right" });
  y += 10;

  // --- STORNO-HINWEIS ---
  if (isStorno) {
    doc.setTextColor(180, 30, 30);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text(aufmass.notes || "", margin, y);
    y += 6;
  }

  // --- FOOTER ---
  doc.setTextColor(150);
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  const footer = [
    firma.pdf_footer_links || "",
    firma.pdf_footer_mitte || "",
    firma.pdf_footer_rechts || "",
  ].filter(Boolean).join("   |   ");
  if (footer) {
    doc.text(footer, W / 2, 285, { align: "center" });
  }
  doc.text(`Seite 1 von ${doc.internal.getNumberOfPages()}`, W - margin, 285, { align: "right" });

  // --- SPEICHERN ---
  const filename = `${aufmass.rechnungsnummer || "Rechnung"}_${project.project_number || ""}.pdf`.replace(/\s/g, "_");
  doc.save(filename);
}