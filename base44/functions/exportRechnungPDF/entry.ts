import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';
import jsPDF from 'npm:jspdf@4.0.0';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { rechnung_id } = await req.json();
    
    // Rechnung laden
    const rechnung = await base44.entities.Rechnung.get(rechnung_id);
    if (!rechnung) return Response.json({ error: 'Rechnung nicht gefunden' }, { status: 404 });

    // Projekt + Stammdatum laden
    const [projekt, stammdaten] = await Promise.all([
      base44.entities.Project.get(rechnung.project_id),
      base44.entities.Stammdatum.filter({ typ: "unternehmen" }, undefined, 1),
    ]);
    const firma = stammdaten[0];

    // PDF erstellen
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    let yPos = 10;

    // Header mit Logo + Briefkopf
    if (firma?.briefkopf_logo_url) {
      doc.addImage(firma.briefkopf_logo_url, 'PNG', 10, yPos, 30, 15);
    }
    doc.setFontSize(16);
    doc.setTextColor(40, 40, 40);
    doc.text(firma?.name || 'Unternehmen', 50, yPos + 5);
    
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    yPos += 20;
    if (firma?.briefkopf_strasse) doc.text(`${firma.briefkopf_strasse}`, 10, yPos);
    yPos += 5;
    if (firma?.briefkopf_plz && firma?.briefkopf_stadt) 
      doc.text(`${firma.briefkopf_plz} ${firma.briefkopf_stadt}`, 10, yPos);
    yPos += 5;
    if (firma?.briefkopf_telefon) doc.text(`Tel: ${firma.briefkopf_telefon}`, 10, yPos);
    yPos += 5;
    if (firma?.briefkopf_email) doc.text(`E-Mail: ${firma.briefkopf_email}`, 10, yPos);
    
    yPos += 15;

    // Rechnungs-Heading
    doc.setFontSize(14);
    doc.setTextColor(40, 40, 40);
    const rechnungsart = {
      abschlagsrechnung: 'Abschlagsrechnung',
      schlussrechnung: 'Schlussrechnung',
      teilrechnung: 'Teilrechnung',
    }[rechnung.rechnungsart] || 'Rechnung';
    doc.text(rechnungsart, 10, yPos);
    
    yPos += 12;
    doc.setFontSize(10);
    doc.setTextColor(80, 80, 80);
    doc.text(`Rechnungsnummer: ${rechnung.rechnungsnummer}`, 10, yPos);
    yPos += 6;
    doc.text(`Datum: ${rechnung.rechnungsdatum ? new Date(rechnung.rechnungsdatum).toLocaleDateString('de-DE') : '–'}`, 10, yPos);
    yPos += 6;
    const projektBez = [projekt?.project_name, projekt?.project_name_2, projekt?.project_name_3, projekt?.project_name_4].filter(Boolean).join(" / ");
    doc.text(`Projekt: ${projektBez || '–'} (${projekt?.project_number || '–'})`, 10, yPos);
    
    yPos += 12;

    // Positionen Tabelle
    doc.setFontSize(9);
    doc.setTextColor(40, 40, 40);
    
    const colX = [10, 80, 130, 160, 190];
    const rowHeight = 6;
    
    // Header
    doc.setFont(undefined, 'bold');
    doc.text('Position', colX[0], yPos);
    doc.text('Menge', colX[1], yPos);
    doc.text('EP €', colX[2], yPos);
    doc.text('GP €', colX[3], yPos);
    
    yPos += rowHeight;
    doc.setLineWidth(0.1);
    doc.line(10, yPos - 1, pageWidth - 10, yPos - 1);
    
    // Positionen
    doc.setFont(undefined, 'normal');
    doc.setTextColor(60, 60, 60);
    (rechnung.positionen || []).forEach((p) => {
      const menge = p.menge_aktuell || p.menge_kumuliert || 0;
      const ep = p.ep || 0;
      const gp = (menge * ep);
      
      doc.text(p.short_text?.substring(0, 40) || '–', colX[0], yPos);
      doc.text(String(menge.toFixed(2)), colX[1], yPos);
      doc.text(`${ep.toFixed(2)}`, colX[2], yPos);
      doc.text(`${gp.toFixed(2)}`, colX[3], yPos);
      
      yPos += rowHeight;
    });

    yPos += 5;
    doc.setLineWidth(0.2);
    doc.line(colX[3], yPos - 2, pageWidth - 10, yPos - 2);

    // Summen
    doc.setFont(undefined, 'bold');
    doc.setTextColor(0, 0, 0);
    yPos += 5;
    doc.text(`Summe netto: ${(rechnung.betrag_netto || 0).toFixed(2)} €`, colX[3], yPos);
    yPos += 6;
    
    const mwst = ((rechnung.betrag_netto || 0) * ((rechnung.mwst_satz || 19) / 100));
    doc.text(`MwSt (${rechnung.mwst_satz || 19}%): ${mwst.toFixed(2)} €`, colX[3], yPos);
    yPos += 6;
    
    if (rechnung.einbehalt > 0) {
      doc.text(`Sicherheitseinbehalt: -${(rechnung.einbehalt).toFixed(2)} €`, colX[3], yPos);
      yPos += 6;
    }
    
    doc.setFontSize(11);
    doc.text(`Rechnungsbetrag: ${(rechnung.betrag_brutto || 0).toFixed(2)} €`, colX[3], yPos);

    // Footer
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text(firma?.pdf_footer_links || '', 10, pageHeight - 10);
    doc.text(firma?.pdf_footer_mitte || '', pageWidth / 2 - 20, pageHeight - 10);
    doc.text(firma?.pdf_footer_rechts || '', pageWidth - 40, pageHeight - 10);

    const pdfBytes = doc.output('arraybuffer');
    return new Response(pdfBytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="Rechnung_${rechnung.rechnungsnummer}.pdf"`,
      },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});