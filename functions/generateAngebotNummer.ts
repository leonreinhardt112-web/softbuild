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
    let angebotNummer = company.angebot_nummer_laufend || 0;
    let angebotJahr = company.angebot_nummer_jahr || currentYear;

    if (angebotJahr !== currentYear) {
      // Neues Jahr - zurücksetzen
      angebotNummer = 0;
      angebotJahr = currentYear;
    }

    // Erhöhe die laufende Nummer
    angebotNummer += 1;

    // Aktualisiere das Unternehmen
    await base44.asServiceRole.entities.Stammdatum.update(company.id, {
      angebot_nummer_laufend: angebotNummer,
      angebot_nummer_jahr: angebotJahr
    });

    // Formatiere die Nummer (z.B. 26001)
    const formattedNummer = `${angebotJahr}${String(angebotNummer).padStart(3, '0')}`;

    return Response.json({ angebotNummer: formattedNummer });
  } catch (error) {
    console.error('Fehler bei Angebotsnummernvergabe:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});