export const TRADES = [
  { id: "allgemein", label: "Allgemeine Prüfung", required: true },
  { id: "erdbau", label: "Erdbau", required: false },
  { id: "verbau", label: "Verbau", required: false },
  { id: "kanalbau", label: "Kanalbau", required: false },
  { id: "strassenbau", label: "Straßenbau", required: false },
  { id: "wasserhaltung", label: "Wasserhaltung", required: false },
  { id: "draen_versickerung", label: "Drän- und Versickerung", required: false },
];

export const TRADE_LABELS = {
  allgemein: "Allgemeine Prüfung",
  erdbau: "Erdbau",
  verbau: "Verbau",
  kanalbau: "Kanalbau",
  strassenbau: "Straßenbau",
  wasserhaltung: "Wasserhaltung",
  draen_versickerung: "Drän- und Versickerung",
};

export const STATUS_LABELS = {
  entwurf: "Entwurf",
  in_pruefung: "In Prüfung",
  ausfuehrungsreif: "Ausführungsreif",
  nicht_ausfuehrungsreif: "Nicht ausführungsreif",
};

export const STATUS_COLORS = {
  entwurf: "bg-secondary text-secondary-foreground",
  in_pruefung: "bg-primary/10 text-primary",
  ausfuehrungsreif: "bg-green-100 text-green-800",
  nicht_ausfuehrungsreif: "bg-destructive/10 text-destructive",
};

export const SEVERITY_LABELS = {
  kritisch: "Kritisch",
  wichtig: "Wichtig",
  hinweis: "Hinweis",
};

export const SEVERITY_COLORS = {
  kritisch: "bg-destructive/10 text-destructive border-destructive/20",
  wichtig: "bg-amber-50 text-amber-700 border-amber-200",
  hinweis: "bg-blue-50 text-blue-600 border-blue-200",
};

