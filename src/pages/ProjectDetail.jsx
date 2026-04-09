import React, { useState, useMemo, useRef, useEffect } from "react";
import ErrorBoundary from "@/components/common/ErrorBoundary";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { useUnsavedChanges } from "@/components/common/UnsavedChangesContext";
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
import LVAnalyseErgebnisse from "@/components/lv/LVAnalyseErgebnisse";
import LVKalkulationView from "@/components/kalkulation/LVKalkulationView";
import FristenTab from "@/components/projektakte/FristenTab";
import DokumenteTab from "@/components/projektakte/DokumenteTab";
import SchriftverkehrTab from "@/components/projektakte/SchriftverkehrTab";
import AufgabenTab from "@/components/projektakte/AufgabenTab";
import {
  CHECKLIST_TEMPLATES,
  TRADE_LABELS,
  STATUS_LABELS,
  STATUS_COLORS,
} from "@/components/checklistData";
import { parseISO, isPast } from "date-fns";
import {
  ArrowLeft, ClipboardCheck, Settings, BarChart3, AlertTriangle, Play, Save,
  Building2, MapPin, Calendar, User, Calculator, Receipt, HardHat,
  Euro, Clock, Lock, ChevronRight, FolderOpen, FileText, AlarmClock, Mail, ListTodo, TrendingUp,
} from "lucide-react";
import ProjektAbrechnung from "@/components/abrechnung/ProjektAbrechnung";
import ProjektStatusChanger from "@/components/projects/ProjektStatusChanger";
import KalkulationTabContent from "@/components/kalkulation/KalkulationTabContent";
import EingangsrechnungenTab from "@/components/projektakte/EingangsrechnungenTab";
import { format, isValid } from "date-fns";

const safeFormat = (dateStr, fmt) => {
  if (!dateStr) return "–";
  try {
    const d = typeof dateStr === "string" ? parseISO(dateStr) : new Date(dateStr);
    return isValid(d) ? format(d, fmt) : "–";
  } catch { return "–"; }
};

const POST_AWARD_STATUSES = ["beauftragt", "in_ausfuehrung", "abgeschlossen"];

