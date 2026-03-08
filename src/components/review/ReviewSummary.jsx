import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TRADE_LABELS, SEVERITY_LABELS, SEVERITY_COLORS } from "../checklistData";
import { CheckCircle2, XCircle, AlertTriangle, Shield } from "lucide-react";

export default function ReviewSummary({ items, selectedTrades }) {
  const totalItems = items.filter((i) => i.status !== "nicht_relevant").length;
  const fulfilled = items.filter((i) => i.status === "erfuellt").length;
  const notFulfilled = items.filter((i) => i.status === "nicht_erfuellt").length;
  const open = items.filter((i) => i.status === "offen").length;
  const criticalFailed = items.filter(
    (i) => i.status === "nicht_erfuellt" && i.severity === "kritisch"
  ).length;

  const score = totalItems > 0 ? Math.round((fulfilled / totalItems) * 100) : 0;
  const isReady = criticalFailed === 0 && open === 0 && notFulfilled === 0;
  const hasOpenItems = open > 0;

  let resultText, resultColor, ResultIcon;
  if (hasOpenItems) {
    resultText = "Prüfung noch nicht abgeschlossen";
    resultColor = "text-amber-600";
    ResultIcon = AlertTriangle;
  } else if (isReady) {
    resultText = "AFU ausführungsreif";
    resultColor = "text-green-600";
    ResultIcon = CheckCircle2;
  } else {
    resultText = "AFU NICHT ausführungsreif";
    resultColor = "text-destructive";
    ResultIcon = XCircle;
  }

  // Stats per trade
  const tradeStats = selectedTrades.map((tradeId) => {
    const tradeItems = items.filter(
      (i) => i.trade === tradeId && i.status !== "nicht_relevant"
    );
    const tradeFulfilled = tradeItems.filter((i) => i.status === "erfuellt").length;
    const tradeNotFulfilled = tradeItems.filter(
      (i) => i.status === "nicht_erfuellt"
    ).length;
    const tradeOpen = tradeItems.filter((i) => i.status === "offen").length;
    return {
      id: tradeId,
      label: TRADE_LABELS[tradeId],
      total: tradeItems.length,
      fulfilled: tradeFulfilled,
      notFulfilled: tradeNotFulfilled,
      open: tradeOpen,
      score:
        tradeItems.length > 0
          ? Math.round((tradeFulfilled / tradeItems.length) * 100)
          : 0,
    };
  });

  return (
    <div className="space-y-4">
      {/* Main result */}
      <Card className={`border-2 ${isReady && !hasOpenItems ? "border-green-300" : hasOpenItems ? "border-amber-300" : "border-destructive/40"}`}>
        <CardContent className="p-6 flex flex-col items-center text-center">
          <ResultIcon className={`w-12 h-12 ${resultColor} mb-3`} />
          <h2 className={`text-xl font-bold ${resultColor}`}>{resultText}</h2>
          <p className="text-sm text-muted-foreground mt-2">
            Erfüllungsgrad: {score}% ({fulfilled} von {totalItems} Prüfpunkten erfüllt)
          </p>
          {criticalFailed > 0 && (
            <Badge className="mt-3 bg-destructive/10 text-destructive border border-destructive/20">
              {criticalFailed} kritische Mängel
            </Badge>
          )}
        </CardContent>
      </Card>

      {/* Stats per trade */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Shield className="w-4 h-4" />
            Bewertung nach Gewerken
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {tradeStats.map((ts) => (
            <div key={ts.id} className="space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{ts.label}</span>
                <span className="text-muted-foreground">{ts.score}%</span>
              </div>
              <div className="h-2 bg-secondary rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    ts.score === 100
                      ? "bg-green-500"
                      : ts.score >= 70
                      ? "bg-amber-500"
                      : "bg-destructive"
                  }`}
                  style={{ width: `${ts.score}%` }}
                />
              </div>
              <div className="flex gap-3 text-[11px] text-muted-foreground">
                <span className="text-green-600">✓ {ts.fulfilled}</span>
                <span className="text-destructive">✗ {ts.notFulfilled}</span>
                <span>○ {ts.open} offen</span>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Failed items list */}
      {notFulfilled > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-destructive flex items-center gap-2">
              <XCircle className="w-4 h-4" />
              Nicht erfüllte Prüfpunkte ({notFulfilled})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {items
              .filter((i) => i.status === "nicht_erfuellt")
              .map((item) => (
                <div
                  key={item.id}
                  className="flex items-start gap-2 p-2 rounded-md bg-destructive/5 border border-destructive/10"
                >
                  <XCircle className="w-3.5 h-3.5 text-destructive mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium">{item.question}</p>
                    <div className="flex gap-1.5 mt-1">
                      <Badge
                        variant="outline"
                        className={`text-[9px] ${SEVERITY_COLORS[item.severity]}`}
                      >
                        {SEVERITY_LABELS[item.severity]}
                      </Badge>
                      <Badge variant="outline" className="text-[9px]">
                        {TRADE_LABELS[item.trade]}
                      </Badge>
                    </div>
                    {item.comment && (
                      <p className="text-[11px] text-muted-foreground mt-1">
                        {item.comment}
                      </p>
                    )}
                  </div>
                </div>
              ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}