export const CHECKLIST_TEMPLATES = {
  allgemein: [
    // Vollständigkeit
    { category: "Vollständigkeit", question: "Lageplan vorhanden und aktuell?", severity: "kritisch", norm_reference: "HOAI LP 5", sort_order: 1 },
    { category: "Vollständigkeit", question: "Längsschnitte vorhanden?", severity: "kritisch", norm_reference: "HOAI LP 5", sort_order: 2 },
    { category: "Vollständigkeit", question: "Querschnitte vorhanden?", severity: "kritisch", norm_reference: "HOAI LP 5", sort_order: 3 },
    { category: "Vollständigkeit", question: "Leistungsverzeichnis vollständig und schlüssig?", severity: "kritisch", norm_reference: "VOB/A §7", sort_order: 4 },
    { category: "Vollständigkeit", question: "Baubeschreibung vorhanden?", severity: "wichtig", norm_reference: "VOB/B §3", sort_order: 5 },
    { category: "Vollständigkeit", question: "Baugrundgutachten vorhanden?", severity: "kritisch", norm_reference: "DIN 4020", sort_order: 6 },
    { category: "Vollständigkeit", question: "Genehmigungen / behördliche Auflagen beigefügt?", severity: "kritisch", norm_reference: "VOB/B §4", sort_order: 7 },
    // Planungstiefe
    { category: "Planungstiefe", question: "Maßstab und Bemaßung ausreichend für Ausführung?", severity: "wichtig", norm_reference: "HOAI LP 5", sort_order: 8 },
    { category: "Planungstiefe", question: "Höhenangaben (NHN) auf allen Plänen?", severity: "kritisch", norm_reference: "DIN 2425-4", sort_order: 9 },
    { category: "Planungstiefe", question: "Bestandsleitungen eingetragen und verifiziert?", severity: "kritisch", norm_reference: "DIN 2425-4", sort_order: 10 },
    // Normkonformität
    { category: "Normkonformität", question: "VOB/C DIN 18299 Allgemeine Regelungen beachtet?", severity: "wichtig", norm_reference: "VOB/C DIN 18299", sort_order: 11 },
    { category: "Normkonformität", question: "Arbeitsschutzrelevante Hinweise im Plan enthalten?", severity: "wichtig", norm_reference: "VOB/B §4", sort_order: 12 },
    // Kollisionsfreiheit
    { category: "Kollisionsfreiheit", question: "Spartenkreuzungen identifiziert und dargestellt?", severity: "kritisch", norm_reference: "DIN 2425-4", sort_order: 13 },
    { category: "Kollisionsfreiheit", question: "Abstände zu Bestandsleitungen geprüft?", severity: "kritisch", norm_reference: "DIN 2425-4", sort_order: 14 },
    // Kritische Punkte
    { category: "Kritische Punkte", question: "Verkehrsrechtliche Anordnung vorhanden?", severity: "wichtig", norm_reference: "VOB/B §4", sort_order: 15 },
    { category: "Kritische Punkte", question: "Kampfmittelfreigabe vorhanden?", severity: "kritisch", norm_reference: "VOB/B §3", sort_order: 16 },
    { category: "Kritische Punkte", question: "Altlastenauskunft vorhanden?", severity: "wichtig", norm_reference: "VOB/B §3", sort_order: 17 },
  ],

  erdbau: [
    { category: "Vollständigkeit", question: "Massenermittlung vorhanden?", severity: "kritisch", norm_reference: "VOB/C DIN 18300", sort_order: 1 },
    { category: "Vollständigkeit", question: "Bodenkennwerte definiert?", severity: "kritisch", norm_reference: "DIN 18300", sort_order: 2 },
    { category: "Planungstiefe", question: "Böschungswinkel definiert?", severity: "wichtig", norm_reference: "DIN 4124", sort_order: 3 },
    { category: "Planungstiefe", question: "Aushubklassen zugeordnet?", severity: "wichtig", norm_reference: "VOB/C DIN 18300", sort_order: 4 },
    { category: "Normkonformität", question: "Grabenverbau nach DIN 4124 spezifiziert?", severity: "kritisch", norm_reference: "DIN 4124", sort_order: 5 },
    { category: "Normkonformität", question: "Verfüllmaterial spezifiziert?", severity: "wichtig", norm_reference: "VOB/C DIN 18300", sort_order: 6 },
    { category: "Kritische Punkte", question: "Grundwasserstand berücksichtigt?", severity: "kritisch", norm_reference: "DIN 4124", sort_order: 7 },
    { category: "Kritische Punkte", question: "Entsorgungskonzept für kontaminierten Boden?", severity: "wichtig", norm_reference: "VOB/C DIN 18300", sort_order: 8 },
  ],

  verbau: [
    { category: "Vollständigkeit", question: "Verbauplanung / Statik vorhanden?", severity: "kritisch", norm_reference: "DIN 4124", sort_order: 1 },
    { category: "Vollständigkeit", question: "Verbautyp festgelegt (Spundwand, Trägerbohlwand, etc.)?", severity: "kritisch", norm_reference: "DIN 4124", sort_order: 2 },
    { category: "Planungstiefe", question: "Einbindetiefe berechnet?", severity: "kritisch", norm_reference: "DIN 4124", sort_order: 3 },
    { category: "Planungstiefe", question: "Ankerlagen / Steifen definiert?", severity: "wichtig", norm_reference: "DIN 4124", sort_order: 4 },
    { category: "Normkonformität", question: "DIN 4124 Verbauvorschriften eingehalten?", severity: "kritisch", norm_reference: "DIN 4124", sort_order: 5 },
    { category: "Kollisionsfreiheit", question: "Verbauposition kollisionsfrei zu Leitungen?", severity: "kritisch", norm_reference: "DIN 4124", sort_order: 6 },
    { category: "Kritische Punkte", question: "Nachbarbebauung / Setzungsprognose berücksichtigt?", severity: "kritisch", norm_reference: "DIN 4124", sort_order: 7 },
  ],

  kanalbau: [
    { category: "Vollständigkeit", question: "Kanalnetzberechnung / hydraulischer Nachweis vorhanden?", severity: "kritisch", norm_reference: "DIN EN 1610", sort_order: 1 },
    { category: "Vollständigkeit", question: "Schachtprotokolle / Schachtdetails vorhanden?", severity: "wichtig", norm_reference: "DIN EN 1610", sort_order: 2 },
    { category: "Planungstiefe", question: "Rohrmaterialien und Nennweiten spezifiziert?", severity: "kritisch", norm_reference: "VOB/C DIN 18306", sort_order: 3 },
    { category: "Planungstiefe", question: "Gefälle und Sohlhöhen angegeben?", severity: "kritisch", norm_reference: "DIN EN 1610", sort_order: 4 },
    { category: "Normkonformität", question: "DIN EN 1610 Verlegebedingungen beachtet?", severity: "kritisch", norm_reference: "DIN EN 1610", sort_order: 5 },
    { category: "Normkonformität", question: "Bettungs- und Verfüllbedingungen spezifiziert?", severity: "wichtig", norm_reference: "DIN EN 1610", sort_order: 6 },
    { category: "Kollisionsfreiheit", question: "Kreuzungspunkte mit anderen Leitungen geprüft?", severity: "kritisch", norm_reference: "DIN 2425-4", sort_order: 7 },
    { category: "Kritische Punkte", question: "Anschluss an Bestandsnetz geklärt?", severity: "kritisch", norm_reference: "DIN EN 1610", sort_order: 8 },
    { category: "Kritische Punkte", question: "Dichtheitsprüfung spezifiziert?", severity: "wichtig", norm_reference: "DIN EN 1610", sort_order: 9 },
  ],

  strassenbau: [
    { category: "Vollständigkeit", question: "Oberbaudimensionierung / RStO vorhanden?", severity: "kritisch", norm_reference: "VOB/C DIN 18315/18316", sort_order: 1 },
    { category: "Vollständigkeit", question: "Entwässerungskonzept Straße vorhanden?", severity: "wichtig", norm_reference: "VOB/C DIN 18315", sort_order: 2 },
    { category: "Planungstiefe", question: "Schichtaufbau und Materialien spezifiziert?", severity: "kritisch", norm_reference: "VOB/C DIN 18315/18316", sort_order: 3 },
    { category: "Planungstiefe", question: "Querneigungen und Längsneigungen angegeben?", severity: "wichtig", norm_reference: "VOB/C DIN 18315", sort_order: 4 },
    { category: "Normkonformität", question: "DIN 18315/18316 Anforderungen eingehalten?", severity: "wichtig", norm_reference: "VOB/C DIN 18315/18316", sort_order: 5 },
    { category: "Kollisionsfreiheit", question: "Einbauten (Schächte, Schieber) in Fahrbahn berücksichtigt?", severity: "wichtig", norm_reference: "VOB/C DIN 18315", sort_order: 6 },
    { category: "Kritische Punkte", question: "Provisorische Fahrbahndecken für Bauphasen definiert?", severity: "hinweis", norm_reference: "VOB/C DIN 18315", sort_order: 7 },
  ],

  wasserhaltung: [
    { category: "Vollständigkeit", question: "Wasserhaltungskonzept vorhanden?", severity: "kritisch", norm_reference: "DIN 4124", sort_order: 1 },
    { category: "Vollständigkeit", question: "Grundwassermessdaten vorhanden?", severity: "kritisch", norm_reference: "DIN 4124", sort_order: 2 },
    { category: "Planungstiefe", question: "Pumpenleistung und Fördermenge berechnet?", severity: "wichtig", norm_reference: "VOB/C DIN 18305", sort_order: 3 },
    { category: "Planungstiefe", question: "Einleitstelle und Genehmigung definiert?", severity: "kritisch", norm_reference: "VOB/B §4", sort_order: 4 },
    { category: "Normkonformität", question: "Wasserrechtliche Erlaubnis vorhanden?", severity: "kritisch", norm_reference: "VOB/B §4", sort_order: 5 },
    { category: "Kritische Punkte", question: "Auswirkung auf Nachbarbebauung berücksichtigt?", severity: "kritisch", norm_reference: "DIN 4124", sort_order: 6 },
  ],

  draen_versickerung: [
    { category: "Vollständigkeit", question: "Versickerungskonzept vorhanden?", severity: "kritisch", norm_reference: "DIN 18308", sort_order: 1 },
    { category: "Vollständigkeit", question: "Bodendurchlässigkeit (kf-Wert) ermittelt?", severity: "kritisch", norm_reference: "DIN 18308", sort_order: 2 },
    { category: "Planungstiefe", question: "Drän-Materialien und Dimensionen spezifiziert?", severity: "wichtig", norm_reference: "VOB/C DIN 18308", sort_order: 3 },
    { category: "Planungstiefe", question: "Versickerungsfläche / -mulde dimensioniert?", severity: "wichtig", norm_reference: "DIN 18308", sort_order: 4 },
    { category: "Normkonformität", question: "DIN 18308 Anforderungen eingehalten?", severity: "wichtig", norm_reference: "VOB/C DIN 18308", sort_order: 5 },
    { category: "Kritische Punkte", question: "Grundwasserschutz berücksichtigt?", severity: "kritisch", norm_reference: "DIN 18308", sort_order: 6 },
  ],
};