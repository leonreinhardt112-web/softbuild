import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, ChevronDown, ChevronRight, Calculator, CheckCircle2 } from "lucide-react";
import PositionKalkTable from "./PositionKalkTable";

export default function LVKalkulationView({ project }) {
  const queryClient = useQueryClient();
  const projectId = project.id;
  const [expandedOz, setExpandedOz] = useState(null);
  const [localPositions, setLocalPositions] = useState({});
  const [savingOz, setSavingOz] = useState(null);
  const saveTimers = useRef({});

  const { data: kalkulationen = [], isLoading } = useQuery({
    queryKey: ["kalkulation", projectId],
    queryFn: () => base44.entities.Kalkulation.filter({ project_id: projectId }),
    enabled: !!projectId,
  });

  const createKalkMutation = useMutation({
    mutationFn: (data) => base44.entities.Kalkulation.create(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["kalkulation", projectId] }),
  });

  const updateKalkMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Kalkulation.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["kalkulation", projectId] }),
  });

  const lvPositions = project?.lv_positions || [];

  // Auto-create kalkulation if none exists
  useEffect(() => {
    if (!isLoading && kalkulationen.length === 0 && lvPositions.length > 0) {
      createKalkMutation.mutate({
        project_id: projectId,
        version_name: "Hauptangebot",
        positions: lvPositions.map(p => ({
          oz: p.oz, short_text: p.short_text, menge: parseFloat(p.quantity) || 0,
          einheit: p.unit, ep: 0, gp: 0, rows: []
        })),
      });
    }
  }, [isLoading, kalkulationen.length]);

  // Sync local state from DB — only on initial load, not after saves
  const initialSyncDone = useRef(false);
  useEffect(() => {
    const kalk = kalkulationen[0];
    if (kalk?.positions && !initialSyncDone.current) {
      const lv = project?.lv_positions || [];
      const items = lv.filter(p => p.type !== "title");
      const map = {};
      items.forEach((item, idx) => {
        const saved = kalk.positions.find(p => p.oz === item.oz && p.short_text === item.short_text);
        if (saved) map[String(idx)] = saved.rows || [];
      });
      setLocalPositions(map);
      initialSyncDone.current = true;
    }
  }, [kalkulationen]);

  const kalk = kalkulationen[0];
  const kalkRef = useRef(kalk);
  useEffect(() => { kalkRef.current = kalkulationen[0]; }, [kalkulationen]);

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
      </Card>
    );
  }

  const getPositionKey = (posIndex) => `${posIndex}`;
  const getRows = (posIndex) => localPositions[getPositionKey(posIndex)] || [];

  const getDisplayText = (pos) => {
    if (pos.short_text) return pos.short_text;
    if (!pos.long_text) return "";
    const lt = pos.long_text.trim();
    const match = lt.match(/^(.{5,80}?)\s+(?=(?:Die|Der|Das|Den|Dem|Zur|Zum|Zu\s|Bei|Nach|Vor|Über|Unter|Durch|Mit|Von|Für\s|An\s|In\s|Im\s|Am\s|Ab\s|Aus\s|Es\s|Eine|Ein\s|Alle|Je\s|Sofern|Falls|Hierbei|Dabei|Hierzu)\s)/);
    if (match) return match[1];
    return lt.slice(0, 60);
  };

  const handleRowsChange = (posIndex, rows) => {
    const posKey = getPositionKey(posIndex);
    setLocalPositions(prev => ({ ...prev, [posKey]: rows }));

    if (saveTimers.current[posKey]) clearTimeout(saveTimers.current[posKey]);
    setSavingOz(posKey);
    saveTimers.current[posKey] = setTimeout(async () => {
      const currentKalk = kalkRef.current;
      if (!currentKalk) return;
      const pos = positionItems[posIndex];
      if (!pos) return;
      const ep = rows.reduce((sum, r) => sum + Number(r.kosten_einheit || 0) + Number(r.zuschlag || 0), 0);
      const menge = parseFloat(pos.quantity) || 0;
      const existingPositions = currentKalk.positions || [];
      const exists = existingPositions.find(p => p.oz === pos.oz && p.short_text === pos.short_text);
      let updatedPositions;
      if (exists) {
        updatedPositions = existingPositions.map(p => p.oz === pos.oz && p.short_text === pos.short_text ? { ...p, rows, ep, gp: ep * menge } : p);
      } else {
        updatedPositions = [...existingPositions, { oz: pos.oz, short_text: pos.short_text || "", menge, einheit: pos.unit || "", ep, gp: ep * menge, rows }];
      }
      await updateKalkMutation.mutateAsync({ id: currentKalk.id, data: { positions: updatedPositions } });
      setSavingOz(null);
    }, 700);
  };

  const getHierarchyLevel = (oz) => {
    const cleanOz = (oz || "").replace(/\s/g, "");
    const dotCount = (cleanOz.match(/\./g) || []).length;
    return dotCount;
  };

  const isTitle = (pos) => pos.type === "title";

  // Build grouped structure: Haupttitel -> Untertitel -> Positionen
  // A Untertitel ist ein Titel mit Positionen unter sich
  // Ein reiner Titel hat keine Positionen unter sich
  const grouped = [];
  let i = 0;

  while (i < lvPositions.length) {
    const pos = lvPositions[i];
    
    if (isTitle(pos) && getHierarchyLevel(pos.oz) === 0) {
      // Haupttitel
      const hauptTitel = { title: pos, unterTitels: [] };
      let j = i + 1;

      // Sammle alles unter diesem Haupttitel
      while (j < lvPositions.length && (!isTitle(lvPositions[j]) || getHierarchyLevel(lvPositions[j].oz) === 1)) {
        if (isTitle(lvPositions[j]) && getHierarchyLevel(lvPositions[j].oz) === 1) {
          // Untertitel
          const unterTitelTitle = lvPositions[j];
          const unterTitel = { title: unterTitelTitle, positions: [] };
          let k = j + 1;
          while (k < lvPositions.length && !isTitle(lvPositions[k])) {
            unterTitel.positions.push(lvPositions[k]);
            k++;
          }
          hauptTitel.unterTitels.push(unterTitel);
          j = k;
        } else if (!isTitle(lvPositions[j])) {
          // Position direkt unter Haupttitel (kein Untertitel-Dach)
          if (hauptTitel.unterTitels.length === 0 || hauptTitel.unterTitels[hauptTitel.unterTitels.length - 1].title !== null) {
            hauptTitel.unterTitels.push({ title: null, positions: [] });
          }
          hauptTitel.unterTitels[hauptTitel.unterTitels.length - 1].positions.push(lvPositions[j]);
          j++;
        } else {
          j++;
        }
      }

      grouped.push(hauptTitel);
      i = j;
    } else {
      i++;
    }
  }

  // Konvertiere zu { pos, posIndex } und generiere Hierarchie
  let posItemIdx = 0;
  grouped.forEach((ht, htIdx) => {
    const htNum = String(htIdx + 1).padStart(2, "0");
    ht.hierarchy = htNum;
    
    ht.unterTitels.forEach((ut, utIdx) => {
      const utNum = String(utIdx + 1).padStart(2, "0");
      ut.hierarchy = `${htNum}.${utNum}`;
      
      ut.positions = ut.positions.map((pos, posIdx) => {
        const posNum = String(posIdx + 1).padStart(4, "0");
        return {
          pos,
          posIndex: posItemIdx++,
          hierarchy: `${htNum}.${utNum}.${posNum}`
        };
      });
    });
  });

  const positionItems = lvPositions.filter(p => !isTitle(p));

  const totalAngebotsumme = positionItems.reduce((sum, pos, idx) => {
    const rows = getRows(idx);
    const ep = rows.reduce((s, r) => s + Number(r.kosten_einheit || 0) + Number(r.zuschlag || 0), 0);
    return sum + ep * (parseFloat(pos.quantity) || 0);
  }, 0);

  const getTitleSum = (positions) => {
    return positions.reduce((sum, pos) => {
      const idx = positionItems.findIndex(p => p === pos);
      if (idx >= 0) {
        const rows = getRows(idx);
        const ep = rows.reduce((s, r) => s + Number(r.kosten_einheit || 0) + Number(r.zuschlag || 0), 0);
        return sum + ep * (parseFloat(pos.quantity) || 0);
      }
      return sum;
    }, 0);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold">{positionItems.length} LV-Positionen · Hauptangebot</p>
          <p className="text-xs text-muted-foreground mt-0.5">Position anklicken zum Kalkulieren</p>
        </div>
        {totalAngebotsumme > 0 && (
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Kalkulierte Angebotssumme</p>
            <p className="text-lg font-bold text-primary">{totalAngebotsumme.toLocaleString("de-DE", { style: "currency", currency: "EUR" })}</p>
          </div>
        )}
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
        {grouped.map((ht, htIdx) => (
          <div key={htIdx} className="space-y-4">
            {/* Haupttitel */}
            {ht.title && (
              <div className="flex items-center gap-2 px-1 py-2 border-b-2 border-foreground">
                <span className="text-sm font-mono font-bold text-foreground w-16">{ht.hierarchy}</span>
                <span className="text-base font-bold text-foreground">{ht.title.short_text}</span>
              </div>
            )}

            {/* Untertitel + Positionen */}
            <div className="space-y-4 pl-0">
              {ht.unterTitels.map((ut, utIdx) => {
                const titleSum = getTitleSum(ut.positions.map(item => item.pos));
                return (
                  <div key={utIdx} className="space-y-2">
                    {/* Untertitel */}
                    {ut.title && (
                      <div className="flex items-center justify-between px-1 py-1 border-b border-border">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-bold text-foreground w-20">{ut.hierarchy}</span>
                          <span className="text-sm font-semibold text-foreground">{ut.title.short_text}</span>
                        </div>
                        {titleSum > 0 && (
                          <span className="text-sm font-semibold text-primary shrink-0">
                            {titleSum.toLocaleString("de-DE", { style: "currency", currency: "EUR" })}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Positions */}
                    {ut.positions.map(({ pos, posIndex, hierarchy }, pi) => {
                      const posKey = getPositionKey(posIndex);
                      const rows = getRows(posIndex);
                      const ep = rows.reduce((sum, r) => sum + Number(r.kosten_einheit || 0) + Number(r.zuschlag || 0), 0);
                      const gp = ep * (parseFloat(pos.quantity) || 0);
                      const isExpanded = expandedOz === posKey;
                      const isCalculated = rows.length > 0;

                      return (
                        <Card key={`${posIndex}-${pi}-${pos.oz}`} className={`transition-all ${isExpanded ? "border-primary/40 shadow-md" : "hover:border-border/80"}`}>
                          <div
                            className="flex items-center gap-2 px-4 py-2.5 cursor-pointer select-none"
                            onClick={() => setExpandedOz(isExpanded ? null : posKey)}
                          >
                            {/* Expand icon */}
                            {isExpanded
                              ? <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                              : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                            }
                            {/* Status dot */}
                            {isCalculated
                              ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />
                              : <div className="w-3.5 h-3.5 rounded-full border-2 border-muted-foreground/30 shrink-0" />
                            }
                            {/* POS. */}
                            <span className="text-xs font-mono font-bold text-foreground w-24 shrink-0">{hierarchy}</span>
                            {/* BESCHREIBUNG */}
                            <div className="flex-1 min-w-0 text-sm text-foreground truncate">{getDisplayText(pos) || <span className="text-muted-foreground/50 italic">–</span>}</div>
                            {/* MENGE + EINHEIT */}
                            <span className="text-xs text-muted-foreground w-20 text-right shrink-0 hidden sm:block">
                              {pos.quantity && <>{parseFloat(pos.quantity).toLocaleString("de-DE", { minimumFractionDigits: 3 })} {pos.unit}</>}
                            </span>
                            {/* EP */}
                            <span className={`text-xs w-24 text-right shrink-0 hidden md:block ${isCalculated ? "font-semibold text-primary" : "text-muted-foreground/40"}`}>
                              {isCalculated ? `${ep.toFixed(2)} €` : "–"}
                            </span>
                            {/* GP */}
                            <span className={`text-xs w-24 text-right shrink-0 hidden md:block ${gp > 0 ? "font-semibold text-foreground" : "text-muted-foreground/40"}`}>
                              {gp > 0 ? gp.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €" : "–"}
                            </span>
                            {savingOz === posKey && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground shrink-0" />}
                          </div>

                          {isExpanded && (
                            <CardContent className="pt-0 pb-4 border-t border-border/50">
                              {pos.long_text && (
                                <div className="mt-3 mb-4 bg-muted/30 rounded-lg p-3 border-l-2 border-primary/30">
                                  {getDisplayText(pos) && (
                                    <p className="text-xs font-semibold text-foreground mb-2">{getDisplayText(pos)}</p>
                                  )}
                                  <p className="text-xs text-muted-foreground">
                                    {(() => {
                                      const displayText = getDisplayText(pos);
                                      const lt = pos.long_text.trim();
                                      if (displayText && lt.startsWith(displayText)) {
                                        return lt.slice(displayText.length).trimStart();
                                      }
                                      return lt;
                                    })()}
                                  </p>
                                </div>
                              )}
                              <div className="mt-3">
                                <PositionKalkTable
                                  rows={rows}
                                  zuschlaege={kalk?.zuschlaege || {}}
                                  onRowsChange={(newRows) => handleRowsChange(posIndex, newRows)}
                                />
                              </div>
                            </CardContent>
                          )}
                        </Card>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}