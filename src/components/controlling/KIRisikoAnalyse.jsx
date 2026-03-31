import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Loader2, AlertTriangle, TrendingUp, TrendingDown, Minus, RefreshCw } from "lucide-react";

const RISIKO_FARBE = {
  hoch: "bg-red-100 text-red-700 border-red-200",
  mittel: "bg-amber-100 text-amber-700 border-amber-200",
  niedrig: "bg-green-100 text-green-700 border-green-200",
};
const TREND_ICON = { positiv: TrendingUp, negativ: TrendingDown, neutral: Minus };
const TREND_COLOR = { positiv: "text-green-600", negativ: "text-red-500", neutral: "text-muted-foreground" };

export default function KIRisikoAnalyse({ projects, rechnungen, nachtraege, kalks }) {
  const [analyse, setAnalyse] = useState(null);
  const [loading, setLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);

  const runAnalyse = async () => {
    setLoading(true);
    try {
      // Daten für KI aufbereiten
      const projektDaten = projects.slice(0, 20).map(p => {
        const rechns = rechnungen.filter(r => r.project_id === p.id && r.status !== "storniert");
        const nachts = nachtraege.filter(n => n.project_id === p.id);
        const kalk = kalks.find(k => k.project_id === p.id && k.status === "beauftragt");
        const umsatz = rechns.reduce((s, r) => s + (r.betrag_netto || 0), 0);
        const offen = rechns.filter(r => !["bezahlt", "storniert"].includes(r.status))
          .reduce((s, r) => s + ((r.betrag_brutto || 0) - (r.zahlungseingang || 0)), 0);
        const nachtragsVol = nachts.reduce((s, n) => s + (n.betrag_angemeldet || 0), 0);
        const nachtragsBeauftragt = nachts.filter(n => n.status === "beauftragt")
          .reduce((s, n) => s + (n.betrag_beauftragt || 0), 0);

        return {
          name: p.project_name,
          status: p.status,
          auftragssumme: p.auftragssumme || 0,
          umsatz,
          offen_forderungen: offen,
          leistungsgrad_pct: p.auftragssumme ? Math.round((umsatz / p.auftragssumme) * 100) : 0,
          herstellkosten_soll: kalk?.kalkulierte_herstellkosten || 0,
          deckungsbeitrag_soll: kalk?.deckungsbeitrag_prozent || 0,
          nachtrag_angemeldet: nachtragsVol,
          nachtrag_beauftragt: nachtragsBeauftragt,
          fortschritt_baulich: p.fortschritt_prozent_manuell || 0,
          projekt_start: p.project_start,
          projekt_end: p.project_end,
          afu_status: p.afu_status,
        };
      });

      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `Du bist ein erfahrener Controlling-Experte für ein Tiefbauunternehmen. Analysiere die folgenden Projektdaten und erstelle eine strukturierte Risikoanalyse.

Projektdaten (JSON):
${JSON.stringify(projektDaten, null, 2)}

Analysiere:
1. Welche Projekte haben erhöhtes finanzielles Risiko? (Leistungsgrad, offene Forderungen, Nachtragsquote)
2. Wo gibt es positive Trends? (gute Deckungsbeiträge, hoher Nachtragsbeauftragungsgrad)
3. Gesamtfazit und wichtigste Handlungsempfehlungen

Gib zurück:
- zusammenfassung: Executive Summary (2-3 Sätze)
- gesamt_risiko: "hoch", "mittel" oder "niedrig"
- gesamt_trend: "positiv", "negativ" oder "neutral"
- projekt_risiken: Array mit den Top-5 Risikohinweisen (jeweils: projekt_name, risiko_level "hoch/mittel/niedrig", beschreibung, empfehlung)
- positiv_highlights: Array mit bis zu 3 positiven Beobachtungen (jeweils: beschreibung)
- handlungsempfehlungen: Array mit 3-5 priorisierten Empfehlungen`,
        response_json_schema: {
          type: "object",
          properties: {
            zusammenfassung: { type: "string" },
            gesamt_risiko: { type: "string" },
            gesamt_trend: { type: "string" },
            projekt_risiken: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  projekt_name: { type: "string" },
                  risiko_level: { type: "string" },
                  beschreibung: { type: "string" },
                  empfehlung: { type: "string" },
                },
              },
            },
            positiv_highlights: {
              type: "array",
              items: { type: "object", properties: { beschreibung: { type: "string" } } },
            },
            handlungsempfehlungen: {
              type: "array",
              items: { type: "string" },
            },
          },
        },
      });

      setAnalyse(result);
      setLastUpdate(new Date());
    } finally {
      setLoading(false);
    }
  };

  const TrendIcon = TREND_ICON[analyse?.gesamt_trend] || Minus;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            KI-Risikoanalyse & Controlling-Kommentar
          </CardTitle>
          <Button
            size="sm"
            variant={analyse ? "outline" : "default"}
            onClick={runAnalyse}
            disabled={loading || projects.length === 0}
            className="gap-1.5 text-xs"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : analyse ? <RefreshCw className="w-3.5 h-3.5" /> : <Sparkles className="w-3.5 h-3.5" />}
            {loading ? "Analysiere…" : analyse ? "Neu analysieren" : "KI-Analyse starten"}
          </Button>
        </div>
        {lastUpdate && (
          <p className="text-[11px] text-muted-foreground">
            Letzte Analyse: {lastUpdate.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })} Uhr
          </p>
        )}
      </CardHeader>

      {!analyse && !loading && (
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            Starte die KI-Analyse, um eine automatische Risikoeinschätzung aller Projekte zu erhalten.
          </p>
        </CardContent>
      )}

      {loading && (
        <CardContent>
          <div className="flex items-center justify-center gap-3 py-8 text-sm text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
            KI analysiert {projects.length} Projekte…
          </div>
        </CardContent>
      )}

      {analyse && !loading && (
        <CardContent className="space-y-5">
          {/* Zusammenfassung */}
          <div className="flex items-start gap-3 p-4 bg-muted/40 rounded-xl border border-border">
            <TrendIcon className={`w-5 h-5 shrink-0 mt-0.5 ${TREND_COLOR[analyse.gesamt_trend]}`} />
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-semibold">Gesamtbewertung</span>
                <Badge className={`text-[10px] border ${RISIKO_FARBE[analyse.gesamt_risiko] || "bg-secondary text-secondary-foreground border-border"}`}>
                  Risiko: {analyse.gesamt_risiko}
                </Badge>
              </div>
              <p className="text-sm text-foreground">{analyse.zusammenfassung}</p>
            </div>
          </div>

          {/* Projektrisiken */}
          {analyse.projekt_risiken?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Projektrisiken</p>
              <div className="space-y-2">
                {analyse.projekt_risiken.map((r, i) => (
                  <div key={i} className={`p-3 rounded-lg border text-xs ${RISIKO_FARBE[r.risiko_level] || "bg-secondary/50 text-secondary-foreground border-border"}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      <span className="font-semibold">{r.projekt_name}</span>
                      <Badge className={`text-[9px] ml-auto border ${RISIKO_FARBE[r.risiko_level]}`}>{r.risiko_level}</Badge>
                    </div>
                    <p>{r.beschreibung}</p>
                    {r.empfehlung && <p className="mt-1 font-medium">→ {r.empfehlung}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Positive Highlights */}
          {analyse.positiv_highlights?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Positive Entwicklungen</p>
              <div className="space-y-1.5">
                {analyse.positiv_highlights.map((h, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                    <TrendingUp className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <span>{h.beschreibung}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Handlungsempfehlungen */}
          {analyse.handlungsempfehlungen?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Handlungsempfehlungen</p>
              <ol className="space-y-1.5">
                {analyse.handlungsempfehlungen.map((h, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-foreground">
                    <span className="w-5 h-5 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center shrink-0 mt-0.5 text-[10px]">
                      {i + 1}
                    </span>
                    {h}
                  </li>
                ))}
              </ol>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}