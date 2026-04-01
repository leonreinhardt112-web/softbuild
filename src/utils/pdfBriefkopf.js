/**
 * Gemeinsamer Briefkopf (Header + Footer) für alle PDF-Dokumente.
 * Wird von KalkulationPdfExport und RechnungPdfExport verwendet.
 */

export function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)]
    : [70, 130, 180];
}

/**
 * Zeichnet die Absenderzeile oben links (klein, grau).
 * Gibt neue Y-Position zurück.
 */
export function drawAbsenderzeile(doc, firma, marginLeft, y) {
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(120);
  const parts = [firma.name, firma.briefkopf_strasse, `${firma.briefkopf_plz || ""} ${firma.briefkopf_stadt || ""}`.trim()].filter(Boolean);
  doc.text(parts.join(" | "), marginLeft, y);
  return y + 5;
}

/**
 * Zeichnet den Footer auf allen Seiten des Dokuments.
 * Nutzt pdf_footer_farbe, pdf_footer_links/mitte/rechts aus Stammdaten.
 * Fügt auch DIN 676 Falzmarken ein.
 */
export function addFooterAllPages(doc, firma, pageWidth, pageHeight, marginLeft, marginRight) {
  const totalPages = doc.internal.getNumberOfPages();
  const footerBgY = pageHeight - 24;
  const footerColor = firma?.pdf_footer_farbe || "#666666";
  const rgb = hexToRgb(footerColor);

  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);

    // DIN 676 Falzmarken
    doc.setDrawColor(0);
    doc.setLineWidth(0.1);
    doc.line(0, 105, 3, 105);
    doc.line(0, 210, 3, 210);

    // Footer-Hintergrund
    doc.setFillColor(...rgb);
    doc.rect(0, footerBgY, pageWidth, pageHeight - footerBgY, "F");

    // Footer-Text
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);

    const contentWidth = pageWidth - marginLeft - marginRight;
    const col1X = marginLeft;
    const col2X = marginLeft + contentWidth / 3;
    const col3X = marginLeft + (2 * contentWidth) / 3;

    const footerLeft = (firma?.pdf_footer_links || "").split("\n");
    const footerMitte = (firma?.pdf_footer_mitte || "").split("\n");
    const footerRechts = (firma?.pdf_footer_rechts || "").split("\n");

    let currentY = footerBgY + 4;
    const maxLines = Math.max(footerLeft.length, footerMitte.length, footerRechts.length);
    for (let j = 0; j < maxLines; j++) {
      if (footerLeft[j]) doc.text(footerLeft[j].trim(), col1X, currentY);
      if (footerMitte[j]) doc.text(footerMitte[j].trim(), col2X, currentY);
      if (footerRechts[j]) doc.text(footerRechts[j].trim(), col3X, currentY);
      currentY += 3;
    }

    // Seitenzahl
    doc.setTextColor(220, 220, 220);
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.text(`Seite ${i}/${totalPages}`, pageWidth - marginRight, footerBgY - 2, { align: "right" });

    doc.setTextColor(0, 0, 0);
  }
}

/**
 * Gibt den verfügbaren Inhaltsbereich (bis über Footer) zurück.
 */
export function getPageBottom(pageHeight) {
  return pageHeight - 24 - 6; // Footer-Höhe + Puffer
}