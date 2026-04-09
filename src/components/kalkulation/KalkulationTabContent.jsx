import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronRight, Sparkles, CheckCircle2, Lock } from "lucide-react";
import { FileText } from "lucide-react";
import LVAnalyseErgebnisse from "@/components/lv/LVAnalyseErgebnisse";
import LVKalkulationView from "./LVKalkulationView";

export default function KalkulationTabContent({
  project, projectId, kalkulationRef, handleLVUpdate, handleTradesDetected, queryClient: externalQc
}) {
  const [kiExpanded, setKiExpanded] = useState(false);
  const internalQc = useQueryClient();
  const queryClient = externalQc || internalQc;

  const { data: kalkulationen = [] } = useQuery({
    queryKey: ["kalkulation", projectId],
    queryFn: () => base44.entities.Kalkulation.filter({ project_id: projectId }),
    enabled: !!projectId,
  });

  const beauftrageMut = useMutation({
    mutationFn: ({ id, status }) => base44.entities.Kalkulation.update(id, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["kalkulation", projectId] }),
  });

  const kalk = kalkulationen[0];
  const isBeauftragt = kalk?.status === "beauftragt";
  const hasLV = project?.lv_positions?.length > 0;

  return (
    <div className="space-y-4">
      {/* LV-Status + KI-Analyse */}
      {!hasLV ? (
        <div className="flex items-center gap-3 p-4 rounded-xl border border-dashed border-border bg-muted/30">
          <FileText className="w-5 h-5 text-muted-foreground shrink-0" />
          <div>
            <p className="text-sm font-medium text-muted-foreground">Kein GAEB-Leistungsverzeichnis geladen</p>
            <p className="text-xs text-muted-foreground mt-0.5">Lade die GAEB-Datei im Reiter <strong>Dokumente</strong> hoch — sie wird automatisch erkannt und hier verfügbar.</p>
          </div>
        </div>
      ) : (
        <div className="border border-border rounded-xl overflow-hidden">
          <button
            type="button"
            onClick={() => setKiExpanded(v => !v)}
            className="w-full flex items-center justify-between px-4 py-3 bg-muted/30 hover:bg-muted/50 transition-colors text-left"
          >
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium">KI-Analyse & Bieterfragen</span>
              <span className="text-xs text-muted-foreground">({project.lv_positions.length} Positionen)</span>
            </div>
            {kiExpanded
              ? <ChevronDown className="w-4 h-4 text-muted-foreground" />
              : <ChevronRight className="w-4 h-4 text-muted-foreground" />
            }
          </button>

          {kiExpanded && (
            <div className="p-4 border-t border-border">
              <LVAnalyseErgebnisse
                project={project}
                onUpdate={handleLVUpdate}
                onFristenUebernehmen={async (kiFristen) => {
                  const startFrist = kiFristen.find(f => f.typ === "vertragsbeginn");
                  const endFrist = kiFristen.find(f => f.typ === "vertragsende");
                  const updates = {};
                  if (startFrist?.datum && !project.project_start) updates.project_start = startFrist.datum;
                  if (endFrist?.datum && !project.project_end) updates.project_end = endFrist.datum;
                  if (Object.keys(updates).length > 0) await handleLVUpdate(updates);
                  for (const f of kiFristen) {
                    await base44.entities.ProjektFrist.create({
                      project_id: projectId,
                      titel: f.titel,
                      datum: f.datum || null,
                      typ: f.typ || "sonstiges",
                      status: "offen",
                    });
                  }
                  queryClient.invalidateQueries({ queryKey: ["fristen", projectId] });
                  await handleLVUpdate({ ki_gefundene_fristen: [] });
                }}
              />
            </div>
          )}
        </div>
      )}

      {/* Beauftragt-Banner oder Button */}
      {kalk && (
        <div className={`flex items-center justify-between px-4 py-2.5 rounded-lg border ${isBeauftragt ? "bg-green-50 border-green-200" : "bg-amber-50 border-amber-200"}`}>
          <div className="flex items-center gap-2 text-sm">
            {isBeauftragt
              ? <><Lock className="w-4 h-4 text-green-600" /><span className="font-medium text-green-800">Angebot beauftragt – Einheitspreise sind eingefroren</span></>
              : <><span className="text-amber-800">Angebot noch nicht beauftragt. Erst nach Beauftragung kann die Abrechnung gestartet werden.</span></>
            }
          </div>
          <div className="flex gap-2 shrink-0">
            {isBeauftragt ? (
              <Button size="sm" variant="outline" className="gap-1.5 text-amber-700 border-amber-300 hover:bg-amber-50"
                onClick={() => beauftrageMut.mutate({ id: kalk.id, status: "entwurf" })}
                disabled={beauftrageMut.isPending}>
                Beauftragung aufheben
              </Button>
            ) : (
              <Button size="sm" className="gap-1.5 bg-green-600 hover:bg-green-700 text-white"
                onClick={() => beauftrageMut.mutate({ id: kalk.id, status: "beauftragt" })}
                disabled={beauftrageMut.isPending}>
                <CheckCircle2 className="w-3.5 h-3.5" />Als beauftragt markieren
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Kalkulations-Tabelle */}
      <LVKalkulationView ref={kalkulationRef} project={project} />
    </div>
  );
}