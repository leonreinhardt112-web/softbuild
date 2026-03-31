import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Loader2, Mail, AlertTriangle, FileText, Calendar, MessageSquare, RefreshCw, ChevronRight } from "lucide-react";

const KATEGORIE_CONFIG = {
  rechnung: { label: "Rechnung", color: "bg-orange-100 text-orange-700", icon: FileText },
  reklamation: { label: "Reklamation", color: "bg-red-100 text-red-700", icon: AlertTriangle },
  anfrage: { label: "Anfrage", color: "bg-blue-100 text-blue-700", icon: MessageSquare },
  termin: { label: "Termin", color: "bg-purple-100 text-purple-700", icon: Calendar },
  info: { label: "Info", color: "bg-secondary text-secondary-foreground", icon: Mail },
  nachtrag: { label: "Nachtrag", color: "bg-amber-100 text-amber-700", icon: FileText },
  abnahme: { label: "Abnahme", color: "bg-green-100 text-green-700", icon: Calendar },
  sonstiges: { label: "Sonstiges", color: "bg-secondary text-secondary-foreground", icon: Mail },
};

const PRIORITAET_COLOR = {
  kritisch: "bg-red-500 text-white",
  hoch: "bg-orange-100 text-orange-700",
  mittel: "bg-secondary text-secondary-foreground",
  niedrig: "bg-muted text-muted-foreground",
};

