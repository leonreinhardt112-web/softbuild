import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TRADE_LABELS, SEVERITY_LABELS, SEVERITY_COLORS } from "../checklistData";
import { Plus, Trash2, AlertTriangle } from "lucide-react";

export default function OpenPointsManager({ projectId, openPoints, selectedTrades }) {
  const [showAdd, setShowAdd] = useState(false);
  const [newPoint, setNewPoint] = useState({
    description: "",
    trade: "allgemein",
    severity: "wichtig",
    responsible: "",
    due_date: "",
    norm_reference: "",
  });
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.OpenPoint.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["openpoints", projectId] });
      setNewPoint({
        description: "",
        trade: "allgemein",
        severity: "wichtig",
        responsible: "",
        due_date: "",
        norm_reference: "",
      });
      setShowAdd(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.OpenPoint.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["openpoints", projectId] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.OpenPoint.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["openpoints", projectId] });
    },
  });

  const handleAdd = () => {
    createMutation.mutate({
      ...newPoint,
      project_id: projectId,
      status: "offen",
    });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          Offene Punkte ({openPoints.length})
        </CardTitle>
        <Button size="sm" variant="outline" className="gap-1" onClick={() => setShowAdd(!showAdd)}>
          <Plus className="w-3 h-3" />
          Hinzufügen
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {showAdd && (
          <div className="p-3 border rounded-lg bg-accent/30 space-y-3">
            <Textarea
              placeholder="Beschreibung des offenen Punktes..."
              value={newPoint.description}
              onChange={(e) => setNewPoint({ ...newPoint, description: e.target.value })}
              className="h-16 resize-none text-sm"
            />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <Select
                value={newPoint.trade}
                onValueChange={(v) => setNewPoint({ ...newPoint, trade: v })}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {selectedTrades.map((t) => (
                    <SelectItem key={t} value={t}>
                      {TRADE_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={newPoint.severity}
                onValueChange={(v) => setNewPoint({ ...newPoint, severity: v })}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="kritisch">Kritisch</SelectItem>
                  <SelectItem value="wichtig">Wichtig</SelectItem>
                  <SelectItem value="hinweis">Hinweis</SelectItem>
                </SelectContent>
              </Select>
              <Input
                placeholder="Verantwortlich"
                value={newPoint.responsible}
                onChange={(e) => setNewPoint({ ...newPoint, responsible: e.target.value })}
                className="h-8 text-xs"
              />
              <Input
                type="date"
                value={newPoint.due_date}
                onChange={(e) => setNewPoint({ ...newPoint, due_date: e.target.value })}
                className="h-8 text-xs"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={() => setShowAdd(false)}>
                Abbrechen
              </Button>
              <Button size="sm" onClick={handleAdd} disabled={!newPoint.description}>
                Speichern
              </Button>
            </div>
          </div>
        )}

        {openPoints.length === 0 && !showAdd ? (
          <p className="text-xs text-muted-foreground text-center py-6">
            Keine offenen Punkte vorhanden
          </p>
        ) : (
          openPoints.map((point) => (
            <div
              key={point.id}
              className="flex items-start gap-2 p-2.5 rounded-lg border border-border"
            >
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium">{point.description}</p>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  <Badge
                    variant="outline"
                    className={`text-[9px] ${SEVERITY_COLORS[point.severity]}`}
                  >
                    {SEVERITY_LABELS[point.severity]}
                  </Badge>
                  <Badge variant="outline" className="text-[9px]">
                    {TRADE_LABELS[point.trade] || point.trade}
                  </Badge>
                  {point.responsible && (
                    <Badge variant="outline" className="text-[9px]">
                      {point.responsible}
                    </Badge>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Select
                  value={point.status}
                  onValueChange={(v) => updateMutation.mutate({ id: point.id, data: { status: v } })}
                >
                  <SelectTrigger className="h-7 text-[10px] w-28">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="offen">Offen</SelectItem>
                    <SelectItem value="in_bearbeitung">In Bearbeitung</SelectItem>
                    <SelectItem value="erledigt">Erledigt</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-destructive"
                  onClick={() => deleteMutation.mutate(point.id)}
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}