import React, { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Search, List } from "lucide-react";

export default function LVPositionPicker({ positions = [], selectedOZs = [], onChange }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = positions.filter(
    (p) =>
      p.oz?.toLowerCase().includes(search.toLowerCase()) ||
      p.short_text?.toLowerCase().includes(search.toLowerCase())
  );

  const toggle = (oz) => {
    if (selectedOZs.includes(oz)) {
      onChange(selectedOZs.filter((o) => o !== oz));
    } else {
      onChange([...selectedOZs, oz]);
    }
  };

  if (!positions.length) return null;

  return (
    <>
      <div
        className="mt-2 flex items-center gap-2 text-xs text-primary cursor-pointer hover:underline"
        onClick={() => setOpen(true)}
      >
        <List className="w-3.5 h-3.5" />
        {selectedOZs.length > 0
          ? `${selectedOZs.length} LV-Position(en) verknüpft: ${selectedOZs.join(", ")}`
          : "LV-Positionen verknüpfen…"}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-base">LV-Positionen verknüpfen</DialogTitle>
          </DialogHeader>

          <div className="relative my-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Suchen nach OZ oder Kurztext…"
              className="pl-9 h-8 text-xs"
            />
          </div>

          <div className="flex-1 overflow-y-auto space-y-1 pr-1">
            {filtered.map((pos) => (
              <div
                key={pos.oz}
                className={`flex items-start gap-3 p-2 rounded-lg border cursor-pointer transition-all ${
                  selectedOZs.includes(pos.oz)
                    ? "border-primary/30 bg-primary/5"
                    : "border-border hover:bg-accent/40"
                }`}
                onClick={() => toggle(pos.oz)}
              >
                <Checkbox
                  checked={selectedOZs.includes(pos.oz)}
                  className="mt-0.5 pointer-events-none shrink-0"
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="text-[9px] font-mono shrink-0">
                      OZ {pos.oz}
                    </Badge>
                    {pos.quantity && pos.unit && (
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {pos.quantity} {pos.unit}
                      </span>
                    )}
                  </div>
                  <p className="text-xs mt-0.5 text-foreground leading-snug">{pos.short_text}</p>
                </div>
              </div>
            ))}
            {filtered.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-8">
                Keine Positionen gefunden
              </p>
            )}
          </div>

          <DialogFooter>
            <Button size="sm" onClick={() => setOpen(false)}>
              Übernehmen ({selectedOZs.length} gewählt)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}