export default function KIEmailTriage({ emails, projects, onEmailAction }) {
  const [analysierte, setAnalysierte] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedEmails, setSelectedEmails] = useState([]);

  const toggleSelect = (id) => {
    setSelectedEmails(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const analysiereEmails = async () => {
    const toAnalyze = emails.filter(e => selectedEmails.includes(e.id));
    if (!toAnalyze.length) return;

    setLoading(true);
    const projektListe = projects.map(p => `${p.project_name} (${p.project_number})`).join(", ");

    try {
      const results = await Promise.all(
        toAnalyze.map(async (email) => {
          const result = await base44.integrations.Core.InvokeLLM({
            prompt: `Du bist ein Assistent für ein Tiefbauunternehmen. Analysiere diese E-Mail und klassifiziere sie.

E-Mail:
Von: ${email.absender || "unbekannt"}
Betreff: ${email.betreff || ""}
Datum: ${email.datum || ""}
Inhalt: ${email.inhalt_notiz || email.kurzzusammenfassung || ""}

Verfügbare Projekte: ${projektListe || "keine"}

Bestimme:
- kategorie: "rechnung", "reklamation", "anfrage", "termin", "info", "nachtrag", "abnahme" oder "sonstiges"
- prioritaet: "kritisch", "hoch", "mittel" oder "niedrig"
- projekt_name: Wahrscheinlichstes Projekt (leer wenn nicht eindeutig)
- frist_erkannt: Datum einer genannten Frist im Format YYYY-MM-DD (leer wenn keine)
- frist_beschreibung: Beschreibung der Frist (leer wenn keine)
- handlungsbedarf: true/false – Muss reagiert werden?
- ki_antwort_entwurf: Kurzer Antwort-Entwurf (2-3 Sätze) falls handlungsbedarf, sonst leer
- zusammenfassung: 1-Satz-Zusammenfassung der E-Mail`,
            response_json_schema: {
              type: "object",
              properties: {
                kategorie: { type: "string" },
                prioritaet: { type: "string" },
                projekt_name: { type: "string" },
                frist_erkannt: { type: "string" },
                frist_beschreibung: { type: "string" },
                handlungsbedarf: { type: "boolean" },
                ki_antwort_entwurf: { type: "string" },
                zusammenfassung: { type: "string" },
              },
            },
          });
          return { ...email, ki: result };
        })
      );

      setAnalysierte(prev => {
        const existing = prev.filter(a => !results.find(r => r.id === a.id));
        return [...existing, ...results];
      });
      setSelectedEmails([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Auswahl & Aktion */}
      {emails.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              KI-E-Mail-Triage
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                {selectedEmails.length === 0
                  ? "E-Mails auswählen, um sie von der KI analysieren zu lassen"
                  : `${selectedEmails.length} E-Mail${selectedEmails.length !== 1 ? "s" : ""} ausgewählt`}
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs gap-1"
                  onClick={() => setSelectedEmails(emails.map(e => e.id))}
                  disabled={loading}
                >
                  Alle
                </Button>
                <Button
                  size="sm"
                  className="text-xs gap-1.5"
                  onClick={analysiereEmails}
                  disabled={loading || selectedEmails.length === 0}
                >
                  {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                  {loading ? "Analysiere…" : "KI analysieren"}
                </Button>
              </div>
            </div>

            {/* E-Mail Liste */}
            <div className="space-y-1.5 max-h-64 overflow-y-auto">
              {emails.map(email => {
                const analysiert = analysierte.find(a => a.id === email.id);
                const KatConf = analysiert ? KATEGORIE_CONFIG[analysiert.ki?.kategorie] || KATEGORIE_CONFIG.sonstiges : null;
                const KatIcon = KatConf?.icon || Mail;

                return (
                  <div
                    key={email.id}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg border cursor-pointer transition-all ${
                      selectedEmails.includes(email.id)
                        ? "border-primary bg-primary/5"
                        : "border-border hover:bg-accent/50"
                    }`}
                    onClick={() => !analysiert && toggleSelect(email.id)}
                  >
                    <input
                      type="checkbox"
                      checked={selectedEmails.includes(email.id)}
                      onChange={() => toggleSelect(email.id)}
                      onClick={e => e.stopPropagation()}
                      className="w-3.5 h-3.5"
                      disabled={!!analysiert}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{email.betreff || "Kein Betreff"}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{email.absender} · {email.datum}</p>
                    </div>
                    {analysiert ? (
                      <div className="flex items-center gap-1.5">
                        {analysiert.ki?.handlungsbedarf && (
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                        )}
                        <Badge className={`text-[10px] ${KatConf?.color}`}>
                          {KatConf?.label}
                        </Badge>
                        <Badge className={`text-[10px] ${PRIORITAET_COLOR[analysiert.ki?.prioritaet]}`}>
                          {analysiert.ki?.prioritaet}
                        </Badge>
                      </div>
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Analysierte Ergebnisse */}
      {analysierte.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            KI-Analyse – {analysierte.length} E-Mail{analysierte.length !== 1 ? "s" : ""}
          </p>
          {analysierte.map(email => {
            const ki = email.ki || {};
            const KatConf = KATEGORIE_CONFIG[ki.kategorie] || KATEGORIE_CONFIG.sonstiges;
            const KatIcon = KatConf.icon;

            return (
              <Card key={email.id} className={ki.handlungsbedarf ? "border-amber-300" : ""}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <KatIcon className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm font-semibold">{email.betreff}</span>
                        <Badge className={`text-[10px] ${KatConf.color}`}>{KatConf.label}</Badge>
                        <Badge className={`text-[10px] ${PRIORITAET_COLOR[ki.prioritaet]}`}>{ki.prioritaet}</Badge>
                        {ki.handlungsbedarf && (
                          <Badge className="text-[10px] bg-amber-100 text-amber-700">Handlungsbedarf</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{email.absender} · {email.datum}</p>
                    </div>
                  </div>

                  <p className="text-xs text-foreground bg-muted/40 rounded-lg px-3 py-2">{ki.zusammenfassung}</p>

                  <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                    {ki.projekt_name && (
                      <span className="flex items-center gap-1">
                        <span className="font-medium">Projekt:</span> {ki.projekt_name}
                      </span>
                    )}
                    {ki.frist_erkannt && (
                      <span className="flex items-center gap-1 text-amber-700 font-medium">
                        <Calendar className="w-3 h-3" />
                        Frist: {new Date(ki.frist_erkannt).toLocaleDateString("de-DE")} – {ki.frist_beschreibung}
                      </span>
                    )}
                  </div>

                  {ki.ki_antwort_entwurf && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <p className="text-[11px] font-semibold text-blue-700 mb-1 flex items-center gap-1">
                        <Sparkles className="w-3 h-3" /> KI-Antwortvorschlag
                      </p>
                      <p className="text-xs text-blue-800 italic">"{ki.ki_antwort_entwurf}"</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}