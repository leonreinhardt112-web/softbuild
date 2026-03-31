import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { aufmass_id, updates } = await req.json();
    
    // Alte Aufmass laden
    const aufmass = await base44.entities.Aufmass.get(aufmass_id);
    if (!aufmass) return Response.json({ error: 'Aufmass nicht gefunden' }, { status: 404 });
    
    // Stammdatum für Nummernvergabe
    const [stammdatum] = await base44.entities.Stammdatum.filter({ typ: "unternehmen" }, undefined, 1);
    if (!stammdatum) return Response.json({ error: 'Unternehmen nicht konfiguriert' }, { status: 500 });

    // 1. Storno erstellen (Gegenbuchung mit "-" Betrag)
    const stoernoAufmass = await base44.entities.Aufmass.create({
      project_id: aufmass.project_id,
      kalkulation_id: aufmass.kalkulation_id,
      ar_nummer: aufmass.ar_nummer,
      bezeichnung: `STORNO: ${aufmass.bezeichnung}`,
      rechnungsnummer: `${aufmass.rechnungsnummer}-ST`,
      datum: new Date().toISOString().split('T')[0],
      abrechner: user.full_name,
      status: "abgerechnet",
      positionen: (aufmass.positionen || []).map(p => ({
        ...p,
        gp_aktuell: -(p.gp_aktuell || 0),
        menge_aktuell: -(p.menge_aktuell || 0),
      })),
      betrag_aktuell: -(aufmass.betrag_aktuell || 0),
      betrag_netto: -(aufmass.betrag_netto || 0),
      betrag_vorperioden: aufmass.betrag_vorperioden,
      notes: `Storno von ${aufmass.rechnungsnummer}`,
    });

    // 2. Neue Aufmass mit nächster AR-Nummer und aktualisierten Feldern
    const nextArNummer = (aufmass.ar_nummer || 0) + 1;
    const nextRechnungsnummer = `${stammdatum.rechnung_nummer_jahr}${String((stammdatum.rechnung_nummer_laufend || 0) + 1).padStart(4, '0')}`;
    
    const newAufmass = await base44.entities.Aufmass.create({
      ...aufmass,
      ar_nummer: nextArNummer,
      rechnungsnummer: nextRechnungsnummer,
      datum: new Date().toISOString().split('T')[0],
      abrechner: updates.abrechner || aufmass.abrechner,
      status: "entwurf",
      skonto_prozent: updates.skonto_prozent !== undefined ? updates.skonto_prozent : aufmass.skonto_prozent,
      skonto_tage: updates.skonto_tage !== undefined ? updates.skonto_tage : aufmass.skonto_tage,
      positionen: aufmass.positionen,
      betrag_aktuell: aufmass.betrag_aktuell,
      betrag_netto: aufmass.betrag_netto,
      betrag_vorperioden: aufmass.betrag_vorperioden,
      notes: updates.notes || aufmass.notes,
    });

    // Nummer-Counter inkrementieren
    await base44.entities.Stammdatum.update(stammdatum.id, {
      rechnung_nummer_laufend: (stammdatum.rechnung_nummer_laufend || 0) + 1,
    });

    // Alte Aufmass als storniert markieren
    await base44.entities.Aufmass.update(aufmass_id, { status: "storniert" });

    return Response.json({
      storno_id: stoernoAufmass.id,
      storno_nummer: `${aufmass.rechnungsnummer}-ST`,
      new_id: newAufmass.id,
      new_nummer: nextRechnungsnummer,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});