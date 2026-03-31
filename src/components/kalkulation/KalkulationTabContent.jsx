import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight, Sparkles } from "lucide-react";
import LVUploader from "@/components/lv/LVUploader";
import LVAnalyseErgebnisse from "@/components/lv/LVAnalyseErgebnisse";
import LVKalkulationView from "./LVKalkulationView";

export default function KalkulationTabContent({
  project, projectId, kalkulationRef, handleLVUpdate, handleTradesDetected, queryClient
}) {
  const [kiExpanded, setKiExpanded] = useState(false);

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

      {/* Kalkulations-Tabelle */}
      <LVKalkulationView ref={kalkulationRef} project={project} />
    </div>
  );
}