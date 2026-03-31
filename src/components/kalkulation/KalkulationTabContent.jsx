import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronRight, Sparkles, CheckCircle2, Lock } from "lucide-react";
import LVUploader from "@/components/lv/LVUploader";
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
    mutationFn: ({ id }) => base44.entities.Kalkulation.update(id, { status: "beauftragt" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["kalkulation", projectId] }),
  });

  const kalk = kalkulationen[0];
  const isBeauftragt = kalk?.status === "beauftragt";

  return (
    <div className="space-y-4">
      {/* KI-Bereich – zusammenfaltbar, standardmäßig zugeklappt */}
      <div className="border border-border rounded-xl overflow-hidden">
        <button
          type="button"
          onClick={() => setKiExpanded(v => !v)}
          className="w-full flex items-center justify-between px-4 py-3 bg-muted/30 hover:bg-muted/50 transition-colors text-left"
        >
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium">LV-Upload & KI-Analyse</span>
          </div>
          {kiExpanded
            ? <ChevronDown className="w-4 h-4 text-muted-foreground" />
            : <ChevronRight className="w-4 h-4 text-muted-foreground" />
          }
        </button>

        {kiExpanded && (
          <div className="p-4 grid grid-cols-1 lg:grid-cols-3 gap-6 border-t border-border">
            <div className="lg:col-span-1">
              <LVUploader project={project} onUpdate={handleLVUpdate} onTradesDetected={handleTradesDetected} />
            </div>
            <div className="lg:col-span-2">
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
          </div>
        )}
      </div>

      {/* Beauftragt-Banner oder Button */}
      {kalk && (
        <div className={`flex items-center justify-between px-4 py-2.5 rounded-lg border ${isBeauftragt ? "bg-green-50 border-green-200" : "bg-amber-50 border-amber-200"}`}>
          <div className="flex items-center gap-2 text-sm">
            {isBeauftragt
              ? <><Lock className="w-4 h-4 text-green-600" /><span className="font-medium text-green-800">Angebot beauftragt – Einheitspreise sind eingefroren</span></>
              : <><span className="text-amber-800">Angebot noch nicht beauftragt. Erst nach Beauftragung kann die Abrechnung gestartet werden.</span></>
            }
          </div>
          {!isBeauftragt && (
            <Button size="sm" className="gap-1.5 bg-green-600 hover:bg-green-700 text-white shrink-0"
              onClick={() => beauftrageMut.mutate({ id: kalk.id })}
              disabled={beauftrageMut.isPending}>
              <CheckCircle2 className="w-3.5 h-3.5" />Als beauftragt markieren
            </Button>
          )}
        </div>
      )}

      {/* Kalkulations-Tabelle */}
      <LVKalkulationView ref={kalkulationRef} project={project} />
    </div>
  );
}