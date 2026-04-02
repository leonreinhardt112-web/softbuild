import jsPDF from "jspdf";
import { base44 } from "@/api/base44Client";
import { hexToRgb, addFooterAllPages, getPageBottom } from "@/utils/pdfBriefkopf";

const MARGIN_TOP = 20;
const MARGIN_LEFT = 20;
const MARGIN_RIGHT = 20;

export async function generateKalkulationPDF(project, kalkulation, options = {}) {
  const { textMode = "short", vortext = "", schlusstext = "", unserZeichen = "" } = options;
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentWidth = pageWidth - MARGIN_LEFT - MARGIN_RIGHT;

  let company = null;
  let client = null;
  let headerColor = [70, 130, 180];

  try {
    const companies = await base44.entities.Stammdatum.filter({ typ: "unternehmen", aktiv: true }, undefined, 1);
    if (companies?.length > 0) {
      company = companies[0];
      if (company.angebot_header_farbe) headerColor = hexToRgb(company.angebot_header_farbe);
    }
    if (project.client_id) {
      try {
        client = await base44.entities.Stammdatum.read(project.client_id);
      } catch {
        const clients = await base44.entities.Stammdatum.filter({ typ: "auftraggeber", name: project.client }, undefined, 1);
        client = clients?.length > 0 ? clients[0] : null;
      }
    } else if (project.client) {
      const clients = await base44.entities.Stammdatum.filter({ typ: "auftraggeber", name: project.client }, undefined, 1);
      client = clients?.length > 0 ? clients[0] : null;
    }
  } catch (e) {
    console.error("Fehler beim Laden der Stammdaten:", e);
  }

  // Erste Seite – Header
  const yAfterHeader = addHeaderSection(doc, company, project, client, kalkulation, MARGIN_TOP, MARGIN_LEFT, pageWidth, unserZeichen);

  let yPos = yAfterHeader + 2;
  const pageBottom = getPageBottom(pageHeight);

  // Vortext
  if (vortext.trim()) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(40);
    const vortextLines = doc.splitTextToSize(vortext, contentWidth);
    vortextLines.forEach((line) => {
      if (yPos > pageBottom - 15) { doc.addPage(); yPos = MARGIN_TOP; }
      doc.text(line, MARGIN_LEFT, yPos);
      yPos += 4;
    });
    yPos += 2;
  }

  // Positionen
  const positionsByTitle = groupPositionsByTitle(project.lv_positions || [], kalkulation.positions || []);
  addTableHeader(doc, MARGIN_LEFT, yPos, contentWidth, headerColor);
  yPos += 10;

  for (const titleGroup of positionsByTitle) {
    if (yPos + 8 > pageBottom) {
      doc.addPage();
      yPos = MARGIN_TOP + 10;
      addTableHeader(doc, MARGIN_LEFT, yPos, contentWidth, headerColor);
      yPos += 10;
    }

    if (titleGroup.title) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setFillColor(230, 240, 250);
      doc.rect(MARGIN_LEFT, yPos - 2, contentWidth, 6, "F");
      doc.setTextColor(40);
      doc.text((titleGroup.oz || "").toString(), MARGIN_LEFT + 1, yPos + 2);
      doc.text(titleGroup.title, MARGIN_LEFT + 27, yPos + 2);
      yPos += 8;
    }

    for (const pos of titleGroup.positions) {
      if (yPos > pageBottom - 10) {
        doc.addPage();
        yPos = MARGIN_TOP + 10;
        addTableHeader(doc, MARGIN_LEFT, yPos, contentWidth, headerColor);
        yPos += 10;
      }

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(40);

      if (pos.posIndex % 2 === 1) {
        doc.setFillColor(248, 248, 248);
        doc.rect(MARGIN_LEFT, yPos - 2.5, contentWidth, 7, "F");
      }

      const menge = parseFloat(pos.menge) || 0;
      const ep = Number(pos.ep) || 0;
      const gp = Number(pos.gp) || 0;

      doc.text((pos.oz || "").toString(), MARGIN_LEFT + 1, yPos + 1);

      const shortText = (pos.short_text || "").split("\n")[0];
      const shortTextLines = doc.splitTextToSize(shortText, 53);
      const shortTextHeight = shortTextLines.length * 3.5;
      shortTextLines.forEach((line, idx) => { doc.text(line, MARGIN_LEFT + 27, yPos + 1 + idx * 3.5); });

      doc.text(menge.toLocaleString("de-DE", { minimumFractionDigits: 2 }), MARGIN_LEFT + 94, yPos + 1, { align: "right" });
      doc.text(pos.einheit || "", MARGIN_LEFT + 97, yPos + 1);
      doc.text(`${ep.toLocaleString("de-DE", { minimumFractionDigits: 2 })} €`, MARGIN_LEFT + 128, yPos + 1, { align: "right" });
      doc.setFont("helvetica", "bold");
      doc.text(`${gp.toLocaleString("de-DE", { minimumFractionDigits: 2 })} €`, MARGIN_LEFT + 148, yPos + 1, { align: "right" });
      doc.setFont("helvetica", "normal");

      yPos += Math.max(7, shortTextHeight) + 2;

      if (pos.long_text && textMode === "both") {
        doc.setFontSize(8);
        doc.setTextColor(80, 80, 80);
        let cleanedLongText = pos.long_text.trim();
        if (shortText && cleanedLongText.startsWith(shortText)) cleanedLongText = cleanedLongText.substring(shortText.length).trim();
        const cleanedLines = cleanedLongText.split("\n").map(l => l.trim()).filter(l => l.length > 0);
        const paragraphs = [];
        let current = "";
        cleanedLines.forEach(line => {
          current = current ? current + " " + line : line;
          if (/[.!?]$/.test(line) || line.length < 30) { paragraphs.push(current); current = ""; }
        });
        if (current) paragraphs.push(current);
        paragraphs.forEach(para => {
          doc.splitTextToSize(para, contentWidth - 4).forEach(line => {
            if (yPos > pageBottom - 10) { doc.addPage(); yPos = MARGIN_TOP; addTableHeader(doc, MARGIN_LEFT, yPos, contentWidth, headerColor); yPos += 10; }
            doc.text(line, MARGIN_LEFT + 2, yPos);
            yPos += 3.5;
          });
          yPos += 1;
        });
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(9);
        yPos += 2;
      }
    }

    if (titleGroup.positions.length > 0) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(40);
      const titleSum = titleGroup.positions.reduce((s, p) => s + (Number(p.gp) || 0), 0);
      doc.text("Summe Titel", MARGIN_LEFT + 86, yPos + 2);
      doc.text(`${titleSum.toLocaleString("de-DE", { minimumFractionDigits: 2 })} €`, pageWidth - MARGIN_RIGHT - 2, yPos + 2, { align: "right" });
      yPos += 6;
      if (yPos > pageBottom - 15) { doc.addPage(); yPos = MARGIN_TOP; }
    }
  }

  // Zusammenfassung
  if (yPos > pageBottom - 50) { doc.addPage(); yPos = MARGIN_TOP; }
  yPos += 5;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(40);
  doc.text("Zusammenfassung", MARGIN_LEFT, yPos);
  yPos += 10;

  const totalNetto = (kalkulation.positions || []).reduce((sum, p) => sum + (Number(p.gp) || 0), 0);
  const mwst = totalNetto * 0.19;
  const totalBrutto = totalNetto + mwst;
  const summaryValueX = pageWidth - MARGIN_RIGHT - 30;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("Summe-Netto:", MARGIN_LEFT, yPos);
  doc.text(`${totalNetto.toLocaleString("de-DE", { minimumFractionDigits: 2 })} €`, summaryValueX, yPos, { align: "right" });
  yPos += 7;
  doc.text("19,00 % MwSt.:", MARGIN_LEFT, yPos);
  doc.text(`${mwst.toLocaleString("de-DE", { minimumFractionDigits: 2 })} €`, summaryValueX, yPos, { align: "right" });
  yPos += 7;
  doc.setFont("helvetica", "bold");
  doc.text("Summe-Brutto:", MARGIN_LEFT, yPos);
  doc.text(`${totalBrutto.toLocaleString("de-DE", { minimumFractionDigits: 2 })} €`, summaryValueX, yPos, { align: "right" });

  if (schlusstext.trim()) {
    yPos += 10;
    if (yPos > pageBottom - 20) { doc.addPage(); yPos = MARGIN_TOP; }
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.splitTextToSize(schlusstext, contentWidth).forEach((line) => {
      if (yPos > pageBottom - 5) { doc.addPage(); yPos = MARGIN_TOP; }
      doc.text(line, MARGIN_LEFT, yPos);
      yPos += 4;
    });
  }

  // Gemeinsamer Footer
  addFooterAllPages(doc, company, pageWidth, pageHeight, MARGIN_LEFT, MARGIN_RIGHT);

  doc.save(`Angebot_${project.project_number}_${new Date().toISOString().split("T")[0]}.pdf`);
}

