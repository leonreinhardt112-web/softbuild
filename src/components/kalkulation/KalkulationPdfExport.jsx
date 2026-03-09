import jsPDF from "jspdf";
import { base44 } from "@/api/base44Client";

const MARGIN_TOP = 20;
const MARGIN_LEFT = 20;
const MARGIN_RIGHT = 20;
const MARGIN_BOTTOM = 20;

export async function generateKalkulationPDF(project, kalkulation, options = {}) {
  const { textMode = "short", vortext = "", schlusstext = "" } = options;
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentWidth = pageWidth - MARGIN_LEFT - MARGIN_RIGHT;

  let company = null;
  let headerColor = [70, 130, 180]; // Default: Steel Blue
  
  try {
    const companies = await base44.entities.Stammdatum.filter({ typ: "unternehmen", aktiv: true }, undefined, 1);
    if (companies?.length > 0) {
      company = companies[0];
      // Parse Hex-Farbe zu RGB
      if (company.angebot_header_farbe) {
        headerColor = hexToRgb(company.angebot_header_farbe);
      }
    }
  } catch (e) {
    console.error("Fehler beim Laden der Unternehmens-Stammdaten:", e);
  }

  // Erste Seite
  addHeaderSection(doc, company, project, MARGIN_TOP, MARGIN_LEFT, pageWidth);
  
  let yPos = MARGIN_TOP + 60;
  const pageBottom = pageHeight - MARGIN_BOTTOM;

  // Vortext hinzufügen
  if (vortext.trim()) {
    doc.setFont(undefined, "normal");
    doc.setFontSize(9);
    const vortextLines = doc.splitTextToSize(vortext, contentWidth);
    vortextLines.forEach((line) => {
      if (yPos > pageBottom - 15) {
        doc.addPage();
        yPos = MARGIN_TOP;
      }
      doc.text(line, MARGIN_LEFT, yPos);
      yPos += 4;
    });
    yPos += 2;
  }

  // Positionen mit Titel-Struktur
  const positionsByTitle = groupPositionsByTitle(project.lv_positions || [], kalkulation.positions || []);
  
  // Tabellenkopf auf der ersten Seite
  addTableHeader(doc, MARGIN_LEFT, yPos, contentWidth, headerColor);
  yPos += 10;
  let firstPageDone = true;

  for (const titleGroup of positionsByTitle) {
    // Prüfe, ob Titel auf aktuelle Seite passt
    if (yPos + 8 > pageBottom) {
      doc.addPage();
      yPos = MARGIN_TOP + 10;
      addTableHeader(doc, MARGIN_LEFT, yPos, contentWidth, headerColor);
      yPos += 10;
    }

    // Haupttitel
    if (titleGroup.title) {
      doc.setFont(undefined, "bold");
      doc.setFontSize(10);
      doc.setFillColor(230, 240, 250);
      doc.rect(MARGIN_LEFT, yPos - 2, contentWidth, 6, "F");
      doc.text((titleGroup.oz || "").toString(), MARGIN_LEFT + 1, yPos + 2);
      doc.text(titleGroup.title, MARGIN_LEFT + 27, yPos + 2);
      yPos += 8;
    }

    // Positionen dieser Gruppe
    for (const pos of titleGroup.positions) {
      // Tabellenkopf bei neuer Seite
      if (yPos < MARGIN_TOP + 15) {
        addTableHeader(doc, MARGIN_LEFT, yPos, contentWidth, headerColor);
        yPos += 6;
      }

      // Kurze Zeile (Pos + Kurztext + Menge + EP + GP)
      doc.setFont(undefined, "normal");
      doc.setFontSize(9);
      
      if (pos.posIndex % 2 === 1) {
        doc.setFillColor(248, 248, 248);
        doc.rect(MARGIN_LEFT, yPos - 2.5, contentWidth, 7, "F");
      }

      const menge = parseFloat(pos.menge) || 0;
      const ep = Number(pos.ep) || 0;
      const gp = Number(pos.gp) || 0;

      // Pos-Nummer (links)
      doc.text((pos.oz || "").toString(), MARGIN_LEFT + 1, yPos + 1);

      // Kurztext (Spalte 2) – begrenzt auf erste Zeile
      const shortText = (pos.short_text || "").split("\n")[0];
      doc.text(shortText, MARGIN_LEFT + 27, yPos + 1);
      
      // Menge/Einheit (Spalte 3, rechtsausgerichtet)
      const mengeText = `${menge.toLocaleString("de-DE", { minimumFractionDigits: 2 })} ${pos.einheit || ""}`;
      doc.text(mengeText, MARGIN_LEFT + 105, yPos + 1, { align: "right" });
      
      // EP (Spalte 4, rechtsausgerichtet)
      const epText = `${ep.toLocaleString("de-DE", { minimumFractionDigits: 2 })} €`;
      doc.text(epText, MARGIN_LEFT + 123, yPos + 1, { align: "right" });
      
      // GP (Spalte 5, rechtsausgerichtet, bold)
      doc.setFont(undefined, "bold");
      const gpText = `${gp.toLocaleString("de-DE", { minimumFractionDigits: 2 })} €`;
      doc.text(gpText, MARGIN_LEFT + 143, yPos + 1, { align: "right" });
      doc.setFont(undefined, "normal");

      yPos += 7;

      // Langtext (falls vorhanden und im textMode "both") – unter Position
      if (pos.long_text && textMode === "both") {
        doc.setFontSize(8);
        doc.setTextColor(80, 80, 80);
        
        // Bereinige Langtext: Kurztext entfernen + Whitespace normalisieren
        let cleanedLongText = pos.long_text.trim();
        if (shortText && cleanedLongText.startsWith(shortText)) {
          cleanedLongText = cleanedLongText.substring(shortText.length).trim();
        }
        if (shortText && cleanedLongText.endsWith(shortText)) {
          cleanedLongText = cleanedLongText.substring(0, cleanedLongText.length - shortText.length).trim();
        }
        
        // Zeilen bereinigen: Leerzeilen entfernen, Einrückungen normalisieren
        const cleanedLines = cleanedLongText
          .split("\n")
          .map(l => l.trim())
          .filter(l => l.length > 0);
        
        // Absätze zusammenführen (Zeilen die nicht mit Satzzeichen enden, gehören zum nächsten Satz)
        const paragraphs = [];
        let current = "";
        cleanedLines.forEach(line => {
          if (current) {
            current += " " + line;
          } else {
            current = line;
          }
          // Absatz-Ende: Zeile endet mit Punkt, Ausrufezeichen, Fragezeichen oder ist kurz
          if (/[.!?]$/.test(line) || line.length < 30) {
            paragraphs.push(current);
            current = "";
          }
        });
        if (current) paragraphs.push(current);
        
        paragraphs.forEach(para => {
          const wrappedLines = doc.splitTextToSize(para, contentWidth - 4);
          wrappedLines.forEach(line => {
            if (yPos > pageBottom - 10) {
              doc.addPage();
              yPos = MARGIN_TOP;
              addTableHeader(doc, MARGIN_LEFT, yPos, contentWidth, headerColor);
              yPos += 10;
              }
                    doc.text(line, MARGIN_LEFT + 2, yPos);
            yPos += 3.5;
          });
          yPos += 1; // kleiner Abstand zwischen Absätzen
        });
        
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(9);
        yPos += 2;
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
  const labelX = MARGIN_LEFT + 80;
  const valueX = labelX + 80;
  
  doc.text("Summe-Netto:", labelX, yPos);
  doc.text(`${totalNetto.toLocaleString("de-DE", { minimumFractionDigits: 2 })} €`, valueX, yPos);
  yPos += 8;
  
  doc.text("19,00 % MwSt.:", labelX, yPos);
  doc.text(`${mwst.toLocaleString("de-DE", { minimumFractionDigits: 2 })} €`, valueX, yPos);
  yPos += 8;
  
  doc.setFont(undefined, "bold");
  doc.text("Summe-Brutto:", labelX, yPos);
  doc.text(`${totalBrutto.toLocaleString("de-DE", { minimumFractionDigits: 2 })} €`, valueX, yPos);
  
  // Schlusstext hinzufügen
  if (schlusstext.trim()) {
    yPos += 10;
    if (yPos > pageBottom - 20) {
      doc.addPage();
      yPos = MARGIN_TOP;
    }
    doc.setFont(undefined, "normal");
    doc.setFontSize(9);
    const schlusstextLines = doc.splitTextToSize(schlusstext, contentWidth);
    schlusstextLines.forEach((line) => {
      if (yPos > pageBottom - 5) {
        doc.addPage();
        yPos = MARGIN_TOP;
      }
      doc.text(line, MARGIN_LEFT, yPos);
      yPos += 4;
    });
  }

  // Seitenzahlen hinzufügen
  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont(undefined, "normal");
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text(`Seite ${i}/${totalPages}`, pageWidth - MARGIN_RIGHT, pageHeight - 8, { align: "right" });
    doc.setTextColor(0, 0, 0);
  }

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

function addTableHeader(doc, x, y, width, colorRGB = [70, 130, 180]) {
  doc.setFont(undefined, "bold");
  doc.setFontSize(8);
  doc.setFillColor(...colorRGB);
  doc.setTextColor(255, 255, 255);
  
  // Hintergrund-Rechteck
  doc.rect(x, y - 2, width, 6, "F");
  
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
  doc.setFont(undefined, "normal");
}

function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? [
    parseInt(result[1], 16),
    parseInt(result[2], 16),
    parseInt(result[3], 16)
  ] : [70, 130, 180]; // Default fallback
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
      if (currentTitle) {
        result.push(currentTitle);
      }
      currentTitle = {
        title: lvPos.short_text,
        oz: lvPos.oz,
        positions: []
      };
    } else {
      const kalkPos = kalkulationen.find((p) => p.oz === lvPos.oz && p.short_text === lvPos.short_text);
      if (currentTitle) {
        currentTitle.positions.push({
          oz: lvPos.oz,
          short_text: lvPos.short_text || "",
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

  if (currentTitle) {
    result.push(currentTitle);
  }

  return result;
}