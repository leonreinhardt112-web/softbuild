import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { useUnsavedChanges, UnsavedChangesProvider } from "@/components/common/UnsavedChangesContext";
import { base44 } from "@/api/base44Client";

import {
  LayoutDashboard,
  FolderOpen,
  BarChart3,
  Database,
  Menu,
  ChevronRight,
  ChevronDown,
  Building2,
  Mail,
  Users,
  Settings,
  BookOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { name: "Dashboard", page: "Dashboard", icon: LayoutDashboard },
  { name: "Projekte", page: "Projects", icon: FolderOpen },
  { name: "Postfächer", page: "Postfaecher", icon: Mail },
  { name: "Buchhaltung", page: "Buchhaltung", icon: BookOpen },
  { name: "Controlling", page: "Controlling", icon: BarChart3 },
  {
    name: "Stammdaten",
    icon: Database,
    group: true,
    children: [
      { name: "Stammdaten", page: "Stammdaten", icon: Database },
      { name: "Konfiguration", page: "Konfiguration", icon: Settings },
      { name: "Benutzer", page: "Benutzerverwaltung", icon: Users, adminOnly: true },
    ],
  },
];

const ALWAYS_VISIBLE = ["Dashboard", "Projects", "Postfaecher", "Benutzerverwaltung", "Stammdaten", "Konfiguration"];

