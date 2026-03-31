import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Alle Auftraggeber laden
    const alleAG = await base44.entities.Stammdatum.filter({ typ: "auftraggeber" }, "kundennummer", 1000);
    const unternehmen = await base44.entities.Stammdatum.filter({ typ: "unternehmen" }, undefined, 1);
    const firma = unternehmen[0];

    // Höchste Kundennummer ermitteln
    let maxNum = firma?.kundennummer_counter || 0;
    alleAG.forEach(ag => {
      if (ag.kundennummer) {
        const num = parseInt(ag.kundennummer.replace("KD-", ""), 10);
        if (!isNaN(num) && num > maxNum) maxNum = num;
      }
    });

    // Duplikate finden und korrigieren
    const nummernMap = {};
    const updates = [];

    alleAG.forEach(ag => {
      if (ag.kundennummer) {
        if (!nummernMap[ag.kundennummer]) {
          nummernMap[ag.kundennummer] = [];
        }
        nummernMap[ag.kundennummer].push(ag.id);
      }
    });

    // Für jede doppelte Nummer: erste behalten, Rest neu zuordnen
    for (const [kundenNum, ids] of Object.entries(nummernMap)) {
      if (ids.length > 1) {
        // Erste ID behält die Nummer
        for (let i = 1; i < ids.length; i++) {
          maxNum++;
          const newNum = `KD-${String(maxNum).padStart(5, "0")}`;
          updates.push(
            base44.asServiceRole.entities.Stammdatum.update(ids[i], { kundennummer: newNum })
          );
        }
      }
    }

    // Alle Updates ausführen und Counter aktualisieren
    if (updates.length > 0) {
      await Promise.all(updates);
    }
    if (firma) {
      await base44.asServiceRole.entities.Stammdatum.update(firma.id, { kundennummer_counter: maxNum });
    }

    return Response.json({
      success: true,
      duplicatesFixed: updates.length,
      newMaxCounter: maxNum
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});