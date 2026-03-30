import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { SEVERITY_COLORS, SEVERITY_LABELS } from "@/components/checklistData";
import {
  Sparkles, GitCompare, CheckSquare, Square, MessageCircleQuestion,
  Calendar, Loader2, RefreshCw, ChevronDown, ChevronUp
} from "lucide-react";

function FindingsList({ findings, onToggle, onToggleAll, icon = "lv", title }) {
  const [collapsed, setCollapsed] = useState(false);
  if (!findings?.length) return null;
  const included = findings.filter(f => f.include_in_report).length;
  const allOn = included === findings.length;
  const Icon = icon === "conflict" ? GitCompare : Sparkles;
  const iconColor = icon === "conflict" ? "text-orange-500" : "text-amber-500";

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Icon className={`w-4 h-4 ${iconColor}`} />
            {title}
          </CardTitle>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" className="text-xs h-7 gap-1" onClick={() => onToggleAll(!allOn)}>
              {allOn ? <><CheckSquare className="w-3 h-3" />Alle ab</> : <><Square className="w-3 h-3" />Alle</>}
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setCollapsed(!collapsed)}>
              {collapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
            </Button>
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground">{included} von {findings.length} für Bericht ausgewählt</p>
      </CardHeader>
      {!collapsed && (
        <CardContent className="space-y-1.5 pt-0">
          {findings.map((f) => (
            <div
              key={f.id}
              className={`flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-all ${f.include_in_report ? "border-primary/20 bg-primary/5" : "border-border opacity-60"}`}
              onClick={() => onToggle(f.id)}
            >
              <Checkbox checked={f.include_in_report} className="mt-0.5 pointer-events-none shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-foreground leading-snug">{f.text}</p>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  <Badge variant="outline" className={`text-[9px] ${SEVERITY_COLORS[f.severity]}`}>
                    {SEVERITY_LABELS[f.severity]}
                  </Badge>
                  {f.category && <Badge variant="outline" className="text-[9px]">{f.category}</Badge>}
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      )}
    </Card>
  );
}

function BieterfragenCard({ fragen }) {
  const [collapsed, setCollapsed] = useState(false);
  if (!fragen?.length) return null;
  return (
    <Card className="border-blue-200">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <MessageCircleQuestion className="w-4 h-4 text-blue-500" />
            KI-Bieterfragen ({fragen.length})
          </CardTitle>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setCollapsed(!collapsed)}>
            {collapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground">Von der KI formulierte Fragen für Bieterkommunikation</p>
      </CardHeader>
      {!collapsed && (
        <CardContent className="space-y-2 pt-0">
          {fragen.map((f, i) => (
            <div key={i} className="flex items-start gap-2.5 p-2.5 rounded-lg bg-blue-50 border border-blue-100">
              <span className="text-blue-600 font-bold text-xs shrink-0 mt-0.5">{i + 1}.</span>
              <p className="text-xs text-blue-900 leading-snug">{f}</p>
            </div>
          ))}
        </CardContent>
      )}
    </Card>
  );
}

function FristenVorschlagCard({ fristen, onUebernehmen }) {
  const [collapsed, setCollapsed] = useState(false);
  if (!fristen?.length) return null;
  return (
    <Card className="border-green-200">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Calendar className="w-4 h-4 text-green-600" />
            Gefundene Fristen ({fristen.length})
          </CardTitle>
          <div className="flex items-center gap-1">
            {onUebernehmen && (
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1 border-green-300 text-green-700 hover:bg-green-50"
                onClick={onUebernehmen}>
                Alle übernehmen
              </Button>
            )}
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setCollapsed(!collapsed)}>
              {collapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
            </Button>
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground">Aus Unterlagen extrahierte Termine</p>
      </CardHeader>
      {!collapsed && (
        <CardContent className="space-y-1.5 pt-0">
          {fristen.map((f, i) => (
            <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-green-50 border border-green-100">
              <div>
                <p className="text-xs font-medium text-green-900">{f.titel}</p>
                {f.datum && <p className="text-[10px] text-green-700">{f.datum}</p>}
              </div>
              <Badge variant="outline" className="text-[9px] border-green-300 text-green-700">{f.typ?.replace(/_/g, " ")}</Badge>
            </div>
          ))}
        </CardContent>
      )}
    </Card>
  );
}

export default function LVAnalyseErgebnisse({ project, onUpdate, onFristenUebernehmen }) {
  const [analyzeLoading, setAnalyzeLoading] = useState(false);
  const [conflictLoading, setConflictLoading] = useState(false);
  const [error, setError] = useState(null);

  const hasLV = project?.lv_positions?.length > 0;
  const unterlagen = project?.projekt_unterlagen || [];
  const hasAnalysis = project?.lv_analysis_findings?.length > 0;
  const hasConflicts = project?.baulv_conflict_findings?.length > 0;
  const bieterfragen = project?.ki_bieterfragen || [];
  const kiFristen = project?.ki_gefundene_fristen || [];

  // ── Vollständige KI-Analyse (LV + Bieterfragen + Fristen) ──────────────────
  const handleAnalyzeFull = async () => {
    if (!hasLV) return;
    setAnalyzeLoading(true);
    setError(null);
    const positionList = project.lv_positions
      .filter(p => p.type === "position")
      .map(p => `OZ ${p.oz}: ${p.short_text} (${p.quantity} ${p.unit})`)
      .join("\n");
    const unterlagenHint = unterlagen.length > 0
      ? `Hochgeladene Unterlagen: ${unterlagen.map(u => u.name).join(", ")}`
      : "Keine Baubeschreibung hochgeladen.";
    try {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `Du bist ein erfahrener Tiefbauingenieur und VOB-Experte. Analysiere das folgende Leistungsverzeichnis umfassend.

LV-Positionen (${project.lv_positions.length} gesamt):
${positionList}

${unterlagenHint}

Führe folgende Analysen durch:

1. LV-BEFUNDE: Prüfe auf Vollständigkeit und Schlüssigkeit (fehlende Positionen, unvollständige Beschreibungen, fehlende Mengenangaben, VOB/C-Nebenleistungen, Entsorgung, nicht VOB-konforme Formulierungen).

2. AUSFÜHRUNGSFRISTEN: Extrahiere alle Fristen und Termine aus den LV-Positionen (z.B. Bauzeit, Ausführungszeitraum, Meilensteine). Falls keine Fristen im LV vorhanden sind, gib ein leeres Array zurück.

3. BIETERFRAGEN: Formuliere präzise Bieterfragen für alle Unklarheiten, Lücken, fehlenden Ausführungsfristen oder Risiken. Bieterfragen sollen kurz, klar und professionell formuliert sein.`,
        response_json_schema: {
          type: "object",
          properties: {
            lv_befunde: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  text: { type: "string" },
                  severity: { type: "string", enum: ["kritisch", "wichtig", "hinweis"] },
                  category: { type: "string" }
                }
              }
            },
            fristen: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  titel: { type: "string" },
                  datum: { type: "string" },
                  typ: { type: "string", enum: ["vertragsbeginn", "vertragsende", "abnahmefrist", "sonstiges"] }
                }
              }
            },
            bieterfragen: {
              type: "array",
              items: { type: "string" }
            },
            fristen_fehlen: { type: "boolean" }
          }
        }
      });

      const findings = (result.lv_befunde || []).map((f, i) => ({
        id: `lv_${Date.now()}_${i}`,
        text: f.text,
        severity: f.severity || "wichtig",
        category: f.category || "Vollständigkeit",
        include_in_report: true,
      }));

      // Wenn Fristen fehlen und keine Bieterfrage dazu vorhanden, ergänzen
      const bieterfragenResult = result.bieterfragen || [];
      if (result.fristen_fehlen && !bieterfragenResult.some(f => f.toLowerCase().includes("frist") || f.toLowerCase().includes("ausführungszeit"))) {
        bieterfragenResult.push("Bitte teilen Sie uns die geplante Ausführungszeit und die verbindlichen Fristen für Baubeginn und Fertigstellung mit.");
      }

      await onUpdate({
        lv_analysis_findings: findings,
        ki_bieterfragen: bieterfragenResult,
        ki_gefundene_fristen: result.fristen || [],
      });
    } catch (err) {
      setError("KI-Analyse fehlgeschlagen: " + err.message);
    }
    setAnalyzeLoading(false);
  };

  // ── Widerspruchsanalyse ────────────────────────────────────────────────────
  const handleAnalyzeConflicts = async () => {
    if (!hasLV || !unterlagen.length) return;
    setConflictLoading(true);
    setError(null);
    const positionList = project.lv_positions
      .filter(p => p.type === "position")
      .map(p => `OZ ${p.oz}: ${p.short_text} (${p.quantity} ${p.unit})`)
      .join("\n");
    try {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `Du bist ein erfahrener Tiefbauingenieur. Prüfe die beigefügten Unterlagen auf Widersprüche mit dem Leistungsverzeichnis.

LV-Positionen:
${positionList}

Unterlagen: ${unterlagen.map(u => u.name).join(", ")}

Identifiziere konkrete Widersprüche: abweichende Materialangaben, fehlende LV-Positionen, Mengenunstimmigkeiten, Normwiderspüche, Leistungen in Unterlagen ohne LV-Position.`,
        file_urls: unterlagen.map(u => u.url),
        response_json_schema: {
          type: "object",
          properties: {
            findings: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  text: { type: "string" },
                  severity: { type: "string", enum: ["kritisch", "wichtig", "hinweis"] },
                  category: { type: "string" }
                }
              }
            }
          }
        }
      });
      const findings = (result.findings || []).map((f, i) => ({
        id: `conflict_${Date.now()}_${i}`,
        text: f.text,
        severity: f.severity || "wichtig",
        category: f.category || "Widerspruch",
        include_in_report: true,
      }));
      await onUpdate({ baulv_conflict_findings: findings });
    } catch (err) {
      setError("Widerspruchsanalyse fehlgeschlagen: " + err.message);
    }
    setConflictLoading(false);
  };

  if (!hasLV) return null;

  return (
    <div className="space-y-4">
      {/* Analyse-Buttons */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant={hasAnalysis ? "outline" : "default"}
          size="sm"
          className="gap-2"
          onClick={handleAnalyzeFull}
          disabled={analyzeLoading}
        >
          {analyzeLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
          {analyzeLoading ? "KI analysiert..." : hasAnalysis ? "Erneut analysieren" : "KI-Vollanalyse starten"}
        </Button>
        {unterlagen.length > 0 && (
          <Button
            variant={hasConflicts ? "outline" : "outline"}
            size="sm"
            className="gap-2"
            onClick={handleAnalyzeConflicts}
            disabled={conflictLoading}
          >
            {conflictLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <GitCompare className="w-3.5 h-3.5" />}
            {conflictLoading ? "Prüfe Widersprüche..." : hasConflicts ? "Widersprüche neu prüfen" : "Widersprüche LV ↔ Unterlagen"}
          </Button>
        )}
      </div>

      {error && (
        <p className="text-xs text-destructive bg-destructive/5 border border-destructive/20 rounded p-2">{error}</p>
      )}

      {/* Ergebnisse */}
      {hasAnalysis && (
        <FindingsList
          findings={project.lv_analysis_findings}
          title={`LV-Befunde (${project.lv_analysis_findings.length})`}
          icon="lv"
          onToggle={(id) => onUpdate({ lv_analysis_findings: project.lv_analysis_findings.map(f => f.id === id ? { ...f, include_in_report: !f.include_in_report } : f) })}
          onToggleAll={(val) => onUpdate({ lv_analysis_findings: project.lv_analysis_findings.map(f => ({ ...f, include_in_report: val })) })}
        />
      )}
      {hasConflicts && (
        <FindingsList
          findings={project.baulv_conflict_findings}
          title={`Widersprüche Bau ↔ LV (${project.baulv_conflict_findings.length})`}
          icon="conflict"
          onToggle={(id) => onUpdate({ baulv_conflict_findings: project.baulv_conflict_findings.map(f => f.id === id ? { ...f, include_in_report: !f.include_in_report } : f) })}
          onToggleAll={(val) => onUpdate({ baulv_conflict_findings: project.baulv_conflict_findings.map(f => ({ ...f, include_in_report: val })) })}
        />
      )}
      {kiFristen.length > 0 && (
        <FristenVorschlagCard
          fristen={kiFristen}
          onUebernehmen={onFristenUebernehmen ? () => onFristenUebernehmen(kiFristen) : null}
        />
      )}
      {bieterfragen.length > 0 && (
        <BieterfragenCard fragen={bieterfragen} />
      )}
    </div>
  );
}