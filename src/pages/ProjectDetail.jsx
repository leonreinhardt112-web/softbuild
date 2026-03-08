import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import TradeSelector from "@/components/projects/TradeSelector";
import ChecklistSection from "@/components/review/ChecklistSection";
import ReviewSummary from "@/components/review/ReviewSummary";
import OpenPointsManager from "@/components/review/OpenPointsManager";
import PdfReport from "@/components/review/PdfReport";
import LVUploader from "@/components/lv/LVUploader";
import LVFindings from "@/components/lv/LVFindings";
import {
  CHECKLIST_TEMPLATES,
  TRADE_LABELS,
  STATUS_LABELS,
  STATUS_COLORS,
} from "@/components/checklistData";
import {
  ArrowLeft,
  ClipboardCheck,
  Settings,
  BarChart3,
  AlertTriangle,
  Play,
  Save,
  Building2,
  MapPin,
  Calendar,
  User,
} from "lucide-react";
import { format } from "date-fns";

export default function ProjectDetail() {
  const urlParams = new URLSearchParams(window.location.search);
  const projectId = urlParams.get("id");
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("setup");
  const [activeTrade, setActiveTrade] = useState("allgemein");

  const { data: project, isLoading: projectLoading } = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => base44.entities.Project.filter({ id: projectId }),
    select: (data) => data[0],
    enabled: !!projectId,
  });

  const { data: checklistItems = [], isLoading: itemsLoading } = useQuery({
    queryKey: ["checklist", projectId],
    queryFn: () => base44.entities.ChecklistItem.filter({ project_id: projectId }, "sort_order", 500),
    enabled: !!projectId,
  });

  const { data: openPoints = [] } = useQuery({
    queryKey: ["openpoints", projectId],
    queryFn: () => base44.entities.OpenPoint.filter({ project_id: projectId }),
    enabled: !!projectId,
  });

  const updateProjectMutation = useMutation({
    mutationFn: (data) => base44.entities.Project.update(projectId, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["project", projectId] }),
  });

  const createItemsMutation = useMutation({
    mutationFn: (items) => base44.entities.ChecklistItem.bulkCreate(items),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["checklist", projectId] }),
  });

  const updateItemMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.ChecklistItem.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["checklist", projectId] }),
  });

  const selectedTrades = project?.selected_trades || ["allgemein"];

  const handleTradesChange = (newTrades) => {
    if (!newTrades.includes("allgemein")) newTrades = ["allgemein", ...newTrades];
    updateProjectMutation.mutate({ selected_trades: newTrades });
  };

  const handleStartReview = async () => {
    // Generate checklist items for selected trades that don't have items yet
    const existingTrades = [...new Set(checklistItems.map((i) => i.trade))];
    const newTrades = selectedTrades.filter((t) => !existingTrades.includes(t));

    if (newTrades.length > 0) {
      const newItems = [];
      for (const trade of newTrades) {
        const template = CHECKLIST_TEMPLATES[trade] || [];
        for (const item of template) {
          newItems.push({
            project_id: projectId,
            trade,
            category: item.category,
            question: item.question,
            status: "offen",
            severity: item.severity,
            norm_reference: item.norm_reference,
            sort_order: item.sort_order,
          });
        }
      }
      if (newItems.length > 0) {
        await createItemsMutation.mutateAsync(newItems);
      }
    }

    updateProjectMutation.mutate({ status: "in_pruefung" });
    setActiveTab("review");
  };

  const handleFinishReview = () => {
    const relevantItems = checklistItems.filter((i) => i.status !== "nicht_relevant");
    const notFulfilled = relevantItems.filter((i) => i.status === "nicht_erfuellt").length;
    const openCount = relevantItems.filter((i) => i.status === "offen").length;
    const criticalFailed = relevantItems.filter(
      (i) => i.status === "nicht_erfuellt" && i.severity === "kritisch"
    ).length;
    const fulfilled = relevantItems.filter((i) => i.status === "erfuellt").length;
    const score = relevantItems.length > 0 ? Math.round((fulfilled / relevantItems.length) * 100) : 0;

    const isReady = criticalFailed === 0 && openCount === 0 && notFulfilled === 0;

    updateProjectMutation.mutate({
      status: isReady ? "ausfuehrungsreif" : "nicht_ausfuehrungsreif",
      overall_score: score,
    });
    setActiveTab("result");
  };

  // Group checklist items by trade, then by category
  const groupedItems = useMemo(() => {
    const groups = {};
    for (const item of checklistItems) {
      if (!groups[item.trade]) groups[item.trade] = {};
      if (!groups[item.trade][item.category]) groups[item.trade][item.category] = [];
      groups[item.trade][item.category].push(item);
    }
    return groups;
  }, [checklistItems]);

  if (projectLoading) {
    return (
      <div className="max-w-6xl mx-auto space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="max-w-6xl mx-auto text-center py-20">
        <p className="text-muted-foreground">Projekt nicht gefunden</p>
        <Link to={createPageUrl("Projects")}>
          <Button variant="link" className="mt-2">Zurück zur Übersicht</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Link to={createPageUrl("Projects")}>
            <Button variant="ghost" size="icon" className="mt-0.5">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-foreground">{project.project_name}</h1>
              <Badge className={`text-[10px] ${STATUS_COLORS[project.status]}`}>
                {STATUS_LABELS[project.status]}
              </Badge>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-xs text-muted-foreground">
              <span>{project.project_number}</span>
              {project.client && (
                <span className="flex items-center gap-1">
                  <Building2 className="w-3 h-3" />
                  {project.client}
                </span>
              )}
              {project.location && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  {project.location}
                </span>
              )}
              {project.reviewer && (
                <span className="flex items-center gap-1">
                  <User className="w-3 h-3" />
                  {project.reviewer}
                </span>
              )}
              {project.review_date && (
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {format(new Date(project.review_date), "dd.MM.yyyy")}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <PdfReport project={project} checklistItems={checklistItems} openPoints={openPoints} />
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="setup" className="gap-1.5 text-xs">
            <Settings className="w-3.5 h-3.5" />
            Gewerke
          </TabsTrigger>
          <TabsTrigger value="review" className="gap-1.5 text-xs" disabled={project.status === "entwurf"}>
            <ClipboardCheck className="w-3.5 h-3.5" />
            Prüfung
          </TabsTrigger>
          <TabsTrigger value="openpoints" className="gap-1.5 text-xs" disabled={project.status === "entwurf"}>
            <AlertTriangle className="w-3.5 h-3.5" />
            Offene Punkte
          </TabsTrigger>
          <TabsTrigger value="result" className="gap-1.5 text-xs" disabled={checklistItems.length === 0}>
            <BarChart3 className="w-3.5 h-3.5" />
            Ergebnis
          </TabsTrigger>
        </TabsList>

        {/* Setup Tab */}
        <TabsContent value="setup" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <TradeSelector
                selected={selectedTrades}
                onChange={handleTradesChange}
              />
            </div>
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold">Projektdaten</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-xs">
                  <div className="flex justify-between"><span className="text-muted-foreground">Vertragsart</span><span className="font-medium">{project.contract_type || "–"}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">VOB/B</span><span className="font-medium">{project.vob_agreed ? "Ja" : "Nein"}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Planungsbüro</span><span className="font-medium">{project.planning_office || "–"}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Projektstart</span><span className="font-medium">{project.project_start ? format(new Date(project.project_start), "dd.MM.yyyy") : "–"}</span></div>
                </CardContent>
              </Card>
              <Button className="w-full gap-2" onClick={handleStartReview}>
                <Play className="w-4 h-4" />
                Prüfung starten
              </Button>
            </div>
          </div>
        </TabsContent>

        {/* Review Tab */}
        <TabsContent value="review" className="mt-6">
          {itemsLoading ? (
            <div className="space-y-3">
              {Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-16" />)}
            </div>
          ) : checklistItems.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-sm text-muted-foreground">
                  Bitte starten Sie die Prüfung im Reiter "Gewerke"
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              {/* Trade sidebar */}
              <div className="lg:col-span-1">
                <Card>
                  <CardContent className="p-2">
                    {selectedTrades
                      .filter((t) => groupedItems[t])
                      .map((t) => {
                        const tradeItems = checklistItems.filter((i) => i.trade === t && i.status !== "nicht_relevant");
                        const fulfilledCount = tradeItems.filter((i) => i.status === "erfuellt").length;
                        const pct = tradeItems.length > 0 ? Math.round((fulfilledCount / tradeItems.length) * 100) : 0;
                        return (
                          <button
                            key={t}
                            onClick={() => setActiveTrade(t)}
                            className={`w-full flex items-center justify-between p-2.5 rounded-lg text-xs font-medium transition-all ${
                              activeTrade === t
                                ? "bg-primary text-primary-foreground"
                                : "text-muted-foreground hover:bg-accent"
                            }`}
                          >
                            <span className="truncate">{TRADE_LABELS[t]}</span>
                            <span className={`shrink-0 ml-2 ${activeTrade === t ? "text-primary-foreground/80" : ""}`}>
                              {pct}%
                            </span>
                          </button>
                        );
                      })}
                  </CardContent>
                </Card>
              </div>

              {/* Checklist */}
              <div className="lg:col-span-3 space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold">{TRADE_LABELS[activeTrade]}</h2>
                  <Button onClick={handleFinishReview} className="gap-2" size="sm">
                    <Save className="w-3.5 h-3.5" />
                    Prüfung abschließen
                  </Button>
                </div>
                {groupedItems[activeTrade] &&
                  Object.entries(groupedItems[activeTrade]).map(([category, items]) => (
                    <ChecklistSection
                      key={category}
                      category={category}
                      items={items}
                      onUpdateItem={(id, data) => updateItemMutation.mutate({ id, data })}
                    />
                  ))}
              </div>
            </div>
          )}
        </TabsContent>

        {/* Open Points Tab */}
        <TabsContent value="openpoints" className="mt-6">
          <OpenPointsManager
            projectId={projectId}
            openPoints={openPoints}
            selectedTrades={selectedTrades}
          />
        </TabsContent>

        {/* Result Tab */}
        <TabsContent value="result" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ReviewSummary items={checklistItems} selectedTrades={selectedTrades} />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}