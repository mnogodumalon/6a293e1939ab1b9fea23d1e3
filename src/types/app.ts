// AUTOMATICALLY GENERATED TYPES - DO NOT EDIT

export type LookupValue = { key: string; label: string };
export type GeoLocation = { lat: number; long: number; info?: string };

export type AttachmentType = 'file' | 'note' | 'url' | 'json';
export interface Attachment {
  id: string;
  type: AttachmentType;
  label: string | null;
  value: string | null;
  active: boolean;
  createdat?: string | null;
  updatedat?: string | null;
}

export interface AttachmentInput {
  type: AttachmentType;
  label?: string;
  value: string;
  active?: boolean;
}

export interface Terminverwaltung {
  record_id: string;
  createdat: string;
  updatedat: string | null;
  fields: {
    kunde?: string; // applookup -> URL zu 'Kundenverwaltung' Record
    termindatum?: string; // Format: YYYY-MM-DD oder ISO String
    terminart?: LookupValue;
    dauer?: number;
    ort?: string;
    status?: LookupValue;
    notizen_termin?: string;
  };
}

export interface Kundenverwaltung {
  record_id: string;
  createdat: string;
  updatedat: string | null;
  fields: {
    vorname?: string;
    nachname?: string;
    email?: string;
    telefon?: string;
    strasse?: string;
    hausnummer?: string;
    plz?: string;
    ort?: string;
    notizen_kunde?: string;
  };
}

export const APP_IDS = {
  TERMINVERWALTUNG: '6a293e0847ef3857f84aa150',
  KUNDENVERWALTUNG: '6a293e06faed29ff614e6b61',
} as const;


export const LOOKUP_OPTIONS: Record<string, Record<string, {key: string, label: string}[]>> = {
  'terminverwaltung': {
    terminart: [{ key: "erstgespraech", label: "Erstgespräch" }, { key: "beratung", label: "Beratung" }, { key: "folgetermin", label: "Folgetermin" }, { key: "praesentation", label: "Präsentation" }, { key: "vertragsabschluss", label: "Vertragsabschluss" }, { key: "sonstiges", label: "Sonstiges" }],
    status: [{ key: "geplant", label: "Geplant" }, { key: "bestaetigt", label: "Bestätigt" }, { key: "abgesagt", label: "Abgesagt" }, { key: "abgeschlossen", label: "Abgeschlossen" }],
  },
};

export const FIELD_TYPES: Record<string, Record<string, string>> = {
  'terminverwaltung': {
    'kunde': 'applookup/select',
    'termindatum': 'date/datetimeminute',
    'terminart': 'lookup/select',
    'dauer': 'number',
    'ort': 'string/text',
    'status': 'lookup/radio',
    'notizen_termin': 'string/textarea',
  },
  'kundenverwaltung': {
    'vorname': 'string/text',
    'nachname': 'string/text',
    'email': 'string/email',
    'telefon': 'string/tel',
    'strasse': 'string/text',
    'hausnummer': 'string/text',
    'plz': 'string/text',
    'ort': 'string/text',
    'notizen_kunde': 'string/textarea',
  },
};

type StripLookup<T> = {
  [K in keyof T]: T[K] extends LookupValue | undefined ? string | LookupValue | undefined
    : T[K] extends LookupValue[] | undefined ? string[] | LookupValue[] | undefined
    : T[K];
};

// Helper Types for creating new records (lookup fields as plain strings for API)
export type CreateTerminverwaltung = StripLookup<Terminverwaltung['fields']>;
export type CreateKundenverwaltung = StripLookup<Kundenverwaltung['fields']>;