import jsPDF from "jspdf";

export function generateKalkulationPDF(project, kalkulation) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  const colWidths = [15, 70, 30, 30, 30];
  let yPosition = margin;

  // Titel
  doc.setFontSize(16);
  doc.setFont(undefined, "bold");
  doc.text("Kalkuliertes Angebot", margin, yPosition);
  yPosition += 10;

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

  // Tabellenkopf
  const headers = ["Pos.", "Beschreibung", "Menge", "EP (€)", "GP (€)"];
  doc.setFont(undefined, "bold");
  doc.setFontSize(9);
  doc.setFillColor(66, 133, 244);
  doc.setTextColor(255, 255, 255);
  
  let xPos = margin;
  headers.forEach((h, i) => {
    doc.text(h, xPos + (i >= 2 ? colWidths[i] - 2 : 2), yPosition + 4, { align: i >= 2 ? "right" : "left" });
    xPos += colWidths[i];
  });
  doc.rect(margin, yPosition, pageWidth - 2 * margin, 6, "F");
  yPosition += 8;

  // Positionen
  doc.setFont(undefined, "normal");
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(8);

  const positions = kalkulation.positions || [];
  positions.forEach((p, idx) => {
    const menge = parseFloat(p.menge) || 0;
    const ep = Number(p.ep) || 0;
    const gp = Number(p.gp) || 0;

    // Wechselnde Zeilenhintergründe
    if (idx % 2 === 1) {
      doc.setFillColor(245, 245, 245);
      doc.rect(margin, yPosition - 3, pageWidth - 2 * margin, 5, "F");
    }

    xPos = margin;
    const rowData = [
      p.oz || "",
      p.short_text || "",
      `${menge.toLocaleString("de-DE", { minimumFractionDigits: 3 })} ${p.einheit || ""}`,
      `${ep.toLocaleString("de-DE", { minimumFractionDigits: 2 })}`,
      `${gp.toLocaleString("de-DE", { minimumFractionDigits: 2 })}`,
    ];

    rowData.forEach((val, i) => {
      doc.text(val, xPos + (i >= 2 ? colWidths[i] - 2 : 2), yPosition, { align: i >= 2 ? "right" : "left" });
      xPos += colWidths[i];
    });
    yPosition += 5;
  });

  yPosition += 5;

  // Summen
  doc.setFont(undefined, "bold");
  doc.setFontSize(11);
  const totalGP = positions.reduce((sum, p) => sum + (Number(p.gp) || 0), 0);
  const sumText = `Kalkulierte Angebotssumme: ${totalGP.toLocaleString("de-DE", { style: "currency", currency: "EUR" })}`;
  doc.text(sumText, pageWidth - margin, yPosition, { align: "right" });

  // Download
  const filename = `Angebot_${project.project_number}_${new Date().toISOString().split("T")[0]}.pdf`;
  doc.save(filename);
}