// ===================== HEADER – identisch zur Rechnung =====================
function addHeaderSection(doc, company, project, client, kalkulation, topMargin, leftMargin, pageWidth, unserZeichen = "") {
  const rightMargin = MARGIN_RIGHT;
  const contentWidth = pageWidth - leftMargin - rightMargin;

  // 1. Absenderzeile oben links (klein, grau)
  if (company) {
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(120);
    const absLine = [company.name, company.briefkopf_strasse, `${company.briefkopf_plz || ""} ${company.briefkopf_stadt || ""}`.trim()].filter(Boolean).join(" | ");
    doc.text(absLine, leftMargin, topMargin);
  }

  // 2. Empfängeradresse links
  let addrY = topMargin + 10;
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(40);
  if (client) {
    doc.text(client.name || "", leftMargin, addrY); addrY += 5;
    if (client.adresse) {
      client.adresse.split(", ").forEach(l => { doc.text(l, leftMargin, addrY); addrY += 4; });
    } else {
      if (client.briefkopf_strasse) { doc.text(client.briefkopf_strasse, leftMargin, addrY); addrY += 4; }
      const plzStadt = `${client.briefkopf_plz || ""} ${client.briefkopf_stadt || ""}`.trim();
      if (plzStadt) { doc.text(plzStadt, leftMargin, addrY); addrY += 4; }
    }
  } else if (project.client) {
    doc.text(project.client, leftMargin, addrY); addrY += 5;
  }

  // 3. Rechts: "Angebot" groß + Metadaten (identisch zu Rechnung)
  const infoBoxX = pageWidth / 2 + 10;
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(40);
  doc.text("Angebot", infoBoxX, topMargin + 12);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(40);
  let detailY = topMargin + 19;
  const meta = [
    ["Projekt-Nr.:", project.project_number || ""],
    ["Angebots-Nr.:", kalkulation.angebot_nummer || ""],
    ["Datum:", new Date().toLocaleDateString("de-DE")],
    ...(client?.kundennummer ? [["Kunden-Nr.:", client.kundennummer]] : []),
    ...(unserZeichen ? [["Unser Zeichen:", unserZeichen]] : []),
  ];
  meta.forEach(([label, val]) => {
    doc.text(label, infoBoxX, detailY);
    doc.text(val, infoBoxX + 28, detailY);
    detailY += 4;
  });

  // 4. Projektbezeichnungen fett links (mehrzeilig)
  let projectY = Math.max(addrY, detailY) + 4;
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(40);
  const nameLines = [
    project.project_name,
    project.project_name_2,
    project.project_name_3,
    project.project_name_4,
  ].filter(Boolean);
  nameLines.forEach((line, idx) => { doc.text(line, leftMargin, projectY + idx * 5); });
  projectY += nameLines.length * 5;

  // Trennlinie
  projectY += 3;
  doc.setDrawColor(180);
  doc.line(leftMargin, projectY, pageWidth - rightMargin, projectY);
  doc.setDrawColor(0);

  return projectY + 2;
}

