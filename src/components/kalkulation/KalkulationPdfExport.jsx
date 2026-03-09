import jsPDF from "jspdf";

export function generateKalkulationPDF(project, kalkulation) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 10;
  const colWidth = (pageWidth - margin * 2) / 5;
  let yPosition = margin;

  // Titel
  doc.setFontSize(16);
  doc.setFont(undefined, "bold");
  doc.text("Kalkuliertes Angebot", margin, yPosition);
  yPosition += 8;

  // Projektinformationen
  doc.setFontSize(10);
  doc.setFont(undefined, "normal");
  doc.text(`Projekt: ${project.project_name}`, margin, yPosition);
  yPosition += 5;
  doc.text(`Projektnummer: ${project.project_number}`, margin, yPosition);
  yPosition += 5;
  if (project.client) {
    doc.text(`Auftraggeber: ${project.client}`, margin, yPosition);
    yPosition += 5;
  }
  yPosition += 5;

  // Tabelle Header
  doc.setFillColor(66, 133, 244);
  doc.setTextColor(255, 255, 255);
  doc.setFont(undefined, "bold");
  doc.setFontSize(9);
  
  const headers = ["Pos.", "Beschreibung", "Menge", "EP (€)", "GP (€)"];
  const colWidths = [15, 70, 30, 30, 30];
  let xPos = margin;
  
  headers.forEach((h, i) => {
    doc.rect(xPos, yPosition, colWidths[i], 7, "F");
    doc.text(h, xPos + 2, yPosition + 5, { align: "left", maxWidth: colWidths[i] - 4 });
    xPos += colWidths[i];
  });
  yPosition += 8;

  // Positionen
  const positions = kalkulation.positions || [];
  doc.setTextColor(0, 0, 0);
  doc.setFont(undefined, "normal");
  doc.setFontSize(8);
  let rowCount = 0;

  positions.forEach(p => {
    const menge = parseFloat(p.menge) || 0;
    const ep = Number(p.ep) || 0;
    const gp = Number(p.gp) || 0;
    
    // Seitenwechsel bei Bedarf
    if (yPosition > 260) {
      doc.addPage();
      yPosition = margin;
    }

    const row = [
      p.oz || "",
      p.short_text || "",
      `${menge.toLocaleString("de-DE", { minimumFractionDigits: 3 })} ${p.einheit || ""}`,
      `${ep.toLocaleString("de-DE", { minimumFractionDigits: 2 })}`,
      `${gp.toLocaleString("de-DE", { minimumFractionDigits: 2 })}`,
    ];

    // Alternating row colors
    if (rowCount % 2 === 0) {
      doc.setFillColor(245, 245, 245);
      xPos = margin;
      colWidths.forEach(w => {
        doc.rect(xPos, yPosition, w, 6, "F");
        xPos += w;
      });
    }

    // Text
    xPos = margin;
    doc.text(row[0], xPos + 1, yPosition + 4);
    xPos += colWidths[0];
    doc.text(row[1], xPos + 1, yPosition + 4, { maxWidth: colWidths[1] - 2 });
    xPos += colWidths[1];
    doc.text(row[2], xPos + 1, yPosition + 4, { align: "right" });
    xPos += colWidths[2];
    doc.text(row[3], xPos + 1, yPosition + 4, { align: "right" });
    xPos += colWidths[3];
    doc.text(row[4], xPos + 1, yPosition + 4, { align: "right" });

    yPosition += 6;
    rowCount++;
  });

  // Summen
  yPosition += 3;
  doc.setFont(undefined, "bold");
  doc.setFontSize(11);
  const totalGP = positions.reduce((sum, p) => sum + (Number(p.gp) || 0), 0);
  
  xPos = margin + colWidths[0] + colWidths[1];
  doc.text("Gesamtsumme:", xPos, yPosition);
  xPos = pageWidth - margin - colWidths[4];
  doc.text(
    totalGP.toLocaleString("de-DE", { minimumFractionDigits: 2 }),
    xPos,
    yPosition,
    { align: "right" }
  );

  // Download
  const filename = `Angebot_${project.project_number}_${new Date().toISOString().split("T")[0]}.pdf`;
  doc.save(filename);
}