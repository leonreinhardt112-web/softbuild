import jsPDF from "jspdf";
import "jspdf-autotable";

export function generateKalkulationPDF(project, kalkulation) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 10;
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
  yPosition += 3;

  // Positionen Tabelle
  const positions = kalkulation.positions || [];
  const tableData = positions.map(p => {
    const menge = parseFloat(p.menge) || 0;
    const ep = Number(p.ep) || 0;
    const gp = Number(p.gp) || 0;
    return [
      p.oz || "",
      p.short_text || "",
      `${menge.toLocaleString("de-DE", { minimumFractionDigits: 3 })} ${p.einheit || ""}`,
      `${ep.toLocaleString("de-DE", { minimumFractionDigits: 2 })} €`,
      `${gp.toLocaleString("de-DE", { minimumFractionDigits: 2 })} €`,
    ];
  });

  doc.autoTable({
    startY: yPosition,
    head: [["Pos.", "Beschreibung", "Menge", "EP (€)", "GP (€)"]],
    body: tableData,
    margin: { left: margin, right: margin },
    headStyles: { fillColor: [66, 133, 244], textColor: 255, fontStyle: "bold" },
    bodyStyles: { textColor: 0 },
    alternateRowStyles: { fillColor: [245, 245, 245] },
    columnStyles: {
      0: { cellWidth: 15, halign: "left" },
      1: { cellWidth: 70 },
      2: { halign: "right", cellWidth: 30 },
      3: { halign: "right", cellWidth: 30 },
      4: { halign: "right", cellWidth: 30 },
    },
  });

  yPosition = doc.lastAutoTable.finalY + 8;

  // Summen
  doc.setFont(undefined, "bold");
  doc.setFontSize(11);
  const totalGP = positions.reduce((sum, p) => sum + (Number(p.gp) || 0), 0);
  doc.text(
    `Kalkulierte Angebotssumme: ${totalGP.toLocaleString("de-DE", { style: "currency", currency: "EUR" })}`,
    pageWidth - margin,
    yPosition,
    { align: "right" }
  );

  // Download
  const filename = `Angebot_${project.project_number}_${new Date().toISOString().split("T")[0]}.pdf`;
  doc.save(filename);
}