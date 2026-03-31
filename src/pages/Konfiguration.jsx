import React from "react";
import { Settings } from "lucide-react";
import CompanyHeaderForm from "@/components/stammdaten/CompanyHeaderForm";

export default function Konfiguration() {
  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Settings className="w-6 h-6" />Konfiguration
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Briefkopf, Angebots- und Rechnungseinstellungen, PDF-Footer und weitere Unternehmenseinstellungen
        </p>
      </div>
      <CompanyHeaderForm />
    </div>
  );
}