import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  FileSignature, ClipboardCheck, ArrowRight, Calendar,
  Building2, Euro, AlertTriangle
} from "lucide-react";
import { format } from "date-fns";

const STATUS_COLORS = {
  entwurf: "bg-secondary text-secondary-foreground",
  kalkulation: "bg-blue-100 text-blue-700",
  in_pruefung: "bg-amber-100 text-amber-700",
  ausfuehrungsreif: "bg-green-100 text-green-700",
  nicht_ausfuehrungsreif: "bg-red-100 text-red-700",
  in_ausfuehrung: "bg-purple-100 text-purple-700",
  abgeschlossen: "bg-gray-100 text-gray-600",
};
const STATUS_LABELS = {
  entwurf: "Entwurf", kalkulation: "Kalkulation", in_pruefung: "In Prüfung",
  ausfuehrungsreif: "Ausführungsreif", nicht_ausfuehrungsreif: "Nicht ausführungsreif",
  in_ausfuehrung: "In Ausführung", abgeschlossen: "Abgeschlossen",
};

const AFU_COLORS = {
  ausstehend: "bg-secondary text-secondary-foreground",
  in_pruefung: "bg-amber-100 text-amber-700",
  ausfuehrungsreif: "bg-green-100 text-green-700",
  nicht_ausfuehrungsreif: "bg-red-100 text-red-700",
};
const AFU_LABELS = {
  ausstehend: "AFU ausstehend",
  in_pruefung: "AFU in Prüfung",
  ausfuehrungsreif: "Ausführungsreif",
  nicht_ausfuehrungsreif: "Nicht ausführungsreif",
};

export default function Vertrag() {
  const { data: projects = [], isLoading } = useQuery({
    queryKey: ["projects"],
    queryFn: () => base44.entities.Project.list("-created_date", 100),
  });

  const auftraege = projects.filter(p => ["in_pruefung", "ausfuehrungsreif", "nicht_ausfuehrungsreif", "in_ausfuehrung", "abgeschlossen"].includes(p.status));
  const afuRisiken = projects.filter(p => p.status === "nicht_ausfuehrungsreif");

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Vertrag & Arbeitsvorbereitung</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Vertragsmanagement, AFU-Prüfung und Bauanlauf</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Aufträge gesamt", val: auftraege.length, color: "bg-primary" },
          { label: "In Ausführung", val: projects.filter(p => p.status === "in_ausfuehrung").length, color: "bg-purple-500" },
          { label: "AFU Risiken", val: afuRisiken.length, color: "bg-destructive" },
          { label: "Ausführungsreif", val: projects.filter(p => p.status === "ausfuehrungsreif").length, color: "bg-green-500" },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`w-2.5 h-2.5 rounded-full ${s.color}`} />
              <div>
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className="text-xl font-bold">{s.val}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {afuRisiken.length > 0 && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-destructive">AFU-Risiken – Baustart gesperrt</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {afuRisiken.map(p => p.project_name).join(", ")} – Diese Projekte sind nicht ausführungsreif. Offene Punkte müssen vor Baustart geschlossen werden.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="projekte">
        <TabsList>
          <TabsTrigger value="projekte" className="text-xs">Alle Aufträge</TabsTrigger>
          <TabsTrigger value="afu" className="text-xs gap-1.5">
            <ClipboardCheck className="w-3.5 h-3.5" />AFU-Status
          </TabsTrigger>
        </TabsList>

        <TabsContent value="projekte" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Projekt</th>
                      <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Auftraggeber</th>
                      <th className="text-right text-xs font-medium text-muted-foreground px-4 py-3">Auftragssumme</th>
                      <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Vertragsart</th>
                      <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Status</th>
                      <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Projektstart</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {isLoading ? (
                      Array(4).fill(0).map((_, i) => (
                        <tr key={i} className="border-b"><td colSpan={7} className="px-4 py-3"><Skeleton className="h-4" /></td></tr>
                      ))
                    ) : projects.length === 0 ? (
                      <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-muted-foreground">Keine Projekte vorhanden</td></tr>
                    ) : (
                      projects.map(p => (
                        <tr key={p.id} className="border-b border-border hover:bg-accent/30 transition-colors">
                          <td className="px-4 py-3">
                            <div className="font-medium">{p.project_name}</div>
                            <div className="text-xs text-muted-foreground">{p.project_number}</div>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground text-xs">{p.client || "–"}</td>
                          <td className="px-4 py-3 text-right font-medium text-xs">
                            {p.auftragssumme ? p.auftragssumme.toLocaleString("de-DE") + " €" : "–"}
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">{p.contract_type || "–"}</td>
                          <td className="px-4 py-3">
                            <Badge className={`text-[10px] ${STATUS_COLORS[p.status] || ""}`}>{STATUS_LABELS[p.status] || p.status}</Badge>
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">
                            {p.project_start ? format(new Date(p.project_start), "dd.MM.yyyy") : "–"}
                          </td>
                          <td className="px-4 py-3">
                            <Link to={createPageUrl(`ProjectDetail?id=${p.id}`)}>
                              <Button variant="ghost" size="icon" className="h-7 w-7">
                                <ArrowRight className="w-3.5 h-3.5" />
                              </Button>
                            </Link>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="afu" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Projekt</th>
                      <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Prüfer</th>
                      <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Prüfdatum</th>
                      <th className="text-right text-xs font-medium text-muted-foreground px-4 py-3">Score</th>
                      <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">AFU-Status</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {projects.map(p => (
                      <tr key={p.id} className="border-b border-border hover:bg-accent/30">
                        <td className="px-4 py-3">
                          <div className="font-medium">{p.project_name}</div>
                          <div className="text-xs text-muted-foreground">{p.project_number}</div>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{p.reviewer || "–"}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {p.review_date ? format(new Date(p.review_date), "dd.MM.yyyy") : "–"}
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-xs">
                          {p.overall_score != null ? p.overall_score + "%" : "–"}
                        </td>
                        <td className="px-4 py-3">
                          <Badge className={`text-[10px] ${AFU_COLORS[p.afu_status || "ausstehend"]}`}>
                            {AFU_LABELS[p.afu_status || "ausstehend"]}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <Link to={createPageUrl(`ProjectDetail?id=${p.id}`)}>
                            <Button variant="ghost" size="icon" className="h-7 w-7">
                              <ArrowRight className="w-3.5 h-3.5" />
                            </Button>
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}