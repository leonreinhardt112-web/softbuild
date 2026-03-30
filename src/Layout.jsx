import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { useUnsavedChanges, UnsavedChangesProvider } from "@/components/common/UnsavedChangesContext";
import { base44 } from "@/api/base44Client";

import {
  LayoutDashboard,
  FolderOpen,
  HardHat,
  Receipt,
  BarChart3,
  Database,
  Menu,
  X,
  ChevronRight,
  Building2,
  Mail,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { name: "Dashboard", page: "Dashboard", icon: LayoutDashboard },
  { name: "Projekte", page: "Projects", icon: FolderOpen },
  { name: "Schriftverkehr", page: "Schriftverkehr", icon: Mail },
  { name: "Baustelle", page: "Baustelle", icon: HardHat },
  { name: "Abrechnung", page: "Abrechnung", icon: Receipt },
  { name: "Controlling", page: "Controlling", icon: BarChart3 },
  { name: "Stammdaten", page: "Stammdaten", icon: Database },
  { name: "Benutzer", page: "Benutzerverwaltung", icon: Users, adminOnly: true },
];

function LayoutContent({ children, currentPageName }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const navigate = useNavigate();
  const { unsavedState, setUnsavedState } = useUnsavedChanges();

  useEffect(() => {
    base44.auth.me().then(u => setCurrentUser(u)).catch(() => {});
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
            "fixed lg:sticky top-0 left-0 z-50 h-screen w-60 bg-card border-r border-border flex flex-col transition-transform duration-300",
            sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
          )}
        >
          {/* Logo */}
          <div className="p-4 border-b border-border">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center shrink-0">
                <Building2 className="w-4 h-4 text-primary-foreground" />
              </div>
              <div>
                <h1 className="font-bold text-sm text-foreground leading-tight">BauManager</h1>
                <p className="text-[10px] text-muted-foreground">Tiefbau Projektsteuerung</p>
              </div>
            </div>
          </div>

          {/* Nav */}
          <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
            {NAV_ITEMS.filter(item => !item.adminOnly || currentUser?.role === "admin").map((item) => {
              const isActive = currentPageName === item.page;
              const Icon = item.icon;
              return (
                <button
                  key={item.page}
                  onClick={(e) => handleNavigation(e, item.page)}
                  className={cn(
                    "w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-all group",
                    isActive
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent"
                  )}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="flex-1 truncate text-left">{item.name}</span>
                  {isActive && <ChevronRight className="w-3 h-3 opacity-60" />}
                </button>
              );
            })}
          </nav>

          {/* Footer */}
          <div className="p-3 border-t border-border">
            <div className="text-[10px] text-muted-foreground text-center leading-relaxed">
              VOB/A · VOB/B · VOB/C<br />
              DIN 4124 · DIN EN 1610 · HOAI
            </div>
          </div>
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