import jsPDF from "jspdf";
import { base44 } from "@/api/base44Client";

const MARGIN_TOP = 20;
const MARGIN_LEFT = 20;
const MARGIN_RIGHT = 20;
const MARGIN_BOTTOM = 20;

export async function generateKalkulationPDF(project, kalkulation) {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentWidth = pageWidth - MARGIN_LEFT - MARGIN_RIGHT;

  let company = null;
  try {
    const companies = await base44.entities.Stammdatum.filter({ typ: "unternehmen", aktiv: true }, undefined, 1);
    if (companies?.length > 0) company = companies[0];
  } catch (e) {
    console.error("Fehler beim Laden der Unternehmens-Stammdaten:", e);
  }

  // Erste Seite
  addHeaderSection(doc, company, project, MARGIN_TOP, MARGIN_LEFT, pageWidth);
  
  let yPos = MARGIN_TOP + 60;
  const pageBottom = pageHeight - MARGIN_BOTTOM;

  // Positionen mit Titel-Struktur
  const positionsByTitle = groupPositionsByTitle(project.lv_positions || [], kalkulation.positions || []);
  
  let pageNum = 1;
  let firstPageDone = false;

  for (const titleGroup of positionsByTitle) {
    // Prüfe, ob Titel auf aktuelle Seite passt
    if (firstPageDone && yPos + 8 > pageBottom) {
      doc.addPage();
      yPos = MARGIN_TOP + 10;
      firstPageDone = false;
    }

    // Haupttitel
    if (titleGroup.title) {
      doc.setFont(undefined, "bold");
      doc.setFontSize(10);
      doc.setFillColor(230, 240, 250);
      doc.rect(MARGIN_LEFT, yPos - 2, contentWidth, 6, "F");
      doc.text(titleGroup.title, MARGIN_LEFT + 2, yPos + 2);
      yPos += 8;
      firstPageDone = true;
    }

    // Positionen dieser Gruppe
    for (const pos of titleGroup.positions) {
      // Tabellenkopf bei neuer Seite oder Titel
      if (!firstPageDone || (yPos < MARGIN_TOP + 15)) {
        addTableHeader(doc, MARGIN_LEFT, yPos, contentWidth);
        yPos += 6;
        firstPageDone = true;
      }

      // Kurze Zeile (Pos + Kurztext + Menge + EP + GP)
      doc.setFont(undefined, "normal");
      doc.setFontSize(9);
      
      if (pos.posIndex % 2 === 1) {
        doc.setFillColor(248, 248, 248);
        doc.rect(MARGIN_LEFT, yPos - 2, contentWidth, 5, "F");
      }

      const menge = parseFloat(pos.menge) || 0;
      const ep = Number(pos.ep) || 0;
      const gp = Number(pos.gp) || 0;

      // Pos-Nummer | Kurztext | Menge ME | EP | GP
      let xPos = MARGIN_LEFT;
      doc.text((pos.oz || "").toString(), xPos + 1, yPos + 1);
      xPos += 15;

      // Kurztext mit Zeilenumbruch
      const shortLines = doc.splitTextToSize(pos.short_text || "", 70);
      doc.text(shortLines[0] || "", xPos + 1, yPos + 1);
      if (shortLines.length > 1) {
        doc.setFontSize(8);
        doc.text(shortLines[1], xPos + 1, yPos + 4);
        doc.setFontSize(9);
        yPos += 2;
      }
      
      xPos += 70;
      doc.text(`${menge.toLocaleString("de-DE", { minimumFractionDigits: 2 })} ${pos.einheit || ""}`, xPos, yPos + 1, { align: "center" });
      xPos += 22;
      doc.text(`${ep.toLocaleString("de-DE", { minimumFractionDigits: 2 })} €`, xPos, yPos + 1, { align: "right" });
      xPos += 18;
      doc.setFont(undefined, "bold");
      doc.text(`${gp.toLocaleString("de-DE", { minimumFractionDigits: 2 })} €`, xPos, yPos + 1, { align: "right" });
      doc.setFont(undefined, "normal");

      yPos += 5;

      // Langtext (falls vorhanden) – ausgeglichen unter Beschreibung
      if (pos.long_text) {
        doc.setFontSize(8);
        doc.setTextColor(100, 100, 100);
        const longLines = doc.splitTextToSize(pos.long_text, 70);
        let langY = yPos;
        longLines.forEach((line, idx) => {
          if (idx < 3) { // Max 3 Zeilen Langtext
            doc.text(line, MARGIN_LEFT + 71, langY);
            langY += 3;
          }
        });
        yPos = Math.max(yPos, langY + 1);
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(9);
      }

      // Pagebreak-Check
      if (yPos > pageBottom - 10) {
        doc.addPage();
        yPos = MARGIN_TOP;
        firstPageDone = false;
      }
    }

    // Summe pro Titel
    if (titleGroup.positions.length > 0) {
      doc.setFont(undefined, "bold");
      doc.setFontSize(9);
      const titleSum = titleGroup.positions.reduce((s, p) => s + (Number(p.gp) || 0), 0);
      doc.text("Summe Titel", MARGIN_LEFT + 86, yPos + 2);
      doc.text(`${titleSum.toLocaleString("de-DE", { minimumFractionDigits: 2 })} €`, pageWidth - MARGIN_RIGHT - 2, yPos + 2, { align: "right" });
      yPos += 6;
      
      if (yPos > pageBottom - 15) {
        doc.addPage();
        yPos = MARGIN_TOP;
        firstPageDone = false;
      }
    }
  }

  // Abschlusseite mit Summen
  if (yPos > pageBottom - 20) {
    doc.addPage();
    yPos = MARGIN_TOP;
  }

  yPos += 5;
  doc.setFont(undefined, "bold");
  doc.setFontSize(11);
  doc.text("Zusammenfassung", MARGIN_LEFT, yPos);
  yPos += 8;

  const totalNetto = (kalkulation.positions || []).reduce((sum, p) => sum + (Number(p.gp) || 0), 0);
  const mwst = totalNetto * 0.19;
  const totalBrutto = totalNetto + mwst;

  doc.setFont(undefined, "normal");
  doc.setFontSize(10);
  const summaryX = pageWidth - MARGIN_RIGHT - 40;
  doc.text("Summe-Netto:", summaryX, yPos);
  doc.text(`${totalNetto.toLocaleString("de-DE", { minimumFractionDigits: 2 })} €`, pageWidth - MARGIN_RIGHT - 2, yPos, { align: "right" });
  yPos += 6;
  
  doc.text("19,00 % MwSt.:", summaryX, yPos);
  doc.text(`${mwst.toLocaleString("de-DE", { minimumFractionDigits: 2 })} €`, pageWidth - MARGIN_RIGHT - 2, yPos, { align: "right" });
  yPos += 6;
  
  doc.setFont(undefined, "bold");
  doc.text("Summe-Brutto:", summaryX, yPos);
  doc.text(`${totalBrutto.toLocaleString("de-DE", { minimumFractionDigits: 2 })} €`, pageWidth - MARGIN_RIGHT - 2, yPos, { align: "right" });

  const filename = `Angebot_${project.project_number}_${new Date().toISOString().split("T")[0]}.pdf`;
  doc.save(filename);
}

