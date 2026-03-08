import React from "react";
import { TRADES } from "../checklistData";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Lock } from "lucide-react";

export default function TradeSelector({ selected, onChange }) {
  const handleToggle = (tradeId) => {
    const trade = TRADES.find((t) => t.id === tradeId);
    if (trade.required) return;

    if (selected.includes(tradeId)) {
      onChange(selected.filter((id) => id !== tradeId));
    } else {
      onChange([...selected, tradeId]);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold">Gewerke auswählen</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2.5">
        {TRADES.map((trade) => {
          const isSelected = selected.includes(trade.id);
          return (
            <div
              key={trade.id}
              className={`flex items-center gap-3 p-2.5 rounded-lg border transition-all cursor-pointer ${
                isSelected
                  ? "border-primary/30 bg-primary/5"
                  : "border-border hover:border-border/80 hover:bg-accent/50"
              } ${trade.required ? "cursor-default" : ""}`}
              onClick={() => handleToggle(trade.id)}
            >
              <Checkbox
                checked={isSelected}
                disabled={trade.required}
                className="pointer-events-none"
              />
              <Label className="flex-1 cursor-pointer text-sm font-medium">
                {trade.label}
              </Label>
              {trade.required && (
                <Badge variant="outline" className="text-[10px] gap-1">
                  <Lock className="w-2.5 h-2.5" />
                  Pflicht
                </Badge>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}