function LayoutContent({ children, currentPageName }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem("sidebar_collapsed") === "true");

  const toggleCollapsed = () => {
    setCollapsed(v => {
      localStorage.setItem("sidebar_collapsed", String(!v));
      return !v;
    });
  };
  const [currentUser, setCurrentUser] = useState(null);
  const [navRechte, setNavRechte] = useState({});
  const [openGroups, setOpenGroups] = useState(["Stammdaten"]);
  const navigate = useNavigate();
  const { unsavedState, setUnsavedState } = useUnsavedChanges();

  // Track recently visited pages (with full path including query params)
  useEffect(() => {
    if (currentPageName) {
      const fullPath = currentPageName === "ProjectDetail"
        ? `ProjectDetail${window.location.search}`
        : currentPageName;
      const saved = JSON.parse(localStorage.getItem("recent_pages") || "[]");
      // Remove duplicates based on page name (not full path) for non-ProjectDetail, for ProjectDetail keep the specific one
      const filtered = saved.filter(p => {
        const baseName = p.split("?")[0];
        if (currentPageName === "ProjectDetail") return p !== fullPath;
        return baseName !== currentPageName;
      });
      const updated = [fullPath, ...filtered].slice(0, 10);
      localStorage.setItem("recent_pages", JSON.stringify(updated));
    }
  }, [currentPageName]);

  useEffect(() => {
    base44.auth.me().then(u => setCurrentUser(u)).catch(() => {});
    base44.entities.Stammdatum.filter({ typ: "unternehmen", aktiv: true }, undefined, 1)
      .then(list => { if (list?.[0]?.nav_rechte) setNavRechte(list[0].nav_rechte); })
      .catch(() => {});
  }, []);

  const handleNavigation = (e, page) => {
    if (unsavedState?.hasChanges) {
      e.preventDefault();
      setUnsavedState(prev => ({ ...prev, pendingPage: page }));
      return;
    }
    navigate(createPageUrl(page));
    setSidebarOpen(false);
  };

  const showDialog = unsavedState?.hasChanges;

  return (
    <>
      {showDialog && (
        <AlertDialog open={showDialog} onOpenChange={(open) => {
          if (!open) setUnsavedState(prev => ({ ...prev, hasChanges: false }));
        }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Ungespeicherte Änderungen</AlertDialogTitle>
              <AlertDialogDescription>
                Es gibt ungespeicherte Änderungen. Möchten Sie diese speichern, bevor Sie fortfahren?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setUnsavedState(prev => ({ ...prev, hasChanges: false }))}>
                Abbrechen
              </AlertDialogCancel>
              <Button variant="outline" onClick={() => {
                setUnsavedState(prev => ({ ...prev, hasChanges: false }));
                navigate(createPageUrl(unsavedState.pendingPage));
              }}>Verwerfen</Button>
              <AlertDialogAction onClick={() => {
                setUnsavedState(prev => ({ ...prev, hasChanges: false }));
                navigate(createPageUrl(unsavedState.pendingPage));
              }}>Speichern & Fortfahren</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
      <div className="min-h-screen bg-background flex">
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/40 z-40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        <aside
          className={cn(
            "fixed lg:sticky top-0 left-0 z-50 h-screen bg-card border-r border-border flex flex-col transition-all duration-300",
            collapsed ? "w-16" : "w-60",
            sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
          )}
        >
          {/* Logo */}
          <div className={cn("border-b border-border flex items-center", collapsed ? "p-2 justify-center" : "p-4")}>
            <div className="flex items-center gap-2.5 flex-1 min-w-0">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center shrink-0">
                <Building2 className="w-4 h-4 text-primary-foreground" />
              </div>
              {!collapsed && (
                <div className="min-w-0">
                  <h1 className="font-bold text-sm text-foreground leading-tight">BauManager</h1>
                  <p className="text-[10px] text-muted-foreground">Tiefbau Projektsteuerung</p>
                </div>
              )}
            </div>
            <button
              onClick={toggleCollapsed}
              className="hidden lg:flex items-center justify-center w-6 h-6 rounded hover:bg-accent text-muted-foreground shrink-0"
            >
              {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5 rotate-180" />}
            </button>
          </div>

          {/* Nav */}
          <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
            {NAV_ITEMS.map((item) => {
              if (item.group) {
                const isGroupOpen = openGroups.includes(item.name);
                const GroupIcon = item.icon;
                const visibleChildren = item.children.filter(child => {
                  if (child.adminOnly) return currentUser?.role === "admin";
                  if (currentUser?.role === "admin") return true;
                  if (ALWAYS_VISIBLE.includes(child.page)) return true;
                  const allowed = navRechte[child.page];
                  if (!allowed) return true;
                  return allowed.includes(currentUser?.role);
                });
                if (visibleChildren.length === 0) return null;
                const isChildActive = visibleChildren.some(c => c.page === currentPageName);
                if (collapsed) {
                  return visibleChildren.map(child => {
                    const isActive = currentPageName === child.page;
                    const CIcon = child.icon;
                    return (
                      <button key={child.page} onClick={(e) => handleNavigation(e, child.page)}
                        title={child.name}
                        className={cn("w-full flex items-center justify-center p-2.5 rounded-lg transition-all",
                          isActive ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-accent")}>
                        <CIcon className="w-4 h-4 shrink-0" />
                      </button>
                    );
                  });
                }
                return (
                  <div key={item.name}>
                    <button
                      onClick={() => setOpenGroups(g => g.includes(item.name) ? g.filter(x => x !== item.name) : [...g, item.name])}
                      className={cn("w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                        isChildActive ? "text-foreground bg-accent" : "text-muted-foreground hover:text-foreground hover:bg-accent")}>
                      <GroupIcon className="w-4 h-4 shrink-0" />
                      <span className="flex-1 truncate text-left">{item.name}</span>
                      {isGroupOpen ? <ChevronDown className="w-3 h-3 opacity-60" /> : <ChevronRight className="w-3 h-3 opacity-60" />}
                    </button>
                    {isGroupOpen && (
                      <div className="ml-3 mt-0.5 pl-3 border-l border-border space-y-0.5">
                        {visibleChildren.map(child => {
                          const isActive = currentPageName === child.page;
                          const CIcon = child.icon;
                          return (
                            <button key={child.page} onClick={(e) => handleNavigation(e, child.page)}
                              className={cn("w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all",
                                isActive ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-accent")}>
                              <CIcon className="w-3.5 h-3.5 shrink-0" />
                              <span className="flex-1 truncate text-left">{child.name}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              }

              if (item.adminOnly && currentUser?.role !== "admin") return null;
              if (!item.adminOnly && currentUser?.role !== "admin") {
                if (!ALWAYS_VISIBLE.includes(item.page)) {
                  const allowed = navRechte[item.page];
                  if (allowed && !allowed.includes(currentUser?.role)) return null;
                }
              }
              const isActive = currentPageName === item.page;
              const Icon = item.icon;
              if (collapsed) {
                return (
                  <button key={item.page} onClick={(e) => handleNavigation(e, item.page)}
                    title={item.name}
                    className={cn("w-full flex items-center justify-center p-2.5 rounded-lg transition-all",
                      isActive ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-accent")}>
                    <Icon className="w-4 h-4 shrink-0" />
                  </button>
                );
              }
              return (
                <button key={item.page} onClick={(e) => handleNavigation(e, item.page)}
                  className={cn("w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-all group",
                    isActive ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-accent")}>
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="flex-1 truncate text-left">{item.name}</span>
                  {isActive && <ChevronRight className="w-3 h-3 opacity-60" />}
                </button>
              );
            })}
          </nav>

          {/* Footer */}
          {!collapsed && (
          <div className="p-3 border-t border-border">
            <div className="text-[10px] text-muted-foreground text-center leading-relaxed">
              VOB/A · VOB/B · VOB/C<br />
              DIN 4124 · DIN EN 1610 · HOAI
            </div>
          </div>
          )}
        </aside>

        {/* Main */}
        <div className="flex-1 flex flex-col min-h-screen min-w-0">
          <header className="sticky top-0 z-30 bg-card/80 backdrop-blur-md border-b border-border px-4 py-3 lg:hidden flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(true)}>
              <Menu className="w-5 h-5" />
            </Button>
            <span className="font-semibold text-sm text-foreground">BauManager</span>
          </header>
          <main className="flex-1 p-4 md:p-6 lg:p-8 min-w-0">
            {children}
          </main>
        </div>
        </div>
        </>
        );
        }

export default function Layout({ children, currentPageName }) {
  return (
    <UnsavedChangesProvider>
      <LayoutContent children={children} currentPageName={currentPageName} />
    </UnsavedChangesProvider>
  );
}