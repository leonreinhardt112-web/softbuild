import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  FolderOpen, Plus, CheckCircle2, XCircle, Clock, ArrowRight,
  AlertTriangle, TrendingUp, Receipt, HardHat, Euro, FileText
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
  entwurf: "Entwurf",
  kalkulation: "Kalkulation",
  in_pruefung: "In Prüfung",
  ausfuehrungsreif: "Ausführungsreif",
  nicht_ausfuehrungsreif: "Nicht ausführungsreif",
  in_ausfuehrung: "In Ausführung",
  abgeschlossen: "Abgeschlossen",
};

function StatWidget({ title, value, sub, icon: Icon, color, href }) {
  const inner = (
    <Card className="hover:shadow-md transition-shadow cursor-pointer">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-muted-foreground font-medium">{title}</p>
            <p className="text-2xl font-bold text-foreground mt-1">{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
          </div>
          <div className={`w-9 h-9 rounded-lg ${color} flex items-center justify-center`}>
            <Icon className="w-4 h-4 text-white" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
  if (href) return <Link to={href}>{inner}</Link>;
  return inner;
}

export default function Dashboard() {
  const { data: projects = [], isLoading } = useQuery({
    queryKey: ["projects"],
    queryFn: () => base44.entities.Project.list("-created_date", 50),
  });
  const { data: rechnungen = [] } = useQuery({
    queryKey: ["rechnungen-dash"],
    queryFn: () => base44.entities.Rechnung.list("-created_date", 100),
  });
  const { data: nachtraege = [] } = useQuery({
    queryKey: ["nachtraege-dash"],
    queryFn: () => base44.entities.Nachtrag.list("-created_date", 100),
  });

  const aktiv = projects.filter((p) => p.status === "in_ausfuehrung").length;
  const notReady = projects.filter((p) => p.status === "nicht_ausfuehrungsreif").length;
  const inPruefung = projects.filter((p) => p.status === "in_pruefung").length;

  const offeneNachtraege = nachtraege.filter((n) => ["angemeldet", "eingereicht", "in_verhandlung"].includes(n.status)).length;
  const offeneForderungen = rechnungen
    .filter((r) => !["bezahlt", "storniert"].includes(r.status))
    .reduce((s, r) => s + ((r.betrag_brutto || 0) - (r.zahlungseingang || 0)), 0);

  const gesamtauftrag = projects.reduce((s, p) => s + (p.auftragssumme || 0), 0);

  const recentProjects = projects.slice(0, 8);

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Unternehmensüberblick · {format(new Date(), "dd.MM.yyyy")}</p>
        </div>
        <Link to={createPageUrl("Projects")}>
          <Button className="gap-2"><Plus className="w-4 h-4" />Neues Projekt</Button>
        </Link>
      </div>

      {/* KPI Widgets */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatWidget title="Aktive Projekte" value={isLoading ? "–" : aktiv}
          sub="In Ausführung" icon={HardHat} color="bg-primary" href={createPageUrl("Projects")} />
        <StatWidget title="AFU-Risiken" value={isLoading ? "–" : notReady}
          sub="Nicht ausführungsreif" icon={XCircle} color="bg-destructive" href={createPageUrl("Projects")} />
        <StatWidget title="Offene Nachträge" value={isLoading ? "–" : offeneNachtraege}
          sub="In Bearbeitung" icon={AlertTriangle} color="bg-amber-500" href={createPageUrl("Abrechnung")} />
        <StatWidget
          title="Offene Forderungen"
          value={isLoading ? "–" : `${(offeneForderungen / 1000).toFixed(0)}k €`}
          sub="Unbezahlte Rechnungen"
          icon={Euro} color="bg-green-600" href={createPageUrl("Abrechnung")} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Projektliste */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-sm font-semibold">Aktuelle Projekte</CardTitle>
              <Link to={createPageUrl("Projects")}>
                <Button variant="ghost" size="sm" className="text-xs gap-1">
                  Alle <ArrowRight className="w-3 h-3" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="p-4 space-y-2">
                  {Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)}
                </div>
              ) : recentProjects.length === 0 ? (
                <div className="text-center py-10">
                  <FileText className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Noch keine Projekte</p>
                  <Link to={createPageUrl("Projects")}>
                    <Button size="sm" className="mt-3 gap-2"><Plus className="w-3 h-3" />Projekt anlegen</Button>
                  </Link>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {recentProjects.map((project) => (
                    <Link
                      key={project.id}
                      to={createPageUrl(`ProjectDetail?id=${project.id}`)}
                      className="flex items-center justify-between px-4 py-3 hover:bg-accent/40 transition-colors group"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{project.project_name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {project.project_number}{project.client ? ` · ${project.client}` : ""}
                          {project.auftragssumme ? ` · ${project.auftragssumme.toLocaleString("de-DE")} €` : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 ml-3">
                        <Badge className={`text-[10px] shrink-0 ${STATUS_COLORS[project.status] || ""}`}>
                          {STATUS_LABELS[project.status] || project.status}
                        </Badge>
                        <ArrowRight className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Schnellübersicht */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Projektstatus-Ampel</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {[
                { label: "In Ausführung", count: aktiv, color: "bg-purple-500" },
                { label: "AFU In Prüfung", count: inPruefung, color: "bg-amber-400" },
                { label: "Ausführungsreif", count: projects.filter(p => p.status === "ausfuehrungsreif").length, color: "bg-green-500" },
                { label: "Nicht ausführungsreif", count: notReady, color: "bg-red-500" },
                { label: "Kalkulation", count: projects.filter(p => p.status === "kalkulation").length, color: "bg-blue-400" },
                { label: "Abgeschlossen", count: projects.filter(p => p.status === "abgeschlossen").length, color: "bg-gray-400" },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div className={`w-2.5 h-2.5 rounded-full ${item.color}`} />
                    <span className="text-muted-foreground text-xs">{item.label}</span>
                  </div>
                  <span className="font-semibold text-xs">{item.count}</span>
                </div>
              ))}
              <div className="pt-2 border-t border-border flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Gesamtauftragsvolumen</span>
                <span className="font-bold">{(gesamtauftrag / 1000).toFixed(0)}k €</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Schnellzugriff</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {[
                { label: "Neue Kalkulation", page: "Kalkulation", icon: Calculator },
                { label: "Bautagesbericht", page: "Baustelle", icon: HardHat },
                { label: "Rechnung erstellen", page: "Abrechnung", icon: Receipt },
                { label: "Controlling", page: "Controlling", icon: TrendingUp },
              ].map(({ label, page, icon: Icon }) => (
                <Link key={page} to={createPageUrl(page)}>
                  <button className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-accent transition-colors text-sm text-muted-foreground hover:text-foreground">
                    <Icon className="w-3.5 h-3.5" />
                    {label}
                  </button>
                </Link>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}