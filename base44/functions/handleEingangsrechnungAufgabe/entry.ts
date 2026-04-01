import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { event, data, old_data } = await req.json();

    if (!event || !data) {
      return Response.json({ error: 'Invalid payload' }, { status: 400 });
    }

    const projectId = data.project_id;
    const status = data.status;

    // 1. Neue Eingangsrechnung mit Status "eingegangen" → Aufgabe anlegen
    if (event.type === 'create' && status === 'eingegangen' && projectId) {
      const project = await base44.asServiceRole.entities.Project.get(projectId);
      if (!project || !project.site_manager) {
        return Response.json({ success: true, message: 'No site manager assigned' });
      }

      const aufgabe = await base44.asServiceRole.entities.Aufgabe.create({
        project_id: projectId,
        quelle_typ: 'system',
        quelle_id: event.entity_id,
        titel: `Eingangsrechnung prüfen: ${data.rechnungsnummer || 'Neue Rechnung'}`,
        beschreibung: `Die Eingangsrechnung von ${data.kreditor_name} muss geprüft und genehmigt werden.`,
        faellig_am: new Date().toISOString().split('T')[0],
        prioritaet: 'hoch',
        zugewiesen_an: project.site_manager,
        manuelle_bestaetigung_erforderlich: true,
      });

      return Response.json({ success: true, aufgabe_id: aufgabe.id });
    }

    // 2. Eingangsrechnung aktualisiert auf Status "geprueft" → Aufgabe abhaken
    if (event.type === 'update' && status === 'geprueft' && old_data?.status === 'eingegangen' && projectId) {
      const aufgaben = await base44.asServiceRole.entities.Aufgabe.filter({
        project_id: projectId,
        quelle_id: event.entity_id,
        quelle_typ: 'system',
        status: 'offen',
      });

      if (aufgaben.length > 0) {
        await Promise.all(
          aufgaben.map(a =>
            base44.asServiceRole.entities.Aufgabe.update(a.id, { status: 'erledigt' })
          )
        );
      }

      return Response.json({ success: true, closed_tasks: aufgaben.length });
    }

    return Response.json({ success: true, message: 'No action taken' });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});