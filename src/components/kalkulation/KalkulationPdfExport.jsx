import jsPDF from "jspdf";
import { base44 } from "@/api/base44Client";

// DIN 5008 Margins (in mm)
const DIN_MARGIN_TOP = 20;
const DIN_MARGIN_LEFT = 20;
const DIN_MARGIN_RIGHT = 20;
const DIN_MARGIN_BOTTOM = 20;
const DIN_FOLD_MARK = 105; // Faltmarke bei ca. 105mm

export async function generateKalkulationPDF(project, kalkulation) {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentWidth = pageWidth - DIN_MARGIN_LEFT - DIN_MARGIN_RIGHT;

  // Hole Unternehmens-Briefkopfdaten
  let company = null;
  try {
    const companies = await base44.entities.Stammdatum.filter({ typ: "unternehmen", aktiv: true }, undefined, 1);
    if (companies && companies.length > 0) {
      company = companies[0];
    }
  } catch (e) {
    console.error("Fehler beim Laden der Unternehmens-Stammdaten:", e);
  }

  // Erste Seite mit Briefkopf
  addBriefkopf(doc, company, DIN_MARGIN_TOP, DIN_MARGIN_LEFT);
  
  let yPosition = DIN_MARGIN_TOP + 50; // Nach Briefkopf
  
  // Betreffzeile
  doc.setFont(undefined, "bold");
  doc.setFontSize(11);
  doc.text("Kalkuliertes Angebot", DIN_MARGIN_LEFT, yPosition);
  yPosition += 8;

  // Projektinformationen
  doc.setFont(undefined, "normal");
  doc.setFontSize(10);
  doc.text(`Projekt: ${project.project_name || ""}`, DIN_MARGIN_LEFT, yPosition);
  yPosition += 5;
  doc.text(`Projektnummer: ${project.project_number || ""}`, DIN_MARGIN_LEFT, yPosition);
  yPosition += 5;
  if (project.client) {
    doc.text(`Auftraggeber: ${project.client}`, DIN_MARGIN_LEFT, yPosition);
    yPosition += 5;
  }
  yPosition += 5;

  // Tabelle
  const colWidths = [15, 80, 25, 25, 25];
  const headers = ["Pos.", "Beschreibung", "Menge", "EP (€)", "GP (€)"];
  const allPositions = kalkulation.positions || [];
  
  // Rendering-Strategie: Alle Positionen auf erste Seite bis zur Seitengröße, dann neue Seiten
  let posIndex = 0;
  let isFirstPage = true;
  const pageBottom = pageHeight - DIN_MARGIN_BOTTOM;
  const rowHeight = 5;

  while (posIndex < allPositions.length) {
    if (!isFirstPage) {
      doc.addPage();
      yPosition = DIN_MARGIN_TOP;
      
      // Seitenkopf
      doc.setFontSize(9);
      doc.setFont(undefined, "normal");
      doc.text(`Projekt: ${project.project_number}`, DIN_MARGIN_LEFT, yPosition);
      yPosition += 8;
    }

    // Render table header
    doc.setFont(undefined, "bold");
    doc.setFontSize(9);
    doc.setFillColor(66, 133, 244);
    doc.setTextColor(255, 255, 255);

    let xPos = DIN_MARGIN_LEFT;
    const headerYPos = yPosition;
    headers.forEach((h, i) => {
      const cellHeight = 6;
      doc.rect(xPos, headerYPos, colWidths[i], cellHeight, "F");
      const align = i >= 2 ? "right" : "left";
      const textX = align === "right" ? xPos + colWidths[i] - 2 : xPos + 2;
      doc.text(h, textX, headerYPos + 4, { align });
      xPos += colWidths[i];
    });
    yPosition += 7;

    // Render positions for this page
    doc.setFont(undefined, "normal");
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(8);

    while (posIndex < allPositions.length && yPosition + rowHeight < pageBottom) {
      const p = allPositions[posIndex];
      const menge = parseFloat(p.menge) || 0;
      const ep = Number(p.ep) || 0;
      const gp = Number(p.gp) || 0;

      // Alternating row colors
      if (posIndex % 2 === 1) {
        doc.setFillColor(245, 245, 245);
        doc.rect(DIN_MARGIN_LEFT, yPosition - 2, contentWidth, rowHeight, "F");
      }

      xPos = DIN_MARGIN_LEFT;
      const rowData = [
        p.oz || "",
        p.short_text || "",
        `${menge.toLocaleString("de-DE", { minimumFractionDigits: 2 })} ${p.einheit || ""}`,
        `${ep.toLocaleString("de-DE", { minimumFractionDigits: 2 })}`,
        `${gp.toLocaleString("de-DE", { minimumFractionDigits: 2 })}`,
      ];

      rowData.forEach((val, i) => {
        const align = i >= 2 ? "right" : "left";
        const textX = align === "right" ? xPos + colWidths[i] - 2 : xPos + 2;
        doc.text(val, textX, yPosition, { align, maxWidth: colWidths[i] - 4 });
        xPos += colWidths[i];
      });
      yPosition += rowHeight;
      posIndex++;
    }

    isFirstPage = false;
  }

  // Letzte Seite mit Summen
  doc.addPage();
  let finalYPos = DIN_MARGIN_TOP;
  doc.setFontSize(9);
  doc.setFont(undefined, "normal");
  doc.text(`Projekt: ${project.project_number}`, DIN_MARGIN_LEFT, finalYPos);
  finalYPos += 8;

  // Zusammenfassung
  doc.setFont(undefined, "bold");
  doc.setFontSize(11);
  const totalGP = (kalkulation.positions || []).reduce((sum, p) => sum + (Number(p.gp) || 0), 0);
  
  doc.text("Kalkuliertes Angebot – Zusammenfassung", DIN_MARGIN_LEFT, finalYPos);
  finalYPos += 8;
  
  doc.setFont(undefined, "normal");
  doc.setFontSize(10);
  doc.text(`Gesamtsumme Angebotspositionen: ${totalGP.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`, DIN_MARGIN_LEFT, finalYPos);

  // Download
  const filename = `Angebot_${project.project_number}_${new Date().toISOString().split("T")[0]}.pdf`;
  doc.save(filename);
}

