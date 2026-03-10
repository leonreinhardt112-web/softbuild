import React, { useState, useMemo, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import TradeSelector from "@/components/projects/TradeSelector";
import ChecklistSection from "@/components/review/ChecklistSection";
import ReviewSummary from "@/components/review/ReviewSummary";
import OpenPointsManager from "@/components/review/OpenPointsManager";
import PdfReport from "@/components/review/PdfReport";
import LVUploader from "@/components/lv/LVUploader";
import LVFindings from "@/components/lv/LVFindings";
import LVKalkulationView from "@/components/kalkulation/LVKalkulationView";
import {
  CHECKLIST_TEMPLATES,
  TRADE_LABELS,
  STATUS_LABELS,
  STATUS_COLORS,
} from "@/components/checklistData";
import {
  ArrowLeft, ClipboardCheck, Settings, BarChart3, AlertTriangle, Play, Save,
  Building2, MapPin, Calendar, User, Calculator, Receipt, HardHat, FileText,
  Euro, Clock, Lock, ChevronRight, FolderOpen,
} from "lucide-react";
import { format } from "date-fns";

const POST_AWARD_STATUSES = ["beauftragt", "in_ausfuehrung", "abgeschlossen"];

export default function ProjectDetail() {
  const urlParams = new URLSearchParams(window.location.search);
  const projectId = urlParams.get("id");
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("overview");
  const [pendingTab, setPendingTab] = useState(null);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const kalkulationRef = useRef(null);
  // AFU internal view
  const [afuView, setAfuView] = useState("setup"); // setup | review | openpoints | result
  const [activeTrade, setActiveTrade] = useState("allgemein");

  const handleTabChange = (newTab) => {
    if (activeTab === "kalkulation" && newTab !== "kalkulation") {
      if (kalkulationRef.current?.hasDirtyChanges()) {
        setPendingTab(newTab);
        setShowUnsavedDialog(true);
        return;
      }
    }
    setActiveTab(newTab);
  };

  const handleDiscardAndSwitch = () => {
    setShowUnsavedDialog(false);
    setActiveTab(pendingTab);
    setPendingTab(null);
  };

  const handleSaveAndSwitch = async () => {
    await kalkulationRef.current?.saveAll();
    setShowUnsavedDialog(false);
    setActiveTab(pendingTab);
    setPendingTab(null);
  };

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

  const { data: kalkulationen = [] } = useQuery({
    queryKey: ["kalkulation", projectId],
    queryFn: () => base44.entities.Kalkulation.filter({ project_id: projectId }),
    enabled: !!projectId,
  });

  const { data: rechnungen = [] } = useQuery({
    queryKey: ["rechnungen", projectId],
    queryFn: () => base44.entities.Rechnung.filter({ project_id: projectId }),
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

  const handleLVUpdate = (data) => updateProjectMutation.mutateAsync(data);

  const handleTradesDetected = (detectedTrades) => {
    const current = project?.selected_trades || ["allgemein"];
    const merged = [...new Set([...current, ...detectedTrades])];
    updateProjectMutation.mutate({ selected_trades: merged });
  };

  const selectedTrades = project?.selected_trades || ["allgemein"];

  const handleTradesChange = (newTrades) => {
    if (!newTrades.includes("allgemein")) newTrades = ["allgemein", ...newTrades];
    updateProjectMutation.mutate({ selected_trades: newTrades });
  };

  const handleStartReview = async () => {
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
      if (newItems.length > 0) await createItemsMutation.mutateAsync(newItems);
    }
    updateProjectMutation.mutate({ status: "in_pruefung" });
    setAfuView("review");
  };

  const handleFinishReview = () => {
    const relevantItems = checklistItems.filter((i) => i.status !== "nicht_relevant");
    const criticalFailed = relevantItems.filter(
      (i) => i.status === "nicht_erfuellt" && i.severity === "kritisch"
    ).length;
    const openCount = relevantItems.filter((i) => i.status === "offen").length;
    const notFulfilled = relevantItems.filter((i) => i.status === "nicht_erfuellt").length;
    const fulfilled = relevantItems.filter((i) => i.status === "erfuellt").length;
    const score = relevantItems.length > 0 ? Math.round((fulfilled / relevantItems.length) * 100) : 0;
    updateProjectMutation.mutate({
      afu_status: criticalFailed === 0 && openCount === 0 && notFulfilled === 0 ? "ausfuehrungsreif" : "nicht_ausfuehrungsreif",
      overall_score: score,
    });
    setAfuView("result");
  };

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
        <Skeleton className="h-8 w-48" /><Skeleton className="h-64 w-full" />
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

  const isPostAward = POST_AWARD_STATUSES.includes(project.status);
  const latestKalk = kalkulationen[0];
  const totalRechnungen = rechnungen.reduce((s, r) => s + (r.betrag_netto || 0), 0);

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
              {project.client && <span className="flex items-center gap-1"><Building2 className="w-3 h-3" />{project.client}</span>}
              {project.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{project.location}</span>}
              {project.reviewer && <span className="flex items-center gap-1"><User className="w-3 h-3" />{project.reviewer}</span>}
              {project.review_date && <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{format(new Date(project.review_date), "dd.MM.yyyy")}</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="overview" className="gap-1.5 text-xs">
            <FolderOpen className="w-3.5 h-3.5" />Übersicht
          </TabsTrigger>
          <TabsTrigger value="kalkulation" className="gap-1.5 text-xs">
            <Calculator className="w-3.5 h-3.5" />Kalkulation
          </TabsTrigger>
          <TabsTrigger value="afu" className="gap-1.5 text-xs" disabled={!isPostAward}
            title={!isPostAward ? "Erst nach Beauftragung verfügbar" : ""}>
            <ClipboardCheck className="w-3.5 h-3.5" />
            AFU-Prüfung
            {!isPostAward && <Lock className="w-3 h-3 ml-0.5 opacity-50" />}
          </TabsTrigger>
          <TabsTrigger value="ausfuehrung" className="gap-1.5 text-xs" disabled={!isPostAward}
            title={!isPostAward ? "Erst nach Beauftragung verfügbar" : ""}>
            <HardHat className="w-3.5 h-3.5" />
            Ausführung
            {!isPostAward && <Lock className="w-3 h-3 ml-0.5 opacity-50" />}
          </TabsTrigger>
        </TabsList>

        {/* OVERVIEW */}
        <TabsContent value="overview" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold">Projektdaten</CardTitle></CardHeader>
              <CardContent className="space-y-2.5 text-sm">
                {[
                  ["Projektnummer", project.project_number],
                  ["Auftraggeber", project.client],
                  ["Standort", project.location],
                  ["Vertragsart", project.contract_type],
                  ["VOB/B vereinbart", project.vob_agreed !== undefined ? (project.vob_agreed ? "Ja" : "Nein") : null],
                  ["Planungsbüro", project.planning_office],
                  ["Projektleiter", project.project_manager],
                  ["Bauleiter", project.site_manager],
                  ["Bearbeiter AFU", project.reviewer],
                ].filter(([, v]) => v).map(([label, value]) => (
                  <div key={label} className="flex justify-between gap-4">
                    <span className="text-muted-foreground shrink-0">{label}</span>
                    <span className="font-medium text-right">{value}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Clock className="w-4 h-4" />Termine
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2.5 text-sm">
                {[
                  ["Submissionsdatum", project.submission_date],
                  ["Prüfdatum AFU", project.review_date],
                  ["Projektstart", project.project_start],
                  ["Projektende (geplant)", project.project_end],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between gap-4">
                    <span className="text-muted-foreground shrink-0">{label}</span>
                    <span className="font-medium">{value ? format(new Date(value), "dd.MM.yyyy") : "–"}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
            {latestKalk && (
              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold flex items-center gap-2"><Euro className="w-4 h-4" />Kalkulation</CardTitle></CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Angebotssumme</span><span className="font-semibold">{latestKalk.angebotsumme?.toLocaleString("de-DE", { style: "currency", currency: "EUR" }) || "–"}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Deckungsbeitrag</span><span className="font-medium">{latestKalk.deckungsbeitrag?.toLocaleString("de-DE", { style: "currency", currency: "EUR" }) || "–"}</span></div>
                  <Button size="sm" variant="outline" className="w-full mt-2 gap-1" onClick={() => setActiveTab("kalkulation")}>
                    Zur Kalkulation <ChevronRight className="w-3.5 h-3.5" />
                  </Button>
                </CardContent>
              </Card>
            )}
            {/* Unterlagen in Übersicht */}
            <div className="lg:col-span-1 space-y-4">
              <LVUploader project={project} onUpdate={handleLVUpdate} onTradesDetected={handleTradesDetected} />
              {project.lv_analysis_findings?.length > 0 && (
                <LVFindings
                  findings={project.lv_analysis_findings}
                  title={`KI-Befunde (${project.lv_analysis_findings.length})`}
                  onToggle={(id) => {
                    const updated = project.lv_analysis_findings.map((f) =>
                      f.id === id ? { ...f, include_in_report: !f.include_in_report } : f
                    );
                    handleLVUpdate({ lv_analysis_findings: updated });
                  }}
                  onToggleAll={(val) => {
                    const updated = project.lv_analysis_findings.map((f) => ({ ...f, include_in_report: val }));
                    handleLVUpdate({ lv_analysis_findings: updated });
                  }}
                />
              )}
              {project.baulv_conflict_findings?.length > 0 && (
                <LVFindings
                  findings={project.baulv_conflict_findings}
                  title={`Widersprüche Bau ↔ LV (${project.baulv_conflict_findings.length})`}
                  icon="conflict"
                  onToggle={(id) => {
                    const updated = project.baulv_conflict_findings.map((f) =>
                      f.id === id ? { ...f, include_in_report: !f.include_in_report } : f
                    );
                    handleLVUpdate({ baulv_conflict_findings: updated });
                  }}
                  onToggleAll={(val) => {
                    const updated = project.baulv_conflict_findings.map((f) => ({ ...f, include_in_report: val }));
                    handleLVUpdate({ baulv_conflict_findings: updated });
                  }}
                />
              )}
            </div>

            {!isPostAward && (
              <Card className="border-dashed border-muted-foreground/30">
                <CardContent className="py-6 flex items-start gap-3">
                  <Lock className="w-5 h-5 text-muted-foreground/50 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">AFU-Prüfung & Ausführung</p>
                    <p className="text-xs text-muted-foreground/70 mt-1">Diese Module werden nach Beauftragung freigeschaltet.</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* KALKULATION */}
        <TabsContent value="kalkulation" className="mt-6">
          <LVKalkulationView project={project} />
        </TabsContent>

        {/* AFU-PRÜFUNG */}
        <TabsContent value="afu" className="mt-6">
          {/* Internal AFU navigation */}
          <div className="flex gap-2 border-b border-border mb-6 overflow-x-auto">
            {[
              { key: "setup", label: "Gewerke & LV", icon: Settings },
              { key: "review", label: "Checkliste", icon: ClipboardCheck, disabled: project.afu_status === "ausstehend" && checklistItems.length === 0 },
              { key: "openpoints", label: "Offene Punkte", icon: AlertTriangle },
              { key: "result", label: "Ergebnis & Bericht", icon: BarChart3, disabled: checklistItems.length === 0 },
            ].map(({ key, label, icon: Icon, disabled }) => (
              <button key={key} onClick={() => !disabled && setAfuView(key)}
                disabled={disabled}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 transition-all -mb-px shrink-0 disabled:opacity-40 disabled:cursor-not-allowed ${
                  afuView === key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
                }`}>
                <Icon className="w-3.5 h-3.5" />{label}
              </button>
            ))}
          </div>

          {/* Setup */}
          {afuView === "setup" && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <TradeSelector selected={selectedTrades} onChange={handleTradesChange} />
              </div>
              <div className="space-y-4">
                <Card>
                  <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold">Projektdaten</CardTitle></CardHeader>
                  <CardContent className="space-y-2 text-xs">
                    <div className="flex justify-between"><span className="text-muted-foreground">Vertragsart</span><span className="font-medium">{project.contract_type || "–"}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">VOB/B</span><span className="font-medium">{project.vob_agreed ? "Ja" : "Nein"}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Planungsbüro</span><span className="font-medium">{project.planning_office || "–"}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Projektstart</span><span className="font-medium">{project.project_start ? format(new Date(project.project_start), "dd.MM.yyyy") : "–"}</span></div>
                  </CardContent>
                </Card>
                <Button className="w-full gap-2" onClick={handleStartReview}>
                  <Play className="w-4 h-4" />Prüfung starten
                </Button>
              </div>
            </div>
          )}

          {/* Review */}
          {afuView === "review" && (
            itemsLoading ? (
              <div className="space-y-3">{Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
            ) : checklistItems.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-sm text-muted-foreground">Bitte starten Sie die Prüfung im Reiter "Gewerke & LV"</p>
                  <Button size="sm" className="mt-4 gap-2" onClick={() => setAfuView("setup")}>
                    <Settings className="w-3.5 h-3.5" />Zu Gewerke & LV
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                <div className="lg:col-span-1">
                  <Card>
                    <CardContent className="p-2">
                      {selectedTrades.filter((t) => groupedItems[t]).map((t) => {
                        const tradeItems = checklistItems.filter((i) => i.trade === t && i.status !== "nicht_relevant");
                        const fulfilledCount = tradeItems.filter((i) => i.status === "erfuellt").length;
                        const pct = tradeItems.length > 0 ? Math.round((fulfilledCount / tradeItems.length) * 100) : 0;
                        return (
                          <button key={t} onClick={() => setActiveTrade(t)}
                            className={`w-full flex items-center justify-between p-2.5 rounded-lg text-xs font-medium transition-all ${
                              activeTrade === t ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"
                            }`}>
                            <span className="truncate">{TRADE_LABELS[t]}</span>
                            <span className={`shrink-0 ml-2 ${activeTrade === t ? "text-primary-foreground/80" : ""}`}>{pct}%</span>
                          </button>
                        );
                      })}
                    </CardContent>
                  </Card>
                </div>
                <div className="lg:col-span-3 space-y-6">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold">{TRADE_LABELS[activeTrade]}</h2>
                    <Button onClick={handleFinishReview} className="gap-2" size="sm">
                      <Save className="w-3.5 h-3.5" />Prüfung abschließen
                    </Button>
                  </div>
                  {groupedItems[activeTrade] && Object.entries(groupedItems[activeTrade]).map(([category, items]) => (
                    <ChecklistSection key={category} category={category} items={items}
                      onUpdateItem={(id, data) => updateItemMutation.mutate({ id, data })}
                      lvPositions={project?.lv_positions || []} />
                  ))}
                </div>
              </div>
            )
          )}

          {/* Open Points */}
          {afuView === "openpoints" && (
            <OpenPointsManager projectId={projectId} openPoints={openPoints} selectedTrades={selectedTrades} />
          )}

          {/* Result */}
          {afuView === "result" && (
            <div className="space-y-6">
              <div className="flex justify-end">
                <PdfReport project={project} checklistItems={checklistItems} openPoints={openPoints} />
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <ReviewSummary items={checklistItems} selectedTrades={selectedTrades} />
              </div>
            </div>
          )}
        </TabsContent>

        {/* AUSFÜHRUNG */}
        <TabsContent value="ausfuehrung" className="mt-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Link to={createPageUrl("Baustelle")}>
              <Card className="hover:shadow-md transition-all cursor-pointer">
                <CardContent className="p-6 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center">
                    <HardHat className="w-6 h-6 text-amber-600" />
                  </div>
                  <div>
                    <p className="font-semibold">Baustelle</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Bautagesberichte, Nachträge</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground ml-auto" />
                </CardContent>
              </Card>
            </Link>
            <Link to={createPageUrl("Abrechnung")}>
              <Card className="hover:shadow-md transition-all cursor-pointer">
                <CardContent className="p-6 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center">
                    <Receipt className="w-6 h-6 text-green-600" />
                  </div>
                  <div>
                    <p className="font-semibold">Abrechnung</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {rechnungen.length > 0
                        ? `${rechnungen.length} Rechnung(en) · ${totalRechnungen.toLocaleString("de-DE", { style: "currency", currency: "EUR" })} netto`
                        : "Rechnungen & Zahlungsverfolgung"}
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground ml-auto" />
                </CardContent>
              </Card>
            </Link>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}