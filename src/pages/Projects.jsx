import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ProjectForm from "@/components/projects/ProjectForm";
import {
  Plus, Search, ArrowRight, FileText, Trash2, Pencil, MapPin, Building2, LayoutGrid,
} from "lucide-react";
import { STATUS_LABELS, STATUS_COLORS } from "@/components/checklistData";
import { format } from "date-fns";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const STATUS_GROUPS = {
  vorbereitung: {
    label: "In Vorbereitung",
    statuses: ["entwurf", "kalkulation", "eingereicht"],
  },
  aktiv: {
    label: "Aktiv & Abgeschlossen",
    statuses: ["beauftragt", "in_ausfuehrung", "verloren", "abgeschlossen"],
  },
};

function ProjectCard({ project, onEdit, onDelete }) {
  return (
    <Card className="hover:shadow-md transition-all group">
      <CardContent className="p-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <Link to={createPageUrl(`ProjectDetail?id=${project.id}`)} className="flex-1 min-w-0">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                <FileText className="w-5 h-5 text-primary" />
              </div>
              <div className="min-w-0">
                <h3 className="font-semibold text-sm text-foreground truncate">{project.project_name}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">{project.project_number}</p>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-xs text-muted-foreground">
                  {project.client && (
                    <span className="flex items-center gap-1">
                      <Building2 className="w-3 h-3" />{project.client}
                    </span>
                  )}
                  {project.location && (
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3" />{project.location}
                    </span>
                  )}
                  {project.submission_date && (
                    <span className="text-amber-600 font-medium">
                      Submission: {format(new Date(project.submission_date), "dd.MM.yyyy")}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </Link>
          <div className="flex items-center gap-2 sm:pl-4">
            <Badge className={`text-[10px] shrink-0 ${STATUS_COLORS[project.status]}`}>
              {STATUS_LABELS[project.status]}
            </Badge>
            <Button variant="ghost" size="icon" className="h-8 w-8"
              onClick={e => { e.preventDefault(); onEdit(project); }}>
              <Pencil className="w-3.5 h-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"
              onClick={e => { e.preventDefault(); onDelete(project.id); }}>
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
            <Link to={createPageUrl(`ProjectDetail?id=${project.id}`)}>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Projects() {
  const [showForm, setShowForm] = useState(false);
  const [editProject, setEditProject] = useState(null);
  const [search, setSearch] = useState("");
  const [deleteId, setDeleteId] = useState(null);
  const [viewMode, setViewMode] = useState("tabs"); // "tabs" | "all"
  const [activeTab, setActiveTab] = useState("vorbereitung");
  const queryClient = useQueryClient();

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ["projects"],
    queryFn: () => base44.entities.Project.list("-created_date", 100),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Project.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["projects"] }); setShowForm(false); },
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Project.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      setEditProject(null); setShowForm(false);
    },
  });
  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Project.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["projects"] }); setDeleteId(null); },
  });

  const handleSave = (formData) => {
    if (editProject) updateMutation.mutate({ id: editProject.id, data: formData });
    else createMutation.mutate(formData);
  };

  const searchFiltered = projects.filter(p =>
    p.project_name?.toLowerCase().includes(search.toLowerCase()) ||
    p.project_number?.toLowerCase().includes(search.toLowerCase()) ||
    p.client?.toLowerCase().includes(search.toLowerCase())
  );

  const getGroupProjects = (groupKey) => {
    const statuses = STATUS_GROUPS[groupKey].statuses;
    return searchFiltered.filter(p => statuses.includes(p.status));
  };

  const displayedProjects = viewMode === "all"
    ? searchFiltered
    : getGroupProjects(activeTab);

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Projekte</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {projects.length} Projekt{projects.length !== 1 ? "e" : ""} verwaltet
          </p>
        </div>
        <Button onClick={() => { setEditProject(null); setShowForm(true); }} className="gap-2">
          <Plus className="w-4 h-4" />Neues Projekt
        </Button>
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Projekte suchen..." value={search}
            onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        {/* View mode toggle */}
        <div className="flex items-center gap-1 border border-border rounded-lg p-1">
          <Button
            variant={viewMode === "tabs" ? "default" : "ghost"}
            size="sm" className="h-7 text-xs px-3"
            onClick={() => setViewMode("tabs")}>
            Nach Status
          </Button>
          <Button
            variant={viewMode === "all" ? "default" : "ghost"}
            size="sm" className="h-7 text-xs px-3"
            onClick={() => setViewMode("all")}>
            <LayoutGrid className="w-3.5 h-3.5 mr-1" />Alle
          </Button>
        </div>
      </div>

      {/* Tab navigation */}
      {viewMode === "tabs" && (
        <div className="flex gap-2 border-b border-border pb-0">
          {Object.entries(STATUS_GROUPS).map(([key, group]) => {
            const count = getGroupProjects(key).length;
            return (
              <button key={key}
                onClick={() => setActiveTab(key)}
                className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-all -mb-px ${
                  activeTab === key
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}>
                {group.label}
                <span className={`ml-2 text-xs px-1.5 py-0.5 rounded-full ${
                  activeTab === key ? "bg-primary/10 text-primary" : "bg-secondary text-muted-foreground"
                }`}>{count}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Project list */}
      {isLoading ? (
        <div className="space-y-3">
          {Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      ) : displayedProjects.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-16">
            <FileText className="w-12 h-12 text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground text-sm">
              {search ? "Keine Projekte gefunden" : "Keine Projekte in dieser Kategorie"}
            </p>
            {!search && (
              <Button size="sm" className="mt-4 gap-2" onClick={() => setShowForm(true)}>
                <Plus className="w-3 h-3" />Projekt anlegen
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {displayedProjects.map(project => (
            <ProjectCard key={project.id} project={project}
              onEdit={p => { setEditProject(p); setShowForm(true); }}
              onDelete={id => setDeleteId(id)} />
          ))}
        </div>
      )}

      <ProjectForm open={showForm} onOpenChange={setShowForm} onSave={handleSave} initialData={editProject} />

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Projekt löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Dieses Projekt und alle zugehörigen Prüfdaten werden unwiderruflich gelöscht.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive hover:bg-destructive/90"
              onClick={() => deleteMutation.mutate(deleteId)}>Löschen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}