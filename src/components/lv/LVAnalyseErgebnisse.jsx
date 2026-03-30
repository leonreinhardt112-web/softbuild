import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Sparkles, GitCompare, MessageCircleQuestion,
  Calendar, Loader2, AlertTriangle, Info, AlertCircle,
  CheckSquare, Square, CalendarCheck, ChevronRight
} from "lucide-react";

const SEVERITY_CONFIG = {
  kritisch: { label: "Kritisch", color: "text-red-600", bg: "bg-red-50", border: "border-red-200", dot: "bg-red-500", icon: AlertCircle },
  wichtig: { label: "Wichtig", color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-200", dot: "bg-amber-500", icon: AlertTriangle },
  hinweis: { label: "Hinweis", color: "text-blue-600", bg: "bg-blue-50", border: "border-blue-200", dot: "bg-blue-400", icon: Info },
};

function SeverityDot({ severity }) {
  const cfg = SEVERITY_CONFIG[severity] || SEVERITY_CONFIG.hinweis;
  return <span className={`inline-block w-2 h-2 rounded-full shrink-0 mt-1.5 ${cfg.dot}`} />;
}

function FindingItem({ finding, onToggle }) {
  const cfg = SEVERITY_CONFIG[finding.severity] || SEVERITY_CONFIG.hinweis;
  return (
    <div
      className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all hover:shadow-sm ${
        finding.include_in_report
          ? `${cfg.bg} ${cfg.border}`
          : "bg-muted/30 border-border opacity-50"
      }`}
      onClick={() => onToggle(finding.id)}
    >
      <Checkbox checked={finding.include_in_report} className="mt-0.5 pointer-events-none shrink-0" />
      <SeverityDot severity={finding.severity} />
      <div className="flex-1 min-w-0">
        <p className="text-xs leading-relaxed text-foreground">{finding.text}</p>
        {finding.category && (
          <span className={`inline-block mt-1.5 text-[10px] font-medium px-1.5 py-0.5 rounded ${cfg.bg} ${cfg.color} border ${cfg.border}`}>
            {finding.category}
          </span>
        )}
      </div>
      <Badge variant="outline" className={`text-[9px] shrink-0 ${cfg.color} ${cfg.border}`}>
        {cfg.label}
      </Badge>
    </div>
  );
}

function FindingsGroup({ findings, onToggle, onToggleAll }) {
  if (!findings?.length) return (
    <div className="text-center py-8 text-muted-foreground text-sm">Keine Befunde vorhanden.</div>
  );

  const byCategory = findings.reduce((acc, f) => {
    const cat = f.category || "Allgemein";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(f);
    return acc;
  }, {});

  const included = findings.filter(f => f.include_in_report).length;
  const allOn = included === findings.length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{included} von {findings.length} für Bericht ausgewählt</span>
        <Button variant="ghost" size="sm" className="text-xs h-7 gap-1.5" onClick={() => onToggleAll(!allOn)}>
          {allOn ? <><CheckSquare className="w-3.5 h-3.5" />Alle abwählen</> : <><Square className="w-3.5 h-3.5" />Alle auswählen</>}
        </Button>
      </div>
      {Object.entries(byCategory).map(([cat, items]) => (
        <div key={cat}>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 px-0.5">{cat}</p>
          <div className="space-y-1.5">
            {items.map(f => (
              <FindingItem key={f.id} finding={f} onToggle={onToggle} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function BieterfragenList({ fragen }) {
  if (!fragen?.length) return (
    <div className="text-center py-8 text-muted-foreground text-sm">Keine Bieterfragen generiert.</div>
  );
  return (
    <div className="space-y-2">
      {fragen.map((f, i) => (
        <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-violet-50 border border-violet-100">
          <span className="w-5 h-5 rounded-full bg-violet-100 text-violet-700 font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
          <p className="text-xs leading-relaxed text-violet-900">{f}</p>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0 text-violet-400 hover:text-violet-700"
            onClick={() => navigator.clipboard?.writeText(f)}
            title="Kopieren"
          >
            <ChevronRight className="w-3 h-3" />
          </Button>
        </div>
      ))}
    </div>
  );
}

function FristenList({ fristen, onUebernehmen }) {
  if (!fristen?.length) return (
    <div className="text-center py-8 text-muted-foreground text-sm">Keine Fristen erkannt.</div>
  );
  return (
    <div className="space-y-3">
      {onUebernehmen && (
        <div className="flex justify-end">
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5 border-green-300 text-green-700 hover:bg-green-50" onClick={onUebernehmen}>
            <CalendarCheck className="w-3.5 h-3.5" />Alle in Fristen übernehmen
          </Button>
        </div>
      )}
      <div className="space-y-1.5">
        {fristen.map((f, i) => (
          <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-green-50 border border-green-100">
            <div className="flex items-center gap-2.5">
              <Calendar className="w-3.5 h-3.5 text-green-600 shrink-0" />
              <div>
                <p className="text-xs font-medium text-green-900">{f.titel}</p>
                {f.datum && <p className="text-[10px] text-green-700 mt-0.5">{f.datum}</p>}
              </div>
            </div>
            <Badge variant="outline" className="text-[9px] border-green-200 text-green-700 shrink-0">
              {f.typ?.replace(/_/g, " ")}
            </Badge>
          </div>
        ))}
      </div>
    </div>
  );
}

function TabBadge({ count }) {
  if (!count) return null;
  return (
    <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 text-[9px] font-bold rounded-full bg-primary/10 text-primary">
      {count > 99 ? "99+" : count}
    </span>
  );
}

export default function LVAnalyseErgebnisse({ project, onUpdate, onFristenUebernehmen }) {
  const [analyzeLoading, setAnalyzeLoading] = useState(false);
  const [conflictLoading, setConflictLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("lv");

  const hasLV = project?.lv_positions?.length > 0;
  const unterlagen = project?.projekt_unterlagen || [];
  const lvFindings = project?.lv_analysis_findings || [];
  const conflictFindings = project?.baulv_conflict_findings || [];
  const bieterfragen = project?.ki_bieterfragen || [];
  const kiFristen = project?.ki_gefundene_fristen || [];

  const hasAnalysis = lvFindings.length > 0;
  const hasConflicts = conflictFindings.length > 0;

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
            items: { type: "object", properties: { text: { type: "string" }, severity: { type: "string", enum: ["kritisch", "wichtig", "hinweis"] }, category: { type: "string" } } }
          },
          fristen: {
            type: "array",
            items: { type: "object", properties: { titel: { type: "string" }, datum: { type: "string" }, typ: { type: "string", enum: ["vertragsbeginn", "vertragsende", "abnahmefrist", "sonstiges"] } } }
          },
          bieterfragen: { type: "array", items: { type: "string" } },
          fristen_fehlen: { type: "boolean" }
        }
      }
    });
    const findings = (result.lv_befunde || []).map((f, i) => ({
      id: `lv_${Date.now()}_${i}`, text: f.text,
      severity: f.severity || "wichtig", category: f.category || "Vollständigkeit", include_in_report: true,
    }));
    const bieterfragenResult = result.bieterfragen || [];
    if (result.fristen_fehlen && !bieterfragenResult.some(f => f.toLowerCase().includes("frist"))) {
      bieterfragenResult.push("Bitte teilen Sie uns die geplante Ausführungszeit und die verbindlichen Fristen für Baubeginn und Fertigstellung mit.");
    }
    await onUpdate({ lv_analysis_findings: findings, ki_bieterfragen: bieterfragenResult, ki_gefundene_fristen: result.fristen || [] });
    setAnalyzeLoading(false);
  };

  const handleAnalyzeConflicts = async () => {
    if (!hasLV || !unterlagen.length) return;
    setConflictLoading(true);
    setError(null);
    const positionList = project.lv_positions
      .filter(p => p.type === "position")
      .map(p => `OZ ${p.oz}: ${p.short_text} (${p.quantity} ${p.unit})`)
      .join("\n");
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
            items: { type: "object", properties: { text: { type: "string" }, severity: { type: "string", enum: ["kritisch", "wichtig", "hinweis"] }, category: { type: "string" } } }
          }
        }
      }
    });
    const findings = (result.findings || []).map((f, i) => ({
      id: `conflict_${Date.now()}_${i}`, text: f.text,
      severity: f.severity || "wichtig", category: f.category || "Widerspruch", include_in_report: true,
    }));
    await onUpdate({ baulv_conflict_findings: findings });
    setConflictLoading(false);
  };

  if (!hasLV) return null;

  const kritischLV = lvFindings.filter(f => f.severity === "kritisch").length;
  const kritischConflict = conflictFindings.filter(f => f.severity === "kritisch").length;

  return (
    <div className="space-y-3">
      {/* Action bar */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant={hasAnalysis ? "outline" : "default"}
          size="sm"
          className="gap-2"
          onClick={handleAnalyzeFull}
          disabled={analyzeLoading || conflictLoading}
        >
          {analyzeLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
          {analyzeLoading ? "KI analysiert..." : hasAnalysis ? "Neu analysieren" : "KI-Vollanalyse starten"}
        </Button>
        {unterlagen.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={handleAnalyzeConflicts}
            disabled={conflictLoading || analyzeLoading}
          >
            {conflictLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <GitCompare className="w-3.5 h-3.5" />}
            {conflictLoading ? "Prüfe Widersprüche..." : hasConflicts ? "Widersprüche neu prüfen" : "LV ↔ Unterlagen prüfen"}
          </Button>
        )}
      </div>

      {error && (
        <p className="text-xs text-destructive bg-destructive/5 border border-destructive/20 rounded-lg p-2.5">{error}</p>
      )}

      {/* Tabs */}
      {(hasAnalysis || hasConflicts || bieterfragen.length > 0 || kiFristen.length > 0) && (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="h-8 w-full grid grid-cols-4">
            <TabsTrigger value="lv" className="text-xs gap-1">
              <Sparkles className="w-3 h-3" />
              LV-Befunde
              {kritischLV > 0 && <span className="w-4 h-4 rounded-full bg-red-100 text-red-600 text-[9px] font-bold flex items-center justify-center">{kritischLV}</span>}
              {lvFindings.length > 0 && kritischLV === 0 && <TabBadge count={lvFindings.length} />}
            </TabsTrigger>
            <TabsTrigger value="conflicts" className="text-xs gap-1">
              <GitCompare className="w-3 h-3" />
              Widersprüche
              {kritischConflict > 0 && <span className="w-4 h-4 rounded-full bg-red-100 text-red-600 text-[9px] font-bold flex items-center justify-center">{kritischConflict}</span>}
              {conflictFindings.length > 0 && kritischConflict === 0 && <TabBadge count={conflictFindings.length} />}
            </TabsTrigger>
            <TabsTrigger value="fristen" className="text-xs gap-1">
              <Calendar className="w-3 h-3" />
              Fristen
              <TabBadge count={kiFristen.length} />
            </TabsTrigger>
            <TabsTrigger value="fragen" className="text-xs gap-1">
              <MessageCircleQuestion className="w-3 h-3" />
              Bieterfragen
              <TabBadge count={bieterfragen.length} />
            </TabsTrigger>
          </TabsList>

          <div className="mt-3">
            <TabsContent value="lv" className="mt-0">
              <FindingsGroup
                findings={lvFindings}
                onToggle={(id) => onUpdate({ lv_analysis_findings: lvFindings.map(f => f.id === id ? { ...f, include_in_report: !f.include_in_report } : f) })}
                onToggleAll={(val) => onUpdate({ lv_analysis_findings: lvFindings.map(f => ({ ...f, include_in_report: val })) })}
              />
            </TabsContent>
            <TabsContent value="conflicts" className="mt-0">
              <FindingsGroup
                findings={conflictFindings}
                onToggle={(id) => onUpdate({ baulv_conflict_findings: conflictFindings.map(f => f.id === id ? { ...f, include_in_report: !f.include_in_report } : f) })}
                onToggleAll={(val) => onUpdate({ baulv_conflict_findings: conflictFindings.map(f => ({ ...f, include_in_report: val })) })}
              />
            </TabsContent>
            <TabsContent value="fristen" className="mt-0">
              <FristenList
                fristen={kiFristen}
                onUebernehmen={onFristenUebernehmen ? () => onFristenUebernehmen(kiFristen) : null}
              />
            </TabsContent>
            <TabsContent value="fragen" className="mt-0">
              <BieterfragenList fragen={bieterfragen} />
            </TabsContent>
          </div>
        </Tabs>
      )}
    </div>
  );
}