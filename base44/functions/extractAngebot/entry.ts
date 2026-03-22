import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { file_url, lv_positions } = await req.json();

    if (!file_url || !lv_positions) {
      return Response.json({ error: 'file_url und lv_positions sind erforderlich' }, { status: 400 });
    }

    // LV-Positionen als kompakten Text für den Prompt aufbereiten
    const lvText = lv_positions
      .map(p => `OZ: ${p.oz} | Kurztext: ${p.short_text}`)
      .join('\n');

    const prompt = `Du bist ein Experte für Bauwesen und Kalkulation. Analysiere das folgende Angebotsdokument (PDF oder Bild) und extrahiere alle Positionen mit ihrem Kurztext und Einzelpreis (EP).

Dann versuche jede extrahierte Position einer der folgenden LV-Positionen zuzuordnen:
${lvText}

WICHTIG – Umgang mit Alternativen:
- Wenn im Angebot nach einer Position das Wort "oder", "alternativ", "Alternativposition" o.ä. erscheint, handelt es sich um eine Alternative.
- Extrahiere bei solchen Fällen NUR die erste (Haupt-)Position. Die Alternative wird vollständig ignoriert und darf NICHT in die Liste aufgenommen werden.

Regeln für die Zuordnung:
- Ordne zu, wenn der Sinn/Inhalt übereinstimmt, auch wenn die Formulierung leicht abweicht
- Achte bei ähnlichem Kurztext aber unterschiedlichem EP besonders auf weitere Merkmale wie Baulänge, Nennweite, Dimension oder Variante, um die richtige LV-Position zuzuordnen
- Wenn mehrere LV-Positionen ähnlich klingen (z.B. gleicher Rohrtyp, verschiedene Baulängen), ordne anhand dieser zusätzlichen Merkmale zu – nicht anhand des günstigsten oder teuersten Preises
- Verwende "konfidenz" zwischen 0 und 1 (1 = sehr sicher, 0 = unsicher)
- Wenn keine passende LV-Position gefunden werden kann, lasse "zugeordnete_oz" leer und setze konfidenz auf 0
- Extrahiere den Einzelpreis (EP) als Zahl ohne Währungssymbol
- Extrahiere die Positionsnummer aus dem Angebot (z.B. "01.", "1.1", "Pos. 3" etc.) in das Feld "pos_nr". Falls keine Positionsnummer erkennbar ist, lasse das Feld leer
- Bestimme den Kostentyp der Position anhand des Angebotsinhalts und des Anbieters:
  * "Material" – wenn es sich um Materiallieferungen, Produkte, Baustoffe handelt (z.B. Rohre, Schächte, Betonelement)
  * "NU" (Nachunternehmer) – wenn es sich um eine Leistung/Dienstleistung eines Subunternehmers handelt (z.B. Erdarbeiten, Verlegung, Montage durch Dritte)
  * "Lohn" – wenn es sich um eigene Lohnleistungen handelt
  * "Gerät" – wenn es sich um Geräteeinsatz handelt
  * "Sonstiges" – wenn keiner der obigen Typen passt
  Trage den Kostentyp in das Feld "kostentyp" ein.

Antworte NUR mit JSON, kein Text davor oder danach.`;

    const result = await base44.integrations.Core.InvokeLLM({
      prompt,
      file_urls: [file_url],
      response_json_schema: {
        type: "object",
        properties: {
          positionen: {
            type: "array",
            items: {
              type: "object",
              properties: {
                pos_nr: { type: "string" },
                kurztext_angebot: { type: "string" },
                ep: { type: "number" },
                einheit: { type: "string" },
                kostentyp: { type: "string", enum: ["Lohn", "Material", "Gerät", "NU", "Sonstiges"] },
                zugeordnete_oz: { type: "string" },
                zugeordneter_kurztext: { type: "string" },
                konfidenz: { type: "number" }
              }
            }
          }
        }
      }
    });

    // Positionen mit IDs und Zuordnungsstatus anreichern
    const positionen = (result.positionen || []).map(p => ({
      id: crypto.randomUUID(),
      pos_nr: p.pos_nr || '',
      kurztext_angebot: p.kurztext_angebot || '',
      ep: p.ep || 0,
      einheit: p.einheit || '',
      kostentyp: p.kostentyp || 'Material',
      zugeordnete_oz: p.zugeordnete_oz || '',
      zugeordneter_kurztext: p.zugeordneter_kurztext || '',
      konfidenz: p.konfidenz || 0,
      zuordnung_status: p.zugeordnete_oz && p.konfidenz >= 0.6 ? 'automatisch' : 'offen'
    }));

    return Response.json({ positionen });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});