export default function ProjectDetail() {
  const urlParams = new URLSearchParams(window.location.search);
  const projectId = urlParams.get("id");
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { setUnsavedState } = useUnsavedChanges();
  const [activeTab, setActiveTab] = useState(() => {
    return localStorage.getItem(`project_${projectId}_tab`) || "overview";
  });
  const [pendingTab, setPendingTab] = useState(null);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState(null);
  const kalkulationRef = useRef(null);
  // AFU internal view
  const [afuView, setAfuView] = useState("setup"); // setup | review | openpoints | result
  const [activeTrade, setActiveTrade] = useState("allgemein");

  // Update global unsaved state
  useEffect(() => {
    const hasDirty = activeTab === "kalkulation" && kalkulationRef.current?.hasDirtyChanges();
    setUnsavedState(prev => ({ ...prev, hasChanges: hasDirty }));
  }, [activeTab, setUnsavedState]);

  // Guard navigation away from ProjectDetail
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (activeTab === "kalkulation" && kalkulationRef.current?.hasDirtyChanges()) {
        e.preventDefault();
        e.returnValue = "";
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [activeTab]);

  const handleTabChange = (newTab) => {
    if (activeTab === "kalkulation" && newTab !== "kalkulation") {
      if (kalkulationRef.current?.hasDirtyChanges()) {
        setPendingTab(newTab);
        setShowUnsavedDialog(true);
        return;
      }
    }
    localStorage.setItem(`project_${projectId}_tab`, newTab);
    setActiveTab(newTab);
  };

  const handleDiscardAndSwitch = () => {
    setShowUnsavedDialog(false);
    setUnsavedState(prev => ({ ...prev, hasChanges: false }));
    if (pendingNavigation) {
      pendingNavigation();
      setPendingNavigation(null);
    } else if (pendingTab) {
      setActiveTab(pendingTab);
      setPendingTab(null);
    }
  };

  const handleSaveAndSwitch = async () => {
    await kalkulationRef.current?.saveAll();
    setShowUnsavedDialog(false);
    setUnsavedState(prev => ({ ...prev, hasChanges: false }));
    if (pendingNavigation) {
      pendingNavigation();
      setPendingNavigation(null);
    } else if (pendingTab) {
      setActiveTab(pendingTab);
      setPendingTab(null);
    }
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

  const { data: fristen = [] } = useQuery({
    queryKey: ["fristen", projectId],
    queryFn: () => base44.entities.ProjektFrist.filter({ project_id: projectId }),
    enabled: !!projectId,
  });

  const { data: dokumente = [] } = useQuery({
    queryKey: ["dokumente", projectId],
    queryFn: () => base44.entities.ProjektDokument.filter({ project_id: projectId }),
    enabled: !!projectId,
  });

  const { data: schriftverkehr = [] } = useQuery({
    queryKey: ["schriftverkehr", projectId],
    queryFn: () => base44.entities.SchriftverkehrEintrag.filter({ project_id: projectId }),
    enabled: !!projectId,
  });

  const { data: aufgaben = [] } = useQuery({
    queryKey: ["aufgaben", projectId],
    queryFn: () => base44.entities.Aufgabe.filter({ project_id: projectId }),
    enabled: !!projectId,
  });

  const { data: stundenstaende = [] } = useQuery({
    queryKey: ["stundenstand", projectId],
    queryFn: () => base44.entities.ProjektStundenstand.filter({ project_id: projectId }, "-import_datum"),
    enabled: !!projectId,
  });

  const { data: stammdaten = [] } = useQuery({
    queryKey: ["stammdaten-unternehmen"],
    queryFn: () => base44.entities.Stammdatum.filter({ typ: "unternehmen", aktiv: true }),
  });

  const [currentUser, setCurrentUser] = useState(null);
  useEffect(() => { base44.auth.me().then(u => setCurrentUser(u)).catch(() => {}); }, []);

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
    <ErrorBoundary message="Das Projekt konnte nicht geladen werden. Bei sehr großen LV-Dateien kann es zu Problemen kommen.">
    <div className="max-w-6xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
      <div className="flex items-start gap-3">
        <Button variant="ghost" size="icon" className="mt-0.5" onClick={() => {
          if (activeTab === "kalkulation" && kalkulationRef.current?.hasDirtyChanges()) {
            setPendingNavigation(() => () => navigate(createPageUrl("Projects")));
            setShowUnsavedDialog(true);
          } else {
            navigate(createPageUrl("Projects"));
          }
        }}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
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
            {project.review_date && <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{safeFormat(project.review_date, "dd.MM.yyyy")}</span>}
          </div>
        </div>
      </div>
      {/* Projektstatus ändern */}
      <ProjektStatusChanger project={project} onUpdate={(updates) => updateProjectMutation.mutate(updates)} />
      </div>

      {/* Unsaved-changes guard */}
      <AlertDialog open={showUnsavedDialog} onOpenChange={setShowUnsavedDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ungespeicherte Änderungen</AlertDialogTitle>
            <AlertDialogDescription>
              Es gibt ungespeicherte Kalkulations-Änderungen. Möchten Sie diese speichern, bevor Sie den Tab wechseln?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setShowUnsavedDialog(false); setPendingTab(null); setPendingNavigation(null); }}>
              Abbrechen
            </AlertDialogCancel>
            <Button variant="outline" onClick={handleDiscardAndSwitch}>Verwerfen</Button>
            <AlertDialogAction onClick={handleSaveAndSwitch}>Speichern & Wechseln</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="overview" className="gap-1.5 text-xs">
            <FolderOpen className="w-3.5 h-3.5" />Übersicht
          </TabsTrigger>
          <TabsTrigger value="dokumente" className="gap-1.5 text-xs">
            <FileText className="w-3.5 h-3.5" />Dokumente
            {dokumente.length > 0 && <span className="ml-1 text-[10px] bg-primary/10 text-primary px-1 rounded">{dokumente.length}</span>}
          </TabsTrigger>
          <TabsTrigger value="kalkulation" className="gap-1.5 text-xs">
            <Calculator className="w-3.5 h-3.5" />Kalkulation
          </TabsTrigger>
          <TabsTrigger value="schriftverkehr" className="gap-1.5 text-xs">
            <Mail className="w-3.5 h-3.5" />Schriftverkehr
            {schriftverkehr.filter(s=>s.status!=="erledigt").length > 0 && <span className="ml-1 text-[10px] bg-blue-100 text-blue-700 px-1 rounded">{schriftverkehr.filter(s=>s.status!=="erledigt").length}</span>}
          </TabsTrigger>
          <TabsTrigger value="aufgaben" className="gap-1.5 text-xs">
            <ListTodo className="w-3.5 h-3.5" />Aufgaben
            {aufgaben.filter(a=>!["erledigt","verworfen"].includes(a.status)).length > 0 && <span className="ml-1 text-[10px] bg-primary/10 text-primary px-1 rounded">{aufgaben.filter(a=>!["erledigt","verworfen"].includes(a.status)).length}</span>}
          </TabsTrigger>
          {isPostAward && (
            <TabsTrigger value="eingangsrechnungen" className="gap-1.5 text-xs">
              <Receipt className="w-3.5 h-3.5" />Eingangsrechnungen
            </TabsTrigger>
          )}
          {isPostAward && (
            <TabsTrigger value="afu" className="gap-1.5 text-xs">
              <ClipboardCheck className="w-3.5 h-3.5" />AFU-Prüfung
            </TabsTrigger>
          )}

          {isPostAward && (
            <TabsTrigger value="abrechnung" className="gap-1.5 text-xs">
              <Receipt className="w-3.5 h-3.5" />Abrechnung
              {rechnungen.length > 0 && <span className="ml-1 text-[10px] bg-green-100 text-green-700 px-1 rounded">{rechnungen.length}</span>}
            </TabsTrigger>
          )}
        </TabsList>

        {/* OVERVIEW */}
        <TabsContent value="overview" className="mt-6">
          {(() => {
            const auftragssumme = project.auftragssumme_netto || project.auftragssumme || 0;
            const abgerechnet = rechnungen.filter(r => ["gestellt","teilbezahlt","bezahlt"].includes(r.status))
              .reduce((s, r) => s + (r.betrag_netto || 0), 0);
            const offen = Math.max(0, auftragssumme - abgerechnet);
            const finanzPct = auftragssumme > 0 ? Math.min(100, Math.round((abgerechnet / auftragssumme) * 100)) : 0;
            const fmt = (n) => n.toLocaleString("de-DE", { style: "currency", currency: "EUR" });
            const offeneFristen = fristen.filter(f => f.status !== "erledigt").length;
            const ueberfaelligFristen = fristen.filter(f => f.status !== "erledigt" && f.datum && isPast(parseISO(f.datum))).length;
            const offenerSchriftverkehr = schriftverkehr.filter(s => s.status !== "erledigt").length;
            const offeneAufgaben = aufgaben.filter(a => !["erledigt","verworfen"].includes(a.status)).length;
            const bauPct = project.fortschritt_prozent_manuell || 0;
            const latestStunden = stundenstaende[0];
            // Kalkulierte Stunden: Summe aller Lohnzeilen (Menge * kosten_einheit) aus der beauftragten Kalkulation
            const beauftragteKalk = kalkulationen.find(k => k.status === "beauftragt") || kalkulationen[0];
            const kalkulierteStundenAusKalk = (() => {
              if (!beauftragteKalk?.positions) return 0;
              return beauftragteKalk.positions.reduce((total, pos) => {
                const lohnRows = (pos.rows || []).filter(r => r.kostentyp === "Lohn");
                return total + lohnRows.reduce((s, r) => s + (Number(r.menge || 0)), 0);
              }, 0);
            })();
            const kalkulierteStunden = project.kalkulierte_stunden_manuell || kalkulierteStundenAusKalk;
            const gebuchteStunden = latestStunden?.gebuchte_stunden_gesamt || 0;
            const stundenPct = kalkulierteStunden > 0 ? Math.min(100, Math.round((gebuchteStunden / kalkulierteStunden) * 100)) : 0;

            // SVG Progress Ring
            const Ring = ({ pct, color, label, sub }) => {
              const r = 28; const c = 2 * Math.PI * r;
              const dash = (pct / 100) * c;
              return (
                <Card>
                  <CardContent className="p-4 flex items-center gap-4">
                    <svg width="72" height="72" viewBox="0 0 72 72" className="shrink-0">
                      <circle cx="36" cy="36" r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth="6" />
                      <circle cx="36" cy="36" r={r} fill="none" stroke={color} strokeWidth="6"
                        strokeDasharray={`${dash} ${c}`} strokeDashoffset={c / 4}
                        strokeLinecap="round" transform="rotate(-90 36 36)" style={{ transition: "stroke-dasharray 0.5s" }} />
                      <text x="36" y="40" textAnchor="middle" fontSize="14" fontWeight="700" fill="currentColor">{pct}%</text>
                    </svg>
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">{label}</p>
                      <p className="text-sm font-semibold mt-0.5 truncate">{sub}</p>
                    </div>
                  </CardContent>
                </Card>
              );
            };

            return (
              <div className="space-y-6">

                {/* === POST-AWARD: Finanz-KPIs mit Progress-Ring + Stunden === */}
                {isPostAward && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Ring pct={finanzPct} color="hsl(var(--primary))"
                      label={`Abgerechnet: ${fmt(abgerechnet)} von ${auftragssumme ? fmt(auftragssumme) : "–"}`}
                      sub={`${fmt(offen)} noch offen`} />
                    <Ring pct={stundenPct} color={stundenPct > 90 ? "#ef4444" : stundenPct > 70 ? "#f59e0b" : "#22c55e"}
                      label="Stunden"
                      sub={kalkulierteStunden > 0 ? `${gebuchteStunden}h gebucht / ${kalkulierteStunden}h kalk.` : "Keine kalk. Stunden hinterlegt"} />
                  </div>
                )}

                {/* === POST-AWARD: 4 nützliche KPI-Karten === */}
                {isPostAward && (
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {[
                      { title: "Noch nicht abgerechnet", value: fmt(offen), sub: auftragssumme ? `von ${fmt(auftragssumme)} AS` : undefined, icon: Euro, accent: "bg-amber-50", iconColor: "text-amber-600" },
                      { title: "Schriftverkehr offen", value: offenerSchriftverkehr, icon: Mail, accent: "bg-blue-50", iconColor: "text-blue-600" },
                      { title: "Offene Fristen", value: offeneFristen, sub: ueberfaelligFristen > 0 ? `${ueberfaelligFristen} überfällig` : "Alle im Plan", icon: AlarmClock, accent: ueberfaelligFristen > 0 ? "bg-red-50" : "bg-amber-50", iconColor: ueberfaelligFristen > 0 ? "text-red-500" : "text-amber-600" },
                      { title: "Offene Aufgaben", value: offeneAufgaben, icon: ListTodo, accent: "bg-primary/10", iconColor: "text-primary" },
                    ].map(({ title, value, sub, icon: Icon, accent, iconColor }) => (
                      <Card key={title}>
                        <CardContent className="p-4 flex items-start gap-3">
                          <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${accent}`}>
                            <Icon className={`w-4 h-4 ${iconColor}`} />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs text-muted-foreground">{title}</p>
                            <p className="text-base font-bold mt-0.5 truncate">{value}</p>
                            {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}

                {/* === PRE-AWARD: Einfache Status-Karten === */}
                {!isPostAward && (
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {[
                      { title: "Offene Fristen", value: offeneFristen, sub: ueberfaelligFristen > 0 ? `${ueberfaelligFristen} überfällig` : undefined, icon: AlarmClock, accent: ueberfaelligFristen > 0 ? "bg-red-50" : "bg-amber-50", iconColor: ueberfaelligFristen > 0 ? "text-red-500" : "text-amber-600" },
                      { title: "Offene Aufgaben", value: offeneAufgaben, icon: ListTodo, accent: "bg-primary/10", iconColor: "text-primary" },
                      { title: "Schriftverkehr offen", value: offenerSchriftverkehr, icon: Mail, accent: "bg-blue-50", iconColor: "text-blue-600" },
                      { title: "Dokumente", value: dokumente.length, icon: FileText, accent: "bg-muted", iconColor: "text-muted-foreground" },
                    ].map(({ title, value, sub, icon: Icon, accent, iconColor }) => (
                      <Card key={title}>
                        <CardContent className="p-4 flex items-start gap-3">
                          <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${accent}`}>
                            <Icon className={`w-4 h-4 ${iconColor}`} />
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">{title}</p>
                            <p className="text-base font-bold mt-0.5">{value}</p>
                            {sub && <p className="text-xs text-red-500 mt-0.5">{sub}</p>}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}

                {/* Projektdaten + Termine */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
                        ["Projektstart", project.project_start],
                        ["Projektende (geplant)", project.project_end],
                        ...(isPostAward ? [["Prüfdatum AFU", project.review_date]] : []),
                      ].map(([label, value]) => (
                        <div key={label} className="flex justify-between gap-4">
                          <span className="text-muted-foreground shrink-0">{label}</span>
                          <span className={`font-medium ${!value ? "text-muted-foreground" : ""}`}>
                            {safeFormat(value, "dd.MM.yyyy")}
                          </span>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                </div>
              </div>
            );
          })()}
        </TabsContent>

        {/* DOKUMENTE */}
        <TabsContent value="dokumente" className="mt-6">
          <DokumenteTab
            projectId={projectId}
            dokumente={dokumente}
            project={project}
            onProjectUpdate={handleLVUpdate}
          />
        </TabsContent>

        {/* FRISTEN */}
        <TabsContent value="fristen" className="mt-6">
          <FristenTab projectId={projectId} fristen={fristen} />
        </TabsContent>

        {/* SCHRIFTVERKEHR */}
        <TabsContent value="schriftverkehr" className="mt-6">
          <SchriftverkehrTab projectId={projectId} eintraege={schriftverkehr} />
        </TabsContent>

        {/* AUFGABEN */}
        <TabsContent value="aufgaben" className="mt-6">
          <AufgabenTab projectId={projectId} aufgaben={aufgaben} currentUser={currentUser} />
        </TabsContent>

        {/* KALKULATION */}
        <TabsContent value="kalkulation" className="mt-6">
          <ErrorBoundary message="Die Kalkulation konnte nicht geladen werden. Das LV könnte zu groß sein.">
          <KalkulationTabContent
            project={project}
            projectId={projectId}
            kalkulationRef={kalkulationRef}
            handleLVUpdate={handleLVUpdate}
            handleTradesDetected={handleTradesDetected}
            queryClient={queryClient}
          />
          </ErrorBoundary>
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
                    <div className="flex justify-between"><span className="text-muted-foreground">Projektstart</span><span className="font-medium">{safeFormat(project.project_start, "dd.MM.yyyy")}</span></div>
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

        {/* EINGANGSRECHNUNGEN (Bauleiter-Prüfung) */}
        <TabsContent value="eingangsrechnungen" className="mt-6">
          <EingangsrechnungenTab projectId={projectId} currentUser={currentUser} />
        </TabsContent>

        {/* ABRECHNUNG */}
        <TabsContent value="abrechnung" className="mt-6">
          <ProjektAbrechnung project={project} kalkulationen={kalkulationen} stammdaten={stammdaten} />
        </TabsContent>
      </Tabs>
    </div>
    </ErrorBoundary>
  );
}