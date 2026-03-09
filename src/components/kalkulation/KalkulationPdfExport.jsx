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