import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Hole das Unternehmen
    const companies = await base44.asServiceRole.entities.Stammdatum.filter({ typ: 'unternehmen', aktiv: true }, undefined, 1);
    if (!companies || companies.length === 0) {
      return Response.json({ error: 'Kein Unternehmen konfiguriert' }, { status: 400 });
    }

    const company = companies[0];
    const currentYear = new Date().getFullYear() % 100; // z.B. 26 für 2026

    // Prüfe ob Jahreszahl sich geändert hat, falls ja zurücksetzen
    let rechnungNummer = company.rechnung_nummer_laufend || 0;
    let rechnungJahr = company.rechnung_nummer_jahr || currentYear;

    if (rechnungJahr !== currentYear) {
      // Neues Jahr - zurücksetzen
      rechnungNummer = 0;
      rechnungJahr = currentYear;
    }

    // Erhöhe die laufende Nummer
    rechnungNummer += 1;

    // Aktualisiere das Unternehmen
    await base44.asServiceRole.entities.Stammdatum.update(company.id, {
      rechnung_nummer_laufend: rechnungNummer,
      rechnung_nummer_jahr: rechnungJahr
    });

    // Formatiere die Nummer (z.B. RE 26001)
    const formattedNummer = `RE ${rechnungJahr}${String(rechnungNummer).padStart(3, '0')}`;

    return Response.json({ rechnungNummer: formattedNummer });
  } catch (error) {
    console.error('Fehler bei Rechnungsnummernvergabe:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});