function addBriefkopf(doc, company, topMargin, leftMargin) {
  if (!company) {
    // Fallback ohne Daten
    doc.setFontSize(14);
    doc.setFont(undefined, "bold");
    doc.text("Ihr Unternehmen", leftMargin, topMargin + 5);
    return;
  }

  // Logo (falls vorhanden)
  if (company.briefkopf_logo_url) {
    try {
      doc.addImage(company.briefkopf_logo_url, "PNG", leftMargin, topMargin, 30, 15);
    } catch (e) {
      console.error("Logo konnte nicht geladen werden", e);
    }
  }

  // Unternehmen Header
  doc.setFontSize(14);
  doc.setFont(undefined, "bold");
  doc.text(company.name || "", leftMargin, topMargin + 18);

  // Adressblock
  doc.setFontSize(9);
  doc.setFont(undefined, "normal");
  let addrY = topMargin + 25;
  if (company.briefkopf_strasse) {
    doc.text(company.briefkopf_strasse, leftMargin, addrY);
    addrY += 4;
  }
  if (company.briefkopf_plz || company.briefkopf_stadt) {
    doc.text(`${company.briefkopf_plz || ""} ${company.briefkopf_stadt || ""}`, leftMargin, addrY);
    addrY += 4;
  }

  // Kontaktzeile
  addrY += 2;
  if (company.briefkopf_telefon) {
    doc.text(`Tel: ${company.briefkopf_telefon}`, leftMargin, addrY);
    addrY += 3;
  }
  if (company.briefkopf_email) {
    doc.text(`E-Mail: ${company.briefkopf_email}`, leftMargin, addrY);
    addrY += 3;
  }
  if (company.briefkopf_website) {
    doc.text(`Web: ${company.briefkopf_website}`, leftMargin, addrY);
  }

  // Trennlinie
  doc.setDrawColor(200, 200, 200);
  doc.line(leftMargin, topMargin + 42, 210 - 20, topMargin + 42);
}

function addTablePage(doc, headers, positions, startY, leftMargin, pageWidth, pageHeight, contentWidth, colWidths, isFollowupPage) {
  const pageBottom = pageHeight - 20; // Abstand zum unteren Rand
  let yPosition = startY;

  // Tabellenkopf
  doc.setFont(undefined, "bold");
  doc.setFontSize(9);
  doc.setFillColor(66, 133, 244);
  doc.setTextColor(255, 255, 255);

  let xPos = leftMargin;
  const headerYPos = yPosition;
  headers.forEach((h, i) => {
    const cellHeight = 6;
    doc.rect(xPos, headerYPos, colWidths[i], cellHeight, "F");
    const align = i >= 2 ? "right" : "left";
    const textX = align === "right" ? xPos + colWidths[i] - 2 : xPos + 2;
    doc.text(h, textX, headerYPos + 4, { align });
    xPos += colWidths[i];
  });
  yPosition += 7;

  // Positionen
  doc.setFont(undefined, "normal");
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(8);

  positions.forEach((p, idx) => {
    // Seitenwechsel prüfen
    if (yPosition + 5 > pageBottom) {
      return; // Wird auf nächste Seite verschoben
    }

    const menge = parseFloat(p.menge) || 0;
    const ep = Number(p.ep) || 0;
    const gp = Number(p.gp) || 0;

    // Zeilenhintergrund
    if (idx % 2 === 1) {
      doc.setFillColor(245, 245, 245);
      doc.rect(leftMargin, yPosition - 2, contentWidth, 5, "F");
    }

    xPos = leftMargin;
    const rowData = [
      p.oz || "",
      p.short_text || "",
      `${menge.toLocaleString("de-DE", { minimumFractionDigits: 2 })} ${p.einheit || ""}`,
      `${ep.toLocaleString("de-DE", { minimumFractionDigits: 2 })}`,
      `${gp.toLocaleString("de-DE", { minimumFractionDigits: 2 })}`,
    ];

    rowData.forEach((val, i) => {
      const align = i >= 2 ? "right" : "left";
      const textX = align === "right" ? xPos + colWidths[i] - 2 : xPos + 2;
      doc.text(val, textX, yPosition, { align, maxWidth: colWidths[i] - 4 });
      xPos += colWidths[i];
    });
    yPosition += 5;
  });

  return yPosition;
}