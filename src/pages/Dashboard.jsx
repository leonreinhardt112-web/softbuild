import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import StatCard from "@/components/dashboard/StatCard";
import {
  FolderOpen,
  Plus,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRight,
  FileText,
} from "lucide-react";
import { STATUS_LABELS, STATUS_COLORS } from "@/components/checklistData";
import { format } from "date-fns";

export default function Dashboard() {
  const { data: projects = [], isLoading } = useQuery({
    queryKey: ["projects"],
    queryFn: () => base44.entities.Project.list("-created_date", 50),
  });

  const total = projects.length;
  const ready = projects.filter((p) => p.status === "ausfuehrungsreif").length;
  const notReady = projects.filter((p) => p.status === "nicht_ausfuehrungsreif").length;
  const inReview = projects.filter((p) => p.status === "in_pruefung").length;

  const recentProjects = projects.slice(0, 5);

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Übersicht aller AFU-Prüfungen
          </p>
        </div>
        <Link to={createPageUrl("Projects")}>
          <Button className="gap-2">
            <Plus className="w-4 h-4" />
            Neues Projekt
          </Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Projekte gesamt"
          value={isLoading ? "–" : total}
          icon={FolderOpen}
          color="bg-primary"
        />
        <StatCard
          title="Ausführungsreif"
          value={isLoading ? "–" : ready}
          icon={CheckCircle2}
          color="bg-green-500"
        />
        <StatCard
          title="Nicht ausführungsreif"
          value={isLoading ? "–" : notReady}
          icon={XCircle}
          color="bg-destructive"
        />
        <StatCard
          title="In Prüfung"
          value={isLoading ? "–" : inReview}
          icon={Clock}
          color="bg-amber-500"
        />
      </div>

      {/* Recent projects */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-sm font-semibold">Letzte Projekte</CardTitle>
          <Link to={createPageUrl("Projects")}>
            <Button variant="ghost" size="sm" className="text-xs gap-1">
              Alle anzeigen
              <ArrowRight className="w-3 h-3" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {Array(3)
                .fill(0)
                .map((_, i) => (
                  <Skeleton key={i} className="h-16 rounded-lg" />
                ))}
            </div>
          ) : recentProjects.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">
                Noch keine Projekte vorhanden
              </p>
              <Link to={createPageUrl("Projects")}>
                <Button size="sm" className="mt-3 gap-2">
                  <Plus className="w-3 h-3" />
                  Erstes Projekt anlegen
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {recentProjects.map((project) => (
                <Link
                  key={project.id}
                  to={createPageUrl(`ProjectDetail?id=${project.id}`)}
                  className="flex items-center justify-between p-3 rounded-lg border border-border hover:border-primary/20 hover:bg-accent/30 transition-all group"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {project.project_name}
                    </p>
                    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                      <span>{project.project_number}</span>
                      {project.review_date && (
                        <>
                          <span>·</span>
                          <span>{format(new Date(project.review_date), "dd.MM.yyyy")}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge
                      className={`text-[10px] ${STATUS_COLORS[project.status]}`}
                    >
                      {STATUS_LABELS[project.status]}
                    </Badge>
                    <ArrowRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}