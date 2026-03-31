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
import { ChevronDown } from "lucide-react";

const STATUS_FLOW = [
  { value: "entwurf",        label: "Entwurf",           color: "bg-secondary text-secondary-foreground" },
  { value: "kalkulation",    label: "Kalkulation",        color: "bg-blue-100 text-blue-700" },
  { value: "eingereicht",    label: "Eingereicht",        color: "bg-amber-100 text-amber-700" },
  { value: "beauftragt",     label: "Beauftragt",         color: "bg-green-100 text-green-700" },
  { value: "in_ausfuehrung", label: "In Ausführung",      color: "bg-primary/10 text-primary" },
  { value: "abgeschlossen",  label: "Abgeschlossen",      color: "bg-green-200 text-green-800" },
  { value: "verloren",       label: "Verloren / Abgesagt", color: "bg-red-100 text-red-700" },
];

export default function ProjektStatusChanger({ project, onUpdate }) {
  const [loading, setLoading] = useState(false);
  const current = STATUS_FLOW.find(s => s.value === project.status) || STATUS_FLOW[0];

  const handleChange = async (newStatus) => {
    setLoading(true);
    await onUpdate(newStatus);
    setLoading(false);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 shrink-0" disabled={loading}>
          <span className={`inline-block w-2 h-2 rounded-full ${current.color.replace("text-", "bg-").split(" ")[0]}`} />
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
            disabled={s.value === project.status}
            onClick={() => handleChange(s.value)}
            className="gap-2 cursor-pointer"
          >
            <Badge className={`text-[10px] py-0 ${s.color}`}>{s.label}</Badge>
            {s.value === project.status && <span className="ml-auto text-[10px] text-muted-foreground">Aktuell</span>}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}