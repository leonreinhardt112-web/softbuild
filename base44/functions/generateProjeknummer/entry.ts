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
    let projektNummer = company.projekt_nummer_laufend || 0;
    const currentYear = new Date().getFullYear() % 100; // z.B. 26 für 2026

    // Erhöhe die laufende Nummer
    projektNummer += 1;

    // Aktualisiere das Unternehmen
    await base44.asServiceRole.entities.Stammdatum.update(company.id, {
      projekt_nummer_laufend: projektNummer
    });

    // Formatiere die Nummer (z.B. 26-00001)
    const formattedNummer = `${currentYear}-${String(projektNummer).padStart(5, '0')}`;

    return Response.json({ projektNummer: formattedNummer });
  } catch (error) {
    console.error('Fehler bei Projektnummernvergabe:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});