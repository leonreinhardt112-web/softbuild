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

  // Sync local state from DB
  useEffect(() => {
    const kalk = kalkulationen[0];
    if (kalk?.positions) {
      const map = {};
      kalk.positions.forEach(p => { map[p.oz] = p.rows || []; });
      setLocalPositions(map);
    }
  }, [kalkulationen]);

  const kalk = kalkulationen[0];

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

  const getRows = (oz) => localPositions[oz] || [];

  const handleRowsChange = (oz, rows) => {
    setLocalPositions(prev => ({ ...prev, [oz]: rows }));

    // Debounced save
    if (saveTimers.current[oz]) clearTimeout(saveTimers.current[oz]);
    setSavingOz(oz);
    saveTimers.current[oz] = setTimeout(async () => {
      if (!kalk) return;
      const ep = rows.reduce((sum, r) => sum + Number(r.kosten_einheit || 0) + Number(r.zuschlag || 0), 0);
      const lvPos = lvPositions.find(p => p.oz === oz);
      const menge = parseFloat(lvPos?.quantity) || 0;
      const existingPositions = kalk.positions || [];
      const exists = existingPositions.some(p => p.oz === oz);
      let updatedPositions;
      if (exists) {
        updatedPositions = existingPositions.map(p => p.oz === oz ? { ...p, rows, ep, gp: ep * menge } : p);
      } else {
        updatedPositions = [...existingPositions, { oz, short_text: lvPos?.short_text || "", menge, einheit: lvPos?.unit || "", ep, gp: ep * menge, rows }];
      }
      await updateKalkMutation.mutateAsync({ id: kalk.id, data: { positions: updatedPositions } });
      setSavingOz(null);
    }, 700);
  };

  // Group positions by title
  const grouped = [];
  let currentGroup = null;
  lvPositions.forEach((pos) => {
    if (pos.type === "title") {
      currentGroup = { title: pos, positions: [] };
      grouped.push(currentGroup);
    } else {
      if (!currentGroup) {
        currentGroup = { title: null, positions: [] };
        grouped.push(currentGroup);
      }
      currentGroup.positions.push(pos);
    }
  });

  const positionItems = lvPositions.filter(p => p.type !== "title");

  const totalAngebotsumme = positionItems.reduce((sum, pos) => {
    const rows = getRows(pos.oz);
    const ep = rows.reduce((s, r) => s + Number(r.kosten_einheit || 0) + Number(r.zuschlag || 0), 0);
    return sum + ep * (parseFloat(pos.quantity) || 0);
  }, 0);

  const getTitleSum = (positions) =>
    positions.reduce((sum, pos) => {
      const rows = getRows(pos.oz);
      const ep = rows.reduce((s, r) => s + Number(r.kosten_einheit || 0) + Number(r.zuschlag || 0), 0);
      return sum + ep * (parseFloat(pos.quantity) || 0);
    }, 0);

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

      {/* Grouped by title */}
      <div className="space-y-6">
        {grouped.map((group, gi) => {
          const titleSum = getTitleSum(group.positions);
          return (
            <div key={gi} className="space-y-2">
              {/* Title header */}
              {group.title && (
                <div className="flex items-center justify-between px-1 py-1 border-b border-border">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-muted-foreground">{group.title.oz}</span>
                    <span className="text-sm font-semibold text-foreground">{group.title.short_text}</span>
                  </div>
                  {titleSum > 0 && (
                    <span className="text-sm font-semibold text-primary shrink-0">
                      {titleSum.toLocaleString("de-DE", { style: "currency", currency: "EUR" })}
                    </span>
                  )}
                </div>
              )}

              {/* Positions in this group */}
              {group.positions.map((pos) => {
                const rows = getRows(pos.oz);
                const ep = rows.reduce((sum, r) => sum + Number(r.kosten_einheit || 0) + Number(r.zuschlag || 0), 0);
                const gp = ep * (parseFloat(pos.quantity) || 0);
                const isExpanded = expandedOz === pos.oz;
                const isCalculated = rows.length > 0;

                return (
                  <Card key={pos.oz} className={`transition-all ${isExpanded ? "border-primary/40 shadow-md" : "hover:border-border/80"}`}>
                    <div
                      className="flex items-center gap-3 px-4 py-3 cursor-pointer select-none"
                      onClick={() => setExpandedOz(isExpanded ? null : pos.oz)}
                    >
                      {isExpanded
                        ? <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                        : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                      }
                      {isCalculated
                        ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />
                        : <div className="w-3.5 h-3.5 rounded-full border-2 border-muted-foreground/30 shrink-0" />
                      }
                      <span className="text-xs font-mono text-muted-foreground w-16 shrink-0">{pos.oz}</span>
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium">{pos.short_text}</span>
                        <span className="text-xs text-muted-foreground ml-2">{pos.quantity} {pos.unit}</span>
                      </div>
                      {isCalculated && (
                        <div className="text-right shrink-0 hidden sm:block">
                          <span className="text-xs font-semibold text-primary">{ep.toFixed(2)} €/Eh</span>
                          {gp > 0 && <span className="text-xs text-muted-foreground ml-2">GP: {gp.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</span>}
                        </div>
                      )}
                      {rows.length > 0 && <Badge variant="secondary" className="text-[10px] shrink-0">{rows.length}</Badge>}
                      {savingOz === pos.oz && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground shrink-0" />}
                    </div>

                    {isExpanded && (
                      <CardContent className="pt-0 pb-4 border-t border-border/50">
                        {pos.long_text && (
                          <p className="text-xs text-muted-foreground mt-3 mb-4 bg-muted/30 rounded-lg p-3 border-l-2 border-primary/30">
                            {pos.long_text}
                          </p>
                        )}
                        <div className="mt-3">
                          <PositionKalkTable
                            rows={rows}
                            onRowsChange={(newRows) => handleRowsChange(pos.oz, newRows)}
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
  );
}