function addHeaderSection(doc, company, project, topMargin, leftMargin, pageWidth) {
  // Briefkopf links
  if (company) {
    doc.setFontSize(11);
    doc.setFont(undefined, "bold");
    doc.text(company.name || "", leftMargin, topMargin + 5);
    
    doc.setFontSize(8);
    doc.setFont(undefined, "normal");
    let addrY = topMargin + 12;
    if (company.briefkopf_strasse) {
      doc.text(company.briefkopf_strasse, leftMargin, addrY);
      addrY += 4;
    }
    if (company.briefkopf_plz || company.briefkopf_stadt) {
      doc.text(`${company.briefkopf_plz || ""} ${company.briefkopf_stadt || ""}`, leftMargin, addrY);
      addrY += 4;
    }
    if (company.briefkopf_email) {
      doc.text(`E-Mail: ${company.briefkopf_email}`, leftMargin, addrY);
    }
  }

  // Projektdaten rechts
  const rightX = pageWidth - MARGIN_RIGHT - 50;
  doc.setFontSize(10);
  doc.setFont(undefined, "bold");
  doc.text("Kalkuliertes Angebot", rightX, topMargin + 5);
  
  doc.setFontSize(9);
  doc.setFont(undefined, "normal");
  let infoY = topMargin + 13;
  doc.text(`Projekt-Nr.: ${project.project_number || ""}`, rightX, infoY);
  infoY += 4;
  doc.text(`Auftraggeber: ${project.client || ""}`, rightX, infoY);
  infoY += 4;
  doc.text(`Datum: ${new Date().toLocaleDateString("de-DE")}`, rightX, infoY);

  // Trennlinie
  doc.setDrawColor(150, 150, 150);
  doc.line(leftMargin, topMargin + 30, pageWidth - MARGIN_RIGHT, topMargin + 30);
}

function addTableHeader(doc, x, y, width) {
  doc.setFont(undefined, "bold");
  doc.setFontSize(8);
  doc.setFillColor(70, 130, 180);
  doc.setTextColor(255, 255, 255);
  
  const headers = ["Pos.", "Bezeichnung", "Menge", "EP", "GP"];
  const colWidths = [15, 70, 22, 18, 20];
  
  let xPos = x;
  headers.forEach((h, i) => {
    const align = i >= 2 ? "right" : "left";
    const textX = align === "right" ? xPos + colWidths[i] - 2 : xPos + 2;
    doc.text(h, textX, y + 2, { align });
    xPos += colWidths[i];
  });
  
  doc.setTextColor(0, 0, 0);
}

function groupPositionsByTitle(lvPositions, kalkulationen) {
  const isTitle = (pos) => {
    if (pos.type === "title") return true;
    const hasNoQty = !pos.quantity || pos.quantity === "0" || pos.quantity === "";
    return hasNoQty;
  };

  const result = [];
  let currentTitle = null;

  lvPositions.forEach((lvPos) => {
    if (isTitle(lvPos)) {
      if (currentTitle?.positions.length > 0) {
        result.push(currentTitle);
      }
      currentTitle = {
        title: lvPos.short_text,
        positions: []
      };
    } else {
      const kalkPos = kalkulationen.find((p) => p.oz === lvPos.oz && p.short_text === lvPos.short_text);
      if (currentTitle) {
        currentTitle.positions.push({
          oz: lvPos.oz,
          short_text: lvPos.short_text,
          long_text: lvPos.long_text || "",
          menge: lvPos.quantity || 0,
          einheit: lvPos.unit || "",
          ep: kalkPos?.ep || 0,
          gp: kalkPos?.gp || 0,
          posIndex: currentTitle.positions.length
        });
      }
    }
  });

  if (currentTitle?.positions.length > 0) {
    result.push(currentTitle);
  }

  return result;
}