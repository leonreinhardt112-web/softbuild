import React from "react";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SEVERITY_COLORS, SEVERITY_LABELS } from "../checklistData";
import { CheckCircle2, XCircle, CircleDot, MinusCircle } from "lucide-react";
import LVPositionPicker from "../lv/LVPositionPicker";

const STATUS_OPTIONS = [
  { value: "offen", label: "Offen", icon: CircleDot, color: "text-muted-foreground" },
  { value: "erfuellt", label: "Erfüllt", icon: CheckCircle2, color: "text-green-600" },
  { value: "nicht_erfuellt", label: "Nicht erfüllt", icon: XCircle, color: "text-destructive" },
  { value: "nicht_relevant", label: "Nicht relevant", icon: MinusCircle, color: "text-muted-foreground" },
];

// Questions that benefit from LV-position linking
const LV_QUESTIONS = [
  "Leistungsverzeichnis vollständig und schlüssig?",
];

export default function ChecklistSection({ category, items, onUpdateItem, lvPositions = [] }) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-foreground border-b border-border pb-2">
        {category}
      </h3>
      <div className="space-y-2">
        {items.map((item) => {
          const currentStatus = STATUS_OPTIONS.find((s) => s.value === item.status);
          const StatusIcon = currentStatus?.icon || CircleDot;
          const isLvItem = LV_QUESTIONS.some((q) =>
            item.question?.toLowerCase().includes(q.toLowerCase().slice(0, 20))
          );
          const hasLvPositions = lvPositions.length > 0;

          return (
            <div
              key={item.id}
              className={`rounded-lg border p-3 transition-all ${
                item.status === "nicht_erfuellt"
                  ? "border-destructive/30 bg-destructive/5"
                  : item.status === "erfuellt"
                  ? "border-green-200 bg-green-50/50"
                  : "border-border"
              }`}
            >
              <div className="flex flex-col md:flex-row md:items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-start gap-2">
                    <StatusIcon
                      className={`w-4 h-4 mt-0.5 shrink-0 ${currentStatus?.color}`}
                    />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-foreground leading-snug">
                        {item.question}
                      </p>
                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                        <Badge
                          variant="outline"
                          className={`text-[10px] ${SEVERITY_COLORS[item.severity]}`}
                        >
                          {SEVERITY_LABELS[item.severity]}
                        </Badge>
                        {item.norm_reference && (
                          <Badge variant="outline" className="text-[10px]">
                            {item.norm_reference}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 md:w-44 shrink-0">
                  <Select
                    value={item.status}
                    onValueChange={(val) => onUpdateItem(item.id, { status: val })}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          <span className="flex items-center gap-1.5">
                            <opt.icon className={`w-3 h-3 ${opt.color}`} />
                            {opt.label}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Comment + optional LV position picker */}
              {(item.status === "nicht_erfuellt" || item.comment || item.lv_positions_ref?.length > 0) && (
                <div className="mt-2 ml-6 space-y-2">
                  <Textarea
                    placeholder="Kommentar / Anmerkung..."
                    value={item.comment || ""}
                    onChange={(e) =>
                      onUpdateItem(item.id, { comment: e.target.value })
                    }
                    className="text-xs h-16 resize-none"
                  />
                  {isLvItem && hasLvPositions && (
                    <LVPositionPicker
                      positions={lvPositions}
                      selectedOZs={item.lv_positions_ref || []}
                      onChange={(ozs) => onUpdateItem(item.id, { lv_positions_ref: ozs })}
                    />
                  )}
                </div>
              )}

              {/* Show LV picker button even when status is not 'nicht_erfuellt' */}
              {!(item.status === "nicht_erfuellt" || item.comment || item.lv_positions_ref?.length > 0) &&
                isLvItem && hasLvPositions && (
                  <div className="mt-1 ml-6">
                    <LVPositionPicker
                      positions={lvPositions}
                      selectedOZs={item.lv_positions_ref || []}
                      onChange={(ozs) => onUpdateItem(item.id, { lv_positions_ref: ozs })}
                    />
                  </div>
                )}
            </div>
          );
        })}
      </div>
    </div>
  );
}