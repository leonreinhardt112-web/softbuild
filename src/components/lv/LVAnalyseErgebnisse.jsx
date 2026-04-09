import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Sparkles, GitCompare, MessageCircleQuestion,
  Calendar, Loader2, AlertTriangle, Info, AlertCircle,
  CheckSquare, Square, CalendarCheck, Copy, Check
} from "lucide-react";

const SEVERITY_CONFIG = {
  kritisch: { label: "Kritisch", color: "text-red-600", bg: "bg-red-50", border: "border-red-200", dot: "bg-red-500", icon: AlertCircle },
  wichtig: { label: "Wichtig", color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-200", dot: "bg-amber-500", icon: AlertTriangle },
  hinweis: { label: "Hinweis", color: "text-blue-600", bg: "bg-blue-50", border: "border-blue-200", dot: "bg-blue-400", icon: Info },
};

const CHUNK_SIZE = 150;

// Die 11 wertvollsten Bieterfragen nach Continu-ING Methodik als Orientierung
const CONTINU_ING_TEMPLATE = `Orientiere dich bei der Erstellung der Bieterfragen an folgenden bewährten Kategorien (Continu-ING Methodik) und prüfe für jede, ob sie für dieses konkrete LV relevant ist:
1. Ausführungsunterlagen gemäß VDI6026 und VOB/C – werden diese rechtzeitig und vollständig geliefert?
2. Wurden die Ausführungsunterlagen vor Erstellung des LV vom Auftraggeber freigegeben?
3. Vollständige Ausführungsunterlagen 21 Tage vor Ausführungsbeginn – ist diese Annahme korrekt?
4. Bei abweichenden Fabrikaten: Fortgeschriebene Ausführungsplanung gemäß HOAI/Vergabehandbuch?
5. LV-Vollständigkeit gemäß VOB/C DIN 18299 und den spezifischen ATVs inkl. Abrechnungseinheiten?
6. Sind alle Detailangaben vorhanden (Verlegearten, Höhen, Varianten, besondere Befestigungen)?
7. Keine Mischkalkulation – keine besonderen Leistungen in Einheitspreisen mischkalkuliert?
8. Bauleiter Jour-Fix: Wie oft und wie lange (Annahme max. 60 Min.)?
9. Bauzeitenplan 14 Tage nach Beauftragung, abgestimmt mit Architekt?
10. Parkmöglichkeiten und Baustelleneinrichtung gemäß VOB/C – keine abweichende Kalkulation nötig?
11. Kontinuierliche Ausführung möglich oder müssen konkrete Arbeitsunterbrechungen/Erschwernisse berücksichtigt werden?
Ergänze darüber hinaus projektspezifische Fragen, die sich direkt aus den LV-Positionen ergeben (Bodenverhältnisse, Entsorgung, Materialherkunft, Schnittstellenklärungen, Gütekriterien etc.).
Ziel: Bieterfragen sollen dem Bieter ermöglichen, Geld zu verdienen – durch Klarheit über Kalkulationsannahmen, Ausführungsbedingungen und rechtliche Absicherung. Nicht auf Krampf 20, wenn weniger ausreichen. Keine doppelten oder ähnlichen Fragen.`;

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

function parseBieterfrage(f) {
  if (typeof f === "object" && f !== null) return f;
  if (typeof f === "string" && f.includes("||BEGRUENDUNG||")) {
    const [frage, begruendung] = f.split("||BEGRUENDUNG||");
    return { frage: frage.trim(), begruendung: begruendung?.trim() };
  }
  return { frage: f, begruendung: null };
}

function BieterfragenList({ fragen }) {
  const [copiedIndex, setCopiedIndex] = useState(null);

  const handleCopy = (text, i) => {
    navigator.clipboard?.writeText(text);
    setCopiedIndex(i);
    setTimeout(() => setCopiedIndex(null), 1500);
  };

  if (!fragen?.length) return (
    <div className="text-center py-8 text-muted-foreground text-sm">Keine Bieterfragen generiert.</div>
  );
  return (
    <div className="space-y-3">
      {fragen.map((f, i) => {
        const { frage, begruendung } = parseBieterfrage(f);
        return (
          <div key={i} className="rounded-lg border border-violet-200 bg-violet-50 overflow-hidden">
            <div className="flex items-start gap-3 p-3">
              <span className="w-5 h-5 rounded-full bg-violet-200 text-violet-700 font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium leading-relaxed text-violet-900">{frage}</p>
                {begruendung && (
                  <div className="mt-2 flex items-start gap-1.5">
                    <Info className="w-3 h-3 text-violet-400 shrink-0 mt-0.5" />
                    <p className="text-[11px] text-violet-600 leading-relaxed italic">{begruendung}</p>
                  </div>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0 text-violet-400 hover:text-violet-700"
                onClick={() => handleCopy(frage, i)}
                title="Frage kopieren"
              >
                {copiedIndex === i ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
              </Button>
            </div>
          </div>
        );
      })}
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

function encodeBieterfragen(list) {
  return list.map(f => {
    if (typeof f === "string") return f;
    const begruendung = f.begruendung ? `||BEGRUENDUNG||${f.begruendung}` : "";
    return `${f.frage}${begruendung}`;
  });
}

export default function LVAnalyseErgebnisse({ project, onUpdate, onFristenUebernehmen }) {
  const [analyzeLoading, setAnalyzeLoading] = useState(false);
  const [conflictLoading, setConflictLoading] = useState(false);
  const [chunkProgress, setChunkProgress] = useState(null);
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
  const totalPositions = project?.lv_positions?.length || 0;
  const isLargeProject = totalPositions > 400;

  const handleAnalyzeFull = async () => {
    if (!hasLV) return;
    setAnalyzeLoading(true);
    setChunkProgress(null);
    setError(null);

    const allPositions = project.lv_positions.filter(p => p.type === "position");
    const unterlagenHint = unterlagen.length > 0
      ? `Hochgeladene Unterlagen: ${unterlagen.map(u => u.name).join(", ")}`
      : "Keine Baubeschreibung hochgeladen.";

    if (isLargeProject) {
      // Chunked analysis: LV-Befunde blockweise, Bieterfragen separat am Ende
      const chunks = [];
      for (let i = 0; i < allPositions.length; i += CHUNK_SIZE) {
        chunks.push(allPositions.slice(i, i + CHUNK_SIZE));
      }

      let allFindings = [];
      let allFristen = [];

      for (let ci = 0; ci < chunks.length; ci++) {
        setChunkProgress(`Analysiere Block ${ci + 1} von ${chunks.length}...`);
        const positionList = chunks[ci]
          .map(p => `OZ ${p.oz}: ${p.short_text} (${p.quantity} ${p.unit})`)
          .join("\n");

        const chunkResult = await base44.integrations.Core.InvokeLLM({
          prompt: `Du bist ein erfahrener Tiefbauingenieur und VOB-Experte. Analysiere diese LV-Positionen (Block ${ci + 1}/${chunks.length}) auf Vollständigkeit und Schlüssigkeit.

LV-Positionen:
${positionList}

${unterlagenHint}

Prüfe auf: fehlende Positionen, unvollständige Beschreibungen, fehlende Mengenangaben, VOB/C-Nebenleistungen, Entsorgung, nicht VOB-konforme Formulierungen, fehlende Gütekriterien/Verdichtungsgrade, unklare Ausführungsdetails.`,
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
              }
            }
          }
        });

        const chunkFindings = (chunkResult.lv_befunde || []).map((f, i) => ({
          id: `lv_${Date.now()}_c${ci}_${i}`, text: f.text,
          severity: f.severity || "wichtig", category: f.category || "Vollständigkeit", include_in_report: true,
        }));
        allFindings = [...allFindings, ...chunkFindings];
        if (chunkResult.fristen?.length > 0) {
          allFristen = [...allFristen, ...chunkResult.fristen];
        }
      }

      // Bieterfragen separat mit repräsentativer Stichprobe
      setChunkProgress("Generiere Bieterfragen...");
      const sampleStep = Math.max(1, Math.floor(allPositions.length / 250));
      const sampledPositions = allPositions.filter((_, i) => i % sampleStep === 0);
      const sampledList = sampledPositions.map(p => `OZ ${p.oz}: ${p.short_text}`).join("\n");

      const bfResult = await base44.integrations.Core.InvokeLLM({
        prompt: `Du bist ein erfahrener Tiefbauingenieur. Generiere die bis zu 20 WERTVOLLSTEN Bieterfragen für dieses Leistungsverzeichnis (${allPositions.length} Positionen gesamt).

Repräsentative LV-Positionen (Stichprobe):
${sampledList}

${unterlagenHint}

${CONTINU_ING_TEMPLATE}`,
        response_json_schema: {
          type: "object",
          properties: {
            bieterfragen: {
              type: "array",
              items: { type: "object", properties: { frage: { type: "string" }, begruendung: { type: "string" } } }
            }
          }
        }
      });

      const bieterfragenResult = encodeBieterfragen(bfResult.bieterfragen || []);
      await onUpdate({ lv_analysis_findings: allFindings, ki_bieterfragen: bieterfragenResult, ki_gefundene_fristen: allFristen });
      if (allFristen.length > 0 && onFristenUebernehmen) {
        await onFristenUebernehmen(allFristen);
      }
      setChunkProgress(null);
      setAnalyzeLoading(false);
      return;
    }

    // Kleines LV: alles in einem Aufruf
    const positionList = allPositions
      .map(p => `OZ ${p.oz}: ${p.short_text} (${p.quantity} ${p.unit})`)
      .join("\n");

    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `Du bist ein erfahrener Tiefbauingenieur und VOB-Experte. Analysiere das folgende Leistungsverzeichnis umfassend.

LV-Positionen (${allPositions.length} gesamt):
${positionList}

${unterlagenHint}

Führe folgende Analysen durch:

1. LV-BEFUNDE: Prüfe auf Vollständigkeit und Schlüssigkeit (fehlende Positionen, unvollständige Beschreibungen, VOB/C-Nebenleistungen, Entsorgung, Gütekriterien etc.).

2. AUSFÜHRUNGSFRISTEN: Extrahiere alle Fristen und Termine aus den LV-Positionen.

3. BIETERFRAGEN: Generiere die bis zu 20 WERTVOLLSTEN Bieterfragen.

${CONTINU_ING_TEMPLATE}`,
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
          bieterfragen: {
            type: "array",
            items: { type: "object", properties: { frage: { type: "string" }, begruendung: { type: "string" } } }
          },
          fristen_fehlen: { type: "boolean" }
        }
      }
    });

    const findings = (result.lv_befunde || []).map((f, i) => ({
      id: `lv_${Date.now()}_${i}`, text: f.text,
      severity: f.severity || "wichtig", category: f.category || "Vollständigkeit", include_in_report: true,
    }));
    const bieterfragenResult = encodeBieterfragen(result.bieterfragen || []);
    await onUpdate({ lv_analysis_findings: findings, ki_bieterfragen: bieterfragenResult, ki_gefundene_fristen: result.fristen || [] });
    if (result.fristen?.length > 0 && onFristenUebernehmen) {
      await onFristenUebernehmen(result.fristen);
    }
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
      <div className="flex flex-wrap gap-2 items-center">
        <Button
          variant={hasAnalysis ? "outline" : "default"}
          size="sm"
          className="gap-2"
          onClick={handleAnalyzeFull}
          disabled={analyzeLoading || conflictLoading}
        >
          {analyzeLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
          {analyzeLoading ? (chunkProgress || "KI analysiert...") : hasAnalysis ? "Neu analysieren" : "KI-Vollanalyse starten"}
        </Button>
        {isLargeProject && !analyzeLoading && (
          <span className="text-[10px] text-muted-foreground">
            {totalPositions} Positionen → Chunk-Modus (je {CHUNK_SIZE} Pos.)
          </span>
        )}
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
      {(hasAnalysis || hasConflicts || bieterfragen.length > 0) && (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="h-8 w-full grid grid-cols-3">
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
            <TabsContent value="fragen" className="mt-0">
              <BieterfragenList fragen={bieterfragen} />
            </TabsContent>
          </div>
        </Tabs>
      )}
    </div>
  );
}