function addTableHeader(doc, x, y, width, colorRGB = [70, 130, 180]) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setFillColor(...colorRGB);
  doc.setTextColor(255, 255, 255);
  doc.rect(x, y - 2, width, 6, "F");
  const headers = ["Pos.", "Bezeichnung", "Menge", "ME", "EP", "GP"];
  const colWidths = [15, 65, 16, 13, 21, 20];
  let xPos = x;
  headers.forEach((h, i) => {
    const align = i >= 2 ? "right" : "left";
    const textX = align === "right" ? xPos + colWidths[i] - 2 : xPos + 2;
    doc.text(h, textX, y + 2, { align });
    xPos += colWidths[i];
  });
  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "normal");
}

function groupPositionsByTitle(lvPositions, kalkulationen) {
  const isTitle = (pos) => !pos.quantity || pos.quantity === "0" || pos.quantity === "";
  const result = [];
  let currentTitle = null;
  lvPositions.forEach((lvPos) => {
    if (isTitle(lvPos)) {
      if (currentTitle) result.push(currentTitle);
      currentTitle = { title: lvPos.short_text, oz: lvPos.oz, positions: [] };
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
          posIndex: currentTitle.positions.length,
        });
      }
    }
  });
  if (currentTitle) result.push(currentTitle);
  return result;
}