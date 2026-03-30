import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { email, vorname, nachname } = await req.json();

    if (!email) {
      return Response.json({ error: 'Email is required' }, { status: 400 });
    }

    // Erstelle ein persönliches Postfach für den neuen Benutzer
    const mailbox = await base44.entities.Postfach.create({
      email_adresse: email,
      bezeichnung: vorname && nachname ? `${vorname} ${nachname}` : email,
      typ: 'persoenlich',
      anbieter: 'google_workspace',
      user_emails: [email],
      aktiv: true,
      notiz: 'Automatisch erstellt bei Benutzer-Anlage'
    });

    return Response.json({ 
      success: true, 
      mailbox_id: mailbox.id,
      message: `Postfach für ${email} erstellt`
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});