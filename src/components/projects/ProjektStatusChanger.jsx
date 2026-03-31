import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown, Archive } from "lucide-react";

// Vereinfachte Status-Kette
const STATUS_FLOW = [
  { value: "kalkulation",   label: "In Kalkulation",      color: "bg-amber-100 text-amber-800" },
  { value: "eingereicht",   label: "Eingereicht",          color: "bg-blue-100 text-blue-800" },
  { value: "beauftragt",    label: "Beauftragt",           color: "bg-green-100 text-green-800" },
  { value: "abgeschlossen", label: "Abgeschlossen",        color: "bg-gray-100 text-gray-700" },
];

const ARCHIV_STATUS = { value: "verloren", label: "Verloren / Archivieren", color: "bg-destructive/10 text-destructive" };

export default function ProjektStatusChanger({ project, onUpdate }) {
  const [loading, setLoading] = useState(false);

  // Aktuellen Status finden – Fallback für alte Werte
  const normalized = project.status === "entwurf" ? "kalkulation"
    : project.status === "in_ausfuehrung" ? "beauftragt"
    : project.status;

  const current = [...STATUS_FLOW, ARCHIV_STATUS].find(s => s.value === normalized) || STATUS_FLOW[0];

  const handleChange = async (newStatus) => {
    setLoading(true);
    // "verloren" → automatisch archivieren
    const updates = { status: newStatus };
    if (newStatus === "verloren") updates.archiviert = true;
    await onUpdate(updates);
    setLoading(false);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 shrink-0" disabled={loading}>
          <span className={`inline-block w-2 h-2 rounded-full ${current.color.split(" ")[0]}`} />
          {current.label}
          <ChevronDown className="w-3 h-3 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Projektstatus</div>
        <DropdownMenuSeparator />
        {STATUS_FLOW.map(s => (
          <DropdownMenuItem
            key={s.value}
            disabled={s.value === normalized}
            onClick={() => handleChange(s.value)}
            className="gap-2 cursor-pointer"
          >
            <Badge className={`text-[10px] py-0 ${s.color}`}>{s.label}</Badge>
            {s.value === normalized && <span className="ml-auto text-[10px] text-muted-foreground">Aktuell</span>}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={normalized === "verloren"}
          onClick={() => handleChange("verloren")}
          className="gap-2 cursor-pointer text-destructive focus:text-destructive"
        >
          <Archive className="w-3.5 h-3.5" />
          {ARCHIV_STATUS.label}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}