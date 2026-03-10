import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, ChevronDown, ChevronRight, Calculator, CheckCircle2, Download, ChevronDown as ChevronDownIcon, Save } from "lucide-react";
import PositionKalkTable from "./PositionKalkTable";
import { generateKalkulationPDF } from "./KalkulationPdfExport";
import KalkulationPdfExportDialog from "./KalkulationPdfExportDialog";
import AngebotImportDialog from "./AngebotImportDialog";
import ZuschlaegeDialog from "./ZuschlaegeDialog";
import { generateEFB221, generateEFB223 } from "./EFBExport";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";

const LVKalkulationView = forwardRef(function LVKalkulationView({ project }, ref) {
  const queryClient = useQueryClient();
  const projectId = project.id;
  const [expandedOz, setExpandedOz] = useState(null);
  const [localPositions, setLocalPositions] = useState({});
  const [dirtyPositions, setDirtyPositions] = useState(new Set()); // unsaved keys
  const [savingOz, setSavingOz] = useState(null);
  const [expandedTitles, setExpandedTitles] = useState(new Set());
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [stammdaten, setStammdaten] = useState([]);
  useEffect(() => {
    base44.entities.Stammdatum.filter({ typ: "unternehmen" }).then(setStammdaten).catch(() => {});
  }, []);
  const saveTimers = useRef({});

  // Expose hasDirty for parent (tab-switch guard)
  useImperativeHandle(ref, () => ({
    hasDirtyChanges: () => dirtyPositions.size > 0,
    saveAll: saveAllDirty,
  }), [dirtyPositions, saveAllDirty]);

  const { data: kalkulationen = [], isLoading } = useQuery({
    queryKey: ["kalkulation", projectId],
    queryFn: () => base44.entities.Kalkulation.filter({ project_id: projectId }),
    enabled: !!projectId
  });

  const createKalkMutation = useMutation({
    mutationFn: (data) => base44.entities.Kalkulation.create(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["kalkulation", projectId] })
  });

  const updateKalkMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Kalkulation.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["kalkulation", projectId] })
  });

  const lvPositions = project?.lv_positions || [];

  // Auto-create kalkulation if none exists
  useEffect(() => {
    if (!isLoading && kalkulationen.length === 0 && lvPositions.length > 0) {
      createKalkMutation.mutate({
        project_id: projectId,
        version_name: "Hauptangebot",
        positions: lvPositions.map((p) => ({
          oz: p.oz, short_text: p.short_text, menge: parseFloat(p.quantity) || 0,
          einheit: p.unit, ep: 0, gp: 0, rows: []
        }))
      });
    }
  }, [isLoading, kalkulationen.length]);

  // Sync local state from DB — only on initial load, not after saves
  const initialSyncDone = useRef(false);
  useEffect(() => {
    const kalk = kalkulationen[0];
    const lv = project?.lv_positions || [];
    if (!kalk?.positions?.length || !lv.length || initialSyncDone.current) return;
    const items = lv.filter((p) => {
      if (p.type === "title") return false;
      if (p.type === "position") return true;
      const hasNoQty = !p.quantity || p.quantity === "0" || p.quantity === "";
      return !hasNoQty;
    });
    const map = {};
    // Index-based sync if lengths match (new save format), otherwise fall back to oz+short_text
    if (kalk.positions.length === items.length) {
      items.forEach((_, idx) => {
        map[String(idx)] = kalk.positions[idx]?.rows || [];
      });
    } else {
      items.forEach((item, idx) => {
        const saved = kalk.positions.find((p) => p.oz === item.oz && p.short_text === item.short_text);
        if (saved) map[String(idx)] = saved.rows || [];
      });
    }
    setLocalPositions(map);
    initialSyncDone.current = true;
  }, [kalkulationen, project]);

  const kalk = kalkulationen[0];
  const kalkRef = useRef(kalk);
  useEffect(() => {kalkRef.current = kalkulationen[0];}, [kalkulationen]);

  if (isLoading || createKalkMutation.isPending) {
    return <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;
  }

  if (!lvPositions.length) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-12 text-center">
          <Calculator className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm font-medium text-muted-foreground">Kein Leistungsverzeichnis vorhanden</p>
          <p className="text-xs text-muted-foreground/70 mt-1">Bitte zuerst eine GAEB-Datei unter Übersicht hochladen.</p>
        </CardContent>
      </Card>);

  }

  // Create unique key for each position (including group + index to handle duplicate OZ)
  const getPositionKey = (posIndex) => `${posIndex}`;

  const getRows = (posIndex) => localPositions[getPositionKey(posIndex)] || [];



  const calcEp = (rows, zuschlaege) => rows.reduce((sum, r) => {
    const kosten = Number(r.kosten_einheit || 0);
    const keys = {
      Lohn: { bgk: "lohn_bgk", agk: "lohn_agk", wg: "lohn_wg" },
      Material: { bgk: "material_bgk", agk: "material_agk", wg: "material_wg" },
      "Gerät": { bgk: "geraet_bgk", agk: "geraet_agk", wg: "geraet_wg" },
      NU: { bgk: "nu_bgk", agk: "nu_agk", wg: "nu_wg" },
      Sonstiges: { bgk: "sonstiges_bgk", agk: "sonstiges_agk", wg: "sonstiges_wg" }
    };
    const key = keys[r.kostentyp] || keys["Sonstiges"];
    const bgk = Number(zuschlaege?.[key.bgk] ?? 10) / 100;
    const agk = Number(zuschlaege?.[key.agk] ?? 5) / 100;
    const wg  = Number(zuschlaege?.[key.wg]  ?? 3) / 100;
    return sum + kosten * (1 + bgk + agk + wg);
  }, 0);

  const savePosition = async (posIndex, rows) => {
    const currentKalk = kalkRef.current;
    if (!currentKalk) return;
    const pos = positionItems[posIndex];
    if (!pos) return;
    const posKey = getPositionKey(posIndex);
    setSavingOz(posKey);
    // Rebuild full positions array from positionItems (index-based, no oz+short_text matching issues)
    const currentLocal = { ...localPositions, [posKey]: rows };
    const updatedPositions = positionItems.map((item, idx) => {
      const itemRows = currentLocal[String(idx)] || [];
      const ep = calcEp(itemRows, currentKalk.zuschlaege);
      const menge = parseFloat(item.quantity) || 0;
      return { oz: item.oz, short_text: item.short_text || "", menge, einheit: item.unit || "", ep, gp: ep * menge, rows: itemRows };
    });
    await updateKalkMutation.mutateAsync({ id: currentKalk.id, data: { positions: updatedPositions } });
    setSavingOz(null);
    setDirtyPositions((prev) => { const n = new Set(prev); n.delete(posKey); return n; });
  };

  const saveAllDirty = async () => {
    const keys = Array.from(dirtyPositions);
    for (const posKey of keys) {
      const posIndex = Number(posKey);
      const rows = localPositions[posKey] || [];
      await savePosition(posIndex, rows);
    }
  };

  const handleRowsChange = (posIndex, rows) => {
    const posKey = getPositionKey(posIndex);
    setLocalPositions((prev) => ({ ...prev, [posKey]: rows }));
    setDirtyPositions((prev) => new Set([...prev, posKey]));
    // Cancel any pending debounce timer (no auto-save anymore)
    if (saveTimers.current[posKey]) clearTimeout(saveTimers.current[posKey]);
  };

  const handleSavePosition = async (posIndex) => {
    const posKey = getPositionKey(posIndex);
    const rows = localPositions[posKey] || [];
    await savePosition(posIndex, rows);
  };

  // Determine if a position is a title:
  // - explicit type="title", OR
  // - no quantity = it's a title/subgroup regardless of OZ length
  const isTitle = (pos) => {
    if (pos.type === "title") return true;
    if (pos.type === "position") return false;
    const hasNoQty = !pos.quantity || pos.quantity === "0" || pos.quantity === "";
    return hasNoQty;
  };



  // Count dots in OZ to determine hierarchy level
  const getHierarchyLevel = (oz) => {
    const cleanOz = (oz || "").replace(/\s/g, "");
    const dotCount = (cleanOz.match(/\./g) || []).length;
    return dotCount; // 0 = haupttitel, 1 = untertitel, 2+ = position
  };

  // Group by haupttitel, untertitel, positions
  const grouped = [];
  let currentHauptTitel = null;
  let currentUnterTitel = null;
  let posItemIdx = 0;

  lvPositions.forEach((pos) => {
    const level = getHierarchyLevel(pos.oz);

    // Haupttitel (level 0)
    if (isTitle(pos) && level === 0) {
      currentHauptTitel = {
        title: pos,
        unterTitels: []
      };
      grouped.push(currentHauptTitel);
      currentUnterTitel = null;
    }
    // Untertitel (level 1)
    else if (isTitle(pos) && level === 1) {
      if (!currentHauptTitel) {
        currentHauptTitel = { title: null, unterTitels: [] };
        grouped.push(currentHauptTitel);
      }
      currentUnterTitel = { title: pos, positions: [] };
      currentHauptTitel.unterTitels.push(currentUnterTitel);
    }
    // Position (level 2+)
    else {
      if (!isTitle(pos)) {
        if (!currentUnterTitel) {
          if (!currentHauptTitel) {
            currentHauptTitel = { title: null, unterTitels: [] };
            grouped.push(currentHauptTitel);
          }
          currentUnterTitel = { title: null, positions: [] };
          currentHauptTitel.unterTitels.push(currentUnterTitel);
        }
        currentUnterTitel.positions.push({ pos, posIndex: posItemIdx });
        posItemIdx++;
      }
    }
  });

  // Generate hierarchical numbering
  grouped.forEach((ht, htIdx) => {
    const htNum = String(htIdx + 1).padStart(2, "0");
    ht.hierarchy = htNum;

    ht.unterTitels.forEach((ut, utIdx) => {
      const utNum = String(utIdx + 1).padStart(2, "0");
      ut.hierarchy = `${htNum}.${utNum}`;

      ut.positions.forEach((item, posIdx) => {
        const posNum = String(posIdx + 1).padStart(4, "0");
        item.hierarchy = `${htNum}.${utNum}.${posNum}`;
      });
    });
  });

  const positionItems = lvPositions.filter((p) => !isTitle(p));

  const totalAngebotsumme = positionItems.reduce((sum, pos, idx) => {
    const ep = calcEp(getRows(idx), kalk?.zuschlaege);
    return sum + ep * (parseFloat(pos.quantity) || 0);
  }, 0);

  const getTitleSum = (positions) => {
    const startIdx = positionItems.findIndex((p) => positions.includes(p));
    return positions.reduce((sum, pos, relIdx) => {
      const ep = calcEp(getRows(startIdx + relIdx), kalk?.zuschlaege);
      return sum + ep * (parseFloat(pos.quantity) || 0);
    }, 0);
  };

  const getHauptTitelSum = (unterTitels) => {
    return unterTitels.reduce((sum, ut) => {
      const utSum = getTitleSum(ut.positions.map((item) => item.pos));
      return sum + utSum;
    }, 0);
  };

  const toggleAllTitles = () => {
    if (expandedTitles.size === grouped.length) {
      setExpandedTitles(new Set());
    } else {
      const allTitles = new Set();
      grouped.forEach((_, i) => allTitles.add(i));
      setExpandedTitles(allTitles);
    }
  };

  const toggleAllUnterTitles = () => {
    const allUtKeys = new Set();
    grouped.forEach((ht, htIdx) => {
      ht.unterTitels.forEach((_, utIdx) => {
        allUtKeys.add(`${htIdx}-${utIdx}`);
      });
    });

    if (expandedTitles.size === allUtKeys.size) {
      setExpandedTitles(new Set());
    } else {
      setExpandedTitles(allUtKeys);
    }
  };

  // Merge localPositions (React-State) mit kalk.positions für den Export
  const buildKalkWithLocalPositions = () => {
    if (!kalk) return kalk;
    const updatedPositions = positionItems.map((pos, idx) => {
      const rows = getRows(idx);
      const existing = (kalk.positions || []).find(p => p.oz === pos.oz && p.short_text === pos.short_text);
      return {
        oz: pos.oz,
        short_text: pos.short_text || "",
        menge: parseFloat(pos.quantity) || 0,
        einheit: pos.unit || "",
        ep: existing?.ep || 0,
        gp: existing?.gp || 0,
        rows,
      };
    });
    return { ...kalk, positions: updatedPositions };
  };

  const handleExportWithOptions = async (options) => {
    await generateKalkulationPDF(project, kalk, options);
  };

  return (
    <div className="space-y-4">
      <KalkulationPdfExportDialog 
        isOpen={exportDialogOpen} 
        onClose={() => setExportDialogOpen(false)}
        onExport={handleExportWithOptions}
      />
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold">{positionItems.length} LV-Positionen · Hauptangebot</p>
          <p className="text-xs text-muted-foreground mt-0.5">Position anklicken zum Kalkulieren</p>
        </div>
        {kalk ?
        <div className="flex items-center gap-4">
            <ZuschlaegeDialog
              zuschlaege={kalk?.zuschlaege}
              onSave={(values) => updateKalkMutation.mutate({ id: kalk.id, data: { zuschlaege: values } })}
            />
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Kalkulierte Angebotssumme</p>
              <p className="text-lg font-bold text-primary">{totalAngebotsumme.toLocaleString("de-DE", { style: "currency", currency: "EUR" })}</p>
            </div>
            {kalk && (
              <AngebotImportDialog
                project={project}
                kalkulation={kalk}
                onPositionenApplied={(updatedPositions) => {
                  // Sofort localPositions aus den gespeicherten Positionen befüllen
                  const lv = project?.lv_positions || [];
                  const items = lv.filter((p) => !isTitle(p));
                  const map = {};
                  items.forEach((item, idx) => {
                    const saved = updatedPositions.find((p) => p.oz === item.oz && p.short_text === item.short_text);
                    if (saved) map[String(idx)] = saved.rows || [];
                  });
                  setLocalPositions(map);
                  // Query neu laden für DB-Konsistenz
                  initialSyncDone.current = true;
                  queryClient.invalidateQueries({ queryKey: ["kalkulation", projectId] });
                }}
              />
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button className="gap-2 whitespace-nowrap" size="sm">
                  <Download className="w-4 h-4" />
                  Exportieren
                  <ChevronDownIcon className="w-3 h-3 ml-1" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setExportDialogOpen(true)}>
                  Kalkulation (Angebot PDF)
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => generateEFB221(project, buildKalkWithLocalPositions(), stammdaten)}>
                  EFB 221 – Preisermittlung (Zuschlagskalkulation)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => generateEFB223(project, buildKalkWithLocalPositions())}>
                  EFB 223 – Aufgliederung der Einheitspreise
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div> :

        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        }
      </div>

      {/* Table header */}
      <div className="hidden md:grid grid-cols-[auto_auto_auto_1fr_auto_auto_auto] gap-2 px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground border-b border-border">
        <span className="w-4" />
        <span className="w-3.5" />
        <span className="w-24">Pos.</span>
        <span>Beschreibung</span>
        <span className="w-20 text-right">Menge / Einheit</span>
        <span className="w-24 text-right">EP (€)</span>
        <span className="w-24 text-right">GP (€)</span>
      </div>

      {/* Grouped by Haupttitel > Untertitel > Positions */}
      <div className="space-y-8">
        {grouped.map((ht, htIdx) => {
          const isHtExpanded = expandedTitles.has(htIdx);
          return (
            <div key={htIdx} className="space-y-4">
            {/* Haupttitel */}
            {ht.title &&
              <div
                className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-primary/5 to-transparent border-l-4 border-primary rounded-lg cursor-pointer hover:bg-gradient-to-r hover:from-primary/10 hover:to-transparent transition-all group"
                onClick={() => {
                  const newSet = new Set(expandedTitles);
                  if (newSet.has(htIdx)) {
                    newSet.delete(htIdx);
                  } else {
                    newSet.add(htIdx);
                  }
                  setExpandedTitles(newSet);
                }}>

                <div className="flex items-center gap-3">
                  {isHtExpanded ?
                  <ChevronDown className="w-5 h-5 text-primary shrink-0 transition-transform" /> :
                  <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary shrink-0 transition-all" />
                  }
                  <span className="text-sm font-mono font-bold text-foreground w-16">{ht.hierarchy}</span>
                  <span className="text-base font-bold text-foreground group-hover:text-primary transition-colors">{ht.title?.short_text || ""}</span>
                </div>
                {(() => {
                  const htSum = getHauptTitelSum(ht.unterTitels);
                  return (
                    <span className="text-base font-bold text-primary shrink-0">
                      {htSum.toLocaleString("de-DE", { style: "currency", currency: "EUR" })}
                    </span>);

                })()}
              </div>
              }

            {/* Untertitel + Positionen */}
            {isHtExpanded &&
              <div className="space-y-4 pl-0">
              {ht.unterTitels.map((ut, utIdx) => {
                  const utKey = `${htIdx}-${utIdx}`;
                  const isUtExpanded = expandedTitles.has(utKey);
                  const titleSum = getTitleSum(ut.positions.map((item) => item.pos));
                  return (
                    <div key={utIdx} className="space-y-2">
                    {/* Untertitel */}
                    {ut.title &&
                      <div
                        className="flex items-center justify-between px-3 py-2.5 bg-accent/5 border border-border/50 rounded-lg cursor-pointer hover:bg-accent/15 hover:border-primary/30 transition-all group"
                        onClick={() => {
                          const newSet = new Set(expandedTitles);
                          if (newSet.has(utKey)) {
                            newSet.delete(utKey);
                          } else {
                            newSet.add(utKey);
                          }
                          setExpandedTitles(newSet);
                        }}>

                        <div className="flex items-center gap-2.5">
                          {isUtExpanded ?
                          <ChevronDown className="w-4 h-4 text-primary shrink-0 transition-transform" /> :
                          <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary shrink-0 transition-all" />
                          }
                          <span className="text-xs font-mono font-bold text-foreground w-20">{ut.hierarchy}</span>
                          <span className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">{ut.title?.short_text || ""}</span>
                        </div>
                        <span className="text-sm font-semibold text-primary shrink-0">
                          {titleSum.toLocaleString("de-DE", { style: "currency", currency: "EUR" })}
                        </span>
                      </div>
                      }

                    {/* Positions */}
                    {isUtExpanded && ut.positions.map(({ pos, posIndex, hierarchy }, pi) => {
                        const posKey = getPositionKey(posIndex);
                        const rows = getRows(posIndex);
                        const ep = rows.reduce((sum, r) => sum + Number(r.kosten_einheit || 0) + Number(r.zuschlag || 0), 0);
                        const gp = ep * (parseFloat(pos.quantity) || 0);
                        const isExpanded = expandedOz === posKey;
                        const isCalculated = rows.length > 0;
                        return (
                          <Card
                            key={`${posIndex}-${pi}-${pos.oz}`}
                            className={`transition-all ${isExpanded ? "border-primary/40 shadow-md" : "hover:border-border/80"}`}>

                          <div
                              className="flex items-center gap-2 px-4 py-2.5 cursor-pointer select-none"
                              onClick={() => setExpandedOz(isExpanded ? null : posKey)}>

                            {/* Expand icon */}
                            {isExpanded ?
                              <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" /> :
                              <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                              }
                            {/* Status dot */}
                            {isCalculated ?
                              <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" /> :
                              <div className="w-3.5 h-3.5 rounded-full border-2 border-muted-foreground/30 shrink-0" />
                              }
                            {/* POS. */}
                            <span className="text-xs font-mono font-bold text-foreground w-24 shrink-0">{hierarchy}</span>
                            {/* BESCHREIBUNG */}
                            <div className="flex-1 min-w-0 text-sm text-foreground truncate">{(pos.short_text || "").split("\n")[0] || <span className="text-muted-foreground/50 italic">–</span>}</div>
                            {/* MENGE + EINHEIT */}
                            <span className="text-xs text-muted-foreground w-20 text-right shrink-0 hidden sm:block">
                              {pos.quantity && <>{parseFloat(pos.quantity).toLocaleString("de-DE", { minimumFractionDigits: 3 })} {pos.unit}</>}
                            </span>
                            {/* EP */}
                            <span className={`text-xs w-24 text-right shrink-0 hidden md:block ${isCalculated ? "font-semibold text-primary" : "text-muted-foreground/40"}`}>
                              {isCalculated ? `${rows.reduce((s, r) => {
                                  const kosten = Number(r.kosten_einheit || 0);
                                  const keys = {
                                    Lohn: { bgk: "lohn_bgk", agk: "lohn_agk", wg: "lohn_wg" },
                                    Material: { bgk: "material_bgk", agk: "material_agk", wg: "material_wg" },
                                    "Gerät": { bgk: "geraet_bgk", agk: "geraet_agk", wg: "geraet_wg" },
                                    NU: { bgk: "nu_bgk", agk: "nu_agk", wg: "nu_wg" },
                                    Sonstiges: { bgk: "sonstiges_bgk", agk: "sonstiges_agk", wg: "sonstiges_wg" }
                                  };
                                  const key = keys[r.kostentyp] || keys["Sonstiges"];
                                  const bgk = Number(kalk?.zuschlaege?.[key.bgk] ?? 10) / 100;
                                  const agk = Number(kalk?.zuschlaege?.[key.agk] ?? 5) / 100;
                                  const wg = Number(kalk?.zuschlaege?.[key.wg] ?? 3) / 100;
                                  const zuschlag = kosten * (bgk + agk + wg);
                                  return s + kosten + zuschlag;
                                }, 0).toFixed(2)} €` : "–"}
                            </span>
                            {/* GP */}
                            <span className={`text-xs w-24 text-right shrink-0 hidden md:block ${gp > 0 ? "font-semibold text-foreground" : "text-muted-foreground/40"}`}>
                              {(() => {
                                  const epWithMarkup = rows.reduce((s, r) => {
                                    const kosten = Number(r.kosten_einheit || 0);
                                    const keys = {
                                      Lohn: { bgk: "lohn_bgk", agk: "lohn_agk", wg: "lohn_wg" },
                                      Material: { bgk: "material_bgk", agk: "material_agk", wg: "material_wg" },
                                      "Gerät": { bgk: "geraet_bgk", agk: "geraet_agk", wg: "geraet_wg" },
                                      NU: { bgk: "nu_bgk", agk: "nu_agk", wg: "nu_wg" },
                                      Sonstiges: { bgk: "sonstiges_bgk", agk: "sonstiges_agk", wg: "sonstiges_wg" }
                                    };
                                    const key = keys[r.kostentyp] || keys["Sonstiges"];
                                    const bgk = Number(kalk?.zuschlaege?.[key.bgk] ?? 10) / 100;
                                    const agk = Number(kalk?.zuschlaege?.[key.agk] ?? 5) / 100;
                                    const wg = Number(kalk?.zuschlaege?.[key.wg] ?? 3) / 100;
                                    const zuschlag = kosten * (bgk + agk + wg);
                                    return s + kosten + zuschlag;
                                  }, 0);
                                  const gpWithMarkup = epWithMarkup * (parseFloat(pos.quantity) || 0);
                                  return gpWithMarkup > 0 ? gpWithMarkup.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €" : "–";
                                })()}
                            </span>
                            {savingOz === posKey && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground shrink-0" />}
                            {dirtyPositions.has(posKey) && savingOz !== posKey && (
                              <span className="text-[10px] text-amber-500 font-medium shrink-0">ungespeichert</span>
                            )}
                          </div>

                          {isExpanded &&
                            <CardContent className="pt-0 pb-4 border-t border-border/50">
                              {pos.long_text &&
                              <div className="mt-3 mb-4 bg-muted/30 rounded-lg p-3 border-l-2 border-primary/30">
                                  <p className="text-xs font-medium text-foreground mb-1">Leistungsbeschreibung</p>
                                  <p className="text-xs text-muted-foreground leading-relaxed">
                                    {(() => {
                                      let text = pos.long_text.trim();
                                      const shortStart = (pos.short_text || "").split("\n")[0].trim();
                                      if (shortStart && text.startsWith(shortStart)) text = text.substring(shortStart.length).trim();
                                      if (shortStart && text.endsWith(shortStart)) text = text.substring(0, text.length - shortStart.length).trim();
                                      return text;
                                    })()}
                                  </p>
                                </div>
                              }
                              <div className="mt-3">
                                <PositionKalkTable
                                  rows={rows}
                                  zuschlaege={kalk?.zuschlaege || {}}
                                  onRowsChange={(newRows) => handleRowsChange(posIndex, newRows)} />
                              </div>
                              <div className="mt-3 flex justify-end">
                                <Button
                                  size="sm"
                                  className="gap-1.5"
                                  disabled={savingOz === posKey || !dirtyPositions.has(posKey)}
                                  onClick={() => handleSavePosition(posIndex)}
                                >
                                  {savingOz === posKey
                                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    : <Save className="w-3.5 h-3.5" />}
                                  Speichern
                                </Button>
                              </div>
                            </CardContent>
                            }
                        </Card>);

                      })}
                  </div>);

                })}
            </div>
              }
          </div>);

        })}
      </div>
    </div>);

});

export default LVKalkulationView;