import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { SEVERITY_COLORS, SEVERITY_LABELS } from "../checklistData";
import { Sparkles, CheckSquare, Square, GitCompare } from "lucide-react";

export default function LVFindings({ findings = [], onToggle, onToggleAll, title, icon }) {
  if (!findings.length) return null;

  const included = findings.filter((f) => f.include_in_report).length;
  const allOn = included === findings.length;
  const Icon = icon === "conflict" ? GitCompare : Sparkles;
  const iconColor = icon === "conflict" ? "text-orange-500" : "text-amber-500";
  const displayTitle = title || `KI-Befunde LV-Analyse (${findings.length})`;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Icon className={`w-4 h-4 ${iconColor}`} />
            {displayTitle}
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs h-7 gap-1"
            onClick={() => onToggleAll(!allOn)}
          >
            {allOn ? (
              <><CheckSquare className="w-3 h-3" /> Alle abwählen</>
            ) : (
              <><Square className="w-3 h-3" /> Alle wählen</>
            )}
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground mt-1">
          Wählen Sie, welche Befunde in den PDF-Bericht aufgenommen werden sollen.
          <span className="font-medium text-foreground"> {included} von {findings.length} ausgewählt.</span>
        </p>
      </CardHeader>
      <CardContent className="space-y-2">
        {findings.map((finding) => (
          <div
            key={finding.id}
            className={`flex items-start gap-3 p-2.5 rounded-lg border transition-all cursor-pointer ${
              finding.include_in_report
                ? "border-primary/20 bg-primary/5"
                : "border-border opacity-60"
            }`}
            onClick={() => onToggle(finding.id)}
          >
            <Checkbox
              checked={finding.include_in_report}
              className="mt-0.5 pointer-events-none"
            />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-foreground leading-snug">{finding.text}</p>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                <Badge
                  variant="outline"
                  className={`text-[9px] ${SEVERITY_COLORS[finding.severity]}`}
                >
                  {SEVERITY_LABELS[finding.severity]}
                </Badge>
                {finding.category && (
                  <Badge variant="outline" className="text-[9px]">
                    {finding.category}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}