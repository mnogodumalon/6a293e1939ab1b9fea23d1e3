import { useDashboardData } from '@/hooks/useDashboardData';
import { enrichTerminverwaltung } from '@/lib/enrich';
import type { EnrichedTerminverwaltung } from '@/types/enriched';
import { APP_IDS, LOOKUP_OPTIONS } from '@/types/app';
import { LivingAppsService, createRecordUrl } from '@/services/livingAppsService';
import { formatDateTime } from '@/lib/formatters';
import { useState, useMemo } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { IconAlertCircle, IconTool, IconRefresh, IconCheck, IconCalendar, IconPlus, IconUsers, IconClock, IconCircleCheck, IconCircleX, IconPencil, IconTrash } from '@tabler/icons-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { de } from 'date-fns/locale';
import { format, parseISO, isToday, isFuture, isPast, startOfToday } from 'date-fns';
import {
  CalendarWidget,
  type CalendarEvent,
  type CalendarTone,
} from '@/components/widgets/CalendarWidget';
import {
  RecordOverlay,
  RecordHeader,
  RecordSection,
  RecordField,
  RecordAttachments,
  useRecordOverlayStack,
} from '@/components/widgets/RecordView';
import { TerminverwaltungDialog } from '@/components/dialogs/TerminverwaltungDialog';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { StatCard } from '@/components/StatCard';
import { AI_PHOTO_SCAN, AI_PHOTO_LOCATION } from '@/config/ai-features';

const APPGROUP_ID = '6a293e1939ab1b9fea23d1e3';
const REPAIR_ENDPOINT = '/claude/build/repair';

function toneForTermin(t: EnrichedTerminverwaltung): CalendarTone {
  const statusKey = typeof t.fields.status === 'object' && t.fields.status !== null
    ? (t.fields.status as { key: string }).key
    : t.fields.status;
  if (statusKey === 'abgesagt') return 'destructive';
  if (statusKey === 'abgeschlossen') return 'default';
  if (statusKey === 'bestaetigt') return 'success';
  if (t.fields.termindatum && isPast(parseISO(t.fields.termindatum)) && statusKey === 'geplant') return 'warning';
  return 'primary';
}

export default function DashboardOverview() {
  const {
    terminverwaltung, kundenverwaltung,
    kundenverwaltungMap,
    loading, error, fetchAll,
  } = useDashboardData();

  const enrichedTerminverwaltung = enrichTerminverwaltung(terminverwaltung, { kundenverwaltungMap });

  const overlay = useRecordOverlayStack<{ id: string }>();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<EnrichedTerminverwaltung | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<EnrichedTerminverwaltung | null>(null);
  const [prefillDate, setPrefillDate] = useState<string | undefined>(undefined);

  const kpiTotal = enrichedTerminverwaltung.length;
  const kpiHeute = enrichedTerminverwaltung.filter(t => t.fields.termindatum && isToday(parseISO(t.fields.termindatum))).length;
  const kpiGeplant = enrichedTerminverwaltung.filter(t => {
    const key = typeof t.fields.status === 'object' && t.fields.status ? (t.fields.status as { key: string }).key : t.fields.status;
    return key === 'geplant' || key === 'bestaetigt';
  }).length;
  const kpiAbgesagt = enrichedTerminverwaltung.filter(t => {
    const key = typeof t.fields.status === 'object' && t.fields.status ? (t.fields.status as { key: string }).key : t.fields.status;
    return key === 'abgesagt';
  }).length;

  const events = useMemo<CalendarEvent[]>(
    () =>
      enrichedTerminverwaltung
        .filter(t => !!t.fields.termindatum)
        .map(t => ({
          id: `termin:${t.record_id}`,
          start: t.fields.termindatum!,
          allDay: false,
          title: t.kundeName || 'Kein Kunde',
          subtitle: (t.fields.terminart as { label?: string } | undefined)?.label ?? t.fields.terminart as string | undefined,
          tone: toneForTermin(t),
        })),
    [enrichedTerminverwaltung],
  );

  const currentRecord = overlay.top
    ? enrichedTerminverwaltung.find(t => t.record_id === overlay.top!.id)
    : undefined;

  const handleReschedule = async (eventId: string, newStart: string) => {
    const rid = eventId.split(':')[1];
    if (!rid) return;
    try {
      await LivingAppsService.updateTerminverwaltungEntry(rid, { termindatum: newStart });
      fetchAll();
    } catch {
      fetchAll();
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await LivingAppsService.deleteTerminverwaltungEntry(deleteTarget.record_id);
    overlay.close();
    setDeleteTarget(null);
    fetchAll();
  };

  const openCreate = (dateStr?: string) => {
    setPrefillDate(dateStr);
    setEditingRecord(null);
    setDialogOpen(true);
  };

  const openEdit = (record: EnrichedTerminverwaltung) => {
    setEditingRecord(record);
    setPrefillDate(undefined);
    setDialogOpen(true);
  };

  if (loading) return <DashboardSkeleton />;
  if (error) return <DashboardError error={error} onRetry={fetchAll} />;

  const statusOpts = LOOKUP_OPTIONS['terminverwaltung']?.status ?? [];
  const terminartOpts = LOOKUP_OPTIONS['terminverwaltung']?.terminart ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Kundentermine</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Plane und verwalte alle Kundentermine</p>
        </div>
        <Button onClick={() => openCreate()} className="shrink-0">
          <IconPlus size={16} className="mr-1.5 shrink-0" />
          Neuer Termin
        </Button>
      </div>

      {/* KPI-Kacheln */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          title="Termine gesamt"
          value={String(kpiTotal)}
          description="Alle Einträge"
          icon={<IconCalendar size={18} className="text-muted-foreground" />}
        />
        <StatCard
          title="Heute"
          value={String(kpiHeute)}
          description="Termine heute"
          icon={<IconClock size={18} className="text-muted-foreground" />}
        />
        <StatCard
          title="Ausstehend"
          value={String(kpiGeplant)}
          description="Geplant & Bestätigt"
          icon={<IconCircleCheck size={18} className="text-muted-foreground" />}
        />
        <StatCard
          title="Abgesagt"
          value={String(kpiAbgesagt)}
          description="Stornierte Termine"
          icon={<IconCircleX size={18} className="text-muted-foreground" />}
        />
      </div>

      {/* Kalender */}
      <div className="rounded-2xl border border-border overflow-hidden">
        <CalendarWidget
          events={events}
          defaultView="week"
          locale={de}
          weekDays={5}
          dayStartHour={7}
          dayEndHour={20}
          dragSnapMinutes={15}
          views={['month', 'week', 'day', 'agenda']}
          onEventClick={ev => overlay.replace({ id: ev.id.split(':')[1] ?? '' })}
          onEventDrop={handleReschedule}
          onEmptyClick={(date) => {
            const iso = format(date, "yyyy-MM-dd'T'HH:mm");
            openCreate(iso);
          }}
          onRangeCreate={(start) => {
            const iso = format(start, "yyyy-MM-dd'T'HH:mm");
            openCreate(iso);
          }}
        />
      </div>

      {/* Anstehende Termine (Agenda-Liste) */}
      <div className="rounded-2xl border border-border overflow-hidden">
        <div className="px-5 py-4 border-b border-border bg-secondary/40 flex items-center justify-between">
          <h2 className="font-semibold text-sm text-foreground">Nächste Termine</h2>
          <span className="text-xs text-muted-foreground">{enrichedTerminverwaltung.filter(t => t.fields.termindatum && isFuture(parseISO(t.fields.termindatum))).length} ausstehend</span>
        </div>
        <div className="divide-y divide-border">
          {enrichedTerminverwaltung
            .filter(t => t.fields.termindatum && (isFuture(parseISO(t.fields.termindatum)) || isToday(parseISO(t.fields.termindatum))))
            .sort((a, b) => (a.fields.termindatum ?? '').localeCompare(b.fields.termindatum ?? ''))
            .slice(0, 8)
            .map(t => {
              const statusKey = typeof t.fields.status === 'object' && t.fields.status ? (t.fields.status as { key: string }).key : String(t.fields.status ?? '');
              const statusLabel = (t.fields.status as { label?: string } | undefined)?.label ?? statusOpts.find(o => o.key === statusKey)?.label ?? statusKey;
              const terminartLabel = (t.fields.terminart as { label?: string } | undefined)?.label ?? terminartOpts.find(o => o.key === String(t.fields.terminart))?.label ?? String(t.fields.terminart ?? '');
              const badgeVariant: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
                geplant: 'secondary',
                bestaetigt: 'default',
                abgesagt: 'destructive',
                abgeschlossen: 'outline',
              };
              return (
                <div
                  key={t.record_id}
                  className="flex items-center gap-3 px-5 py-3 hover:bg-accent/50 transition-colors cursor-pointer"
                  onClick={() => overlay.replace({ id: t.record_id })}
                >
                  <div className="shrink-0 w-10 text-center">
                    <div className="text-xs font-semibold text-primary">
                      {t.fields.termindatum ? format(parseISO(t.fields.termindatum), 'dd.MM', { locale: de }) : '—'}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {t.fields.termindatum ? format(parseISO(t.fields.termindatum), 'HH:mm', { locale: de }) : ''}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm truncate">{t.kundeName || 'Kein Kunde'}</span>
                      {terminartLabel && (
                        <span className="text-xs text-muted-foreground truncate">{terminartLabel}</span>
                      )}
                    </div>
                    {t.fields.ort && (
                      <div className="text-xs text-muted-foreground truncate mt-0.5">{t.fields.ort}</div>
                    )}
                  </div>
                  <div className="shrink-0 flex items-center gap-2">
                    <Badge variant={badgeVariant[statusKey] ?? 'secondary'} className="text-xs">{statusLabel}</Badge>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={e => { e.stopPropagation(); openEdit(t); }}
                      title="Bearbeiten"
                    >
                      <IconPencil size={14} />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={e => { e.stopPropagation(); setDeleteTarget(t); }}
                      title="Löschen"
                    >
                      <IconTrash size={14} />
                    </Button>
                  </div>
                </div>
              );
            })}
          {enrichedTerminverwaltung.filter(t => t.fields.termindatum && (isFuture(parseISO(t.fields.termindatum)) || isToday(parseISO(t.fields.termindatum)))).length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 gap-2">
              <IconCalendar size={36} className="text-muted-foreground" stroke={1.5} />
              <p className="text-sm text-muted-foreground">Keine anstehenden Termine</p>
              <Button size="sm" variant="outline" onClick={() => openCreate()}>
                <IconPlus size={14} className="mr-1" />Termin anlegen
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Kundenliste (Schnellübersicht) */}
      {kundenverwaltung.length > 0 && (
        <div className="rounded-2xl border border-border overflow-hidden">
          <div className="px-5 py-4 border-b border-border bg-secondary/40 flex items-center justify-between">
            <h2 className="font-semibold text-sm text-foreground">Kunden</h2>
            <span className="text-xs text-muted-foreground">{kundenverwaltung.length} Einträge</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-5 py-2.5 font-medium text-muted-foreground text-xs">Name</th>
                  <th className="text-left px-5 py-2.5 font-medium text-muted-foreground text-xs hidden sm:table-cell">E-Mail</th>
                  <th className="text-left px-5 py-2.5 font-medium text-muted-foreground text-xs hidden md:table-cell">Telefon</th>
                  <th className="text-left px-5 py-2.5 font-medium text-muted-foreground text-xs">Termine</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {kundenverwaltung.slice(0, 10).map(k => {
                  const count = terminverwaltung.filter(t => {
                    if (!t.fields.kunde) return false;
                    const url = t.fields.kunde as string;
                    return url.endsWith(k.record_id);
                  }).length;
                  return (
                    <tr key={k.record_id} className="hover:bg-accent/30 transition-colors">
                      <td className="px-5 py-3 font-medium">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                            <IconUsers size={14} className="text-primary" />
                          </div>
                          <span className="truncate">{[k.fields.vorname, k.fields.nachname].filter(Boolean).join(' ') || '—'}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-muted-foreground hidden sm:table-cell truncate max-w-[200px]">
                        {k.fields.email || '—'}
                      </td>
                      <td className="px-5 py-3 text-muted-foreground hidden md:table-cell">
                        {k.fields.telefon || '—'}
                      </td>
                      <td className="px-5 py-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
                          {count}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Detail-Overlay */}
      <RecordOverlay
        open={overlay.open}
        onClose={overlay.close}
        ariaLabel="Termin"
        onEdit={currentRecord ? () => openEdit(currentRecord) : undefined}
        editLabel="Bearbeiten"
      >
        {currentRecord && (
          <>
            <RecordHeader
              title={currentRecord.kundeName || 'Kein Kunde'}
              subtitle={(currentRecord.fields.terminart as { label?: string } | undefined)?.label}
              meta={formatDateTime(currentRecord.fields.termindatum)}
              badges={
                currentRecord.fields.status && (
                  <Badge variant={
                    (() => {
                      const k = typeof currentRecord.fields.status === 'object' ? (currentRecord.fields.status as { key: string }).key : String(currentRecord.fields.status);
                      if (k === 'bestaetigt') return 'default';
                      if (k === 'abgesagt') return 'destructive';
                      return 'secondary';
                    })()
                  }>
                    {(currentRecord.fields.status as { label?: string } | undefined)?.label ?? String(currentRecord.fields.status)}
                  </Badge>
                )
              }
            />
            <RecordSection title="Termindetails" cols={2}>
              <RecordField label="Datum & Uhrzeit" value={currentRecord.fields.termindatum} format="datetime" />
              <RecordField label="Dauer (Min.)" value={currentRecord.fields.dauer != null ? String(currentRecord.fields.dauer) : undefined} />
              <RecordField label="Terminart" value={(currentRecord.fields.terminart as { label?: string } | undefined)?.label} format="pill" />
              <RecordField label="Ort / Adresse" value={currentRecord.fields.ort} />
            </RecordSection>
            {currentRecord.fields.notizen_termin && (
              <RecordSection title="Notizen">
                <RecordField label="Notizen" value={currentRecord.fields.notizen_termin} format="longtext" />
              </RecordSection>
            )}
            <RecordSection title="Aktionen">
              <div className="flex gap-2 flex-wrap pt-1">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => openEdit(currentRecord)}
                >
                  <IconPencil size={14} className="mr-1.5 shrink-0" />
                  Bearbeiten
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-destructive border-destructive/30 hover:bg-destructive/10"
                  onClick={() => setDeleteTarget(currentRecord)}
                >
                  <IconTrash size={14} className="mr-1.5 shrink-0" />
                  Löschen
                </Button>
              </div>
            </RecordSection>
            <RecordAttachments appId={APP_IDS.TERMINVERWALTUNG} recordId={currentRecord.record_id} />
          </>
        )}
      </RecordOverlay>

      {/* Create/Edit Dialog */}
      <TerminverwaltungDialog
        open={dialogOpen}
        onClose={() => { setDialogOpen(false); setEditingRecord(null); setPrefillDate(undefined); }}
        onSubmit={async (fields) => {
          if (editingRecord) {
            await LivingAppsService.updateTerminverwaltungEntry(editingRecord.record_id, fields);
          } else {
            await LivingAppsService.createTerminverwaltungEntry(fields);
          }
          fetchAll();
        }}
        defaultValues={editingRecord
          ? { ...editingRecord.fields, kunde: editingRecord.fields.kunde ? createRecordUrl(APP_IDS.KUNDENVERWALTUNG, String(editingRecord.fields.kunde).match(/([a-f0-9]{24})$/i)?.[1] ?? '') : undefined }
          : prefillDate
            ? { termindatum: prefillDate }
            : undefined
        }
        recordId={editingRecord?.record_id}
        kundenverwaltungList={kundenverwaltung}
        enablePhotoScan={AI_PHOTO_SCAN['Terminverwaltung']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Terminverwaltung']}
      />

      {/* Delete Confirm */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="Termin löschen"
        description={`Möchtest du den Termin mit ${deleteTarget?.kundeName || 'diesem Kunden'} wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.`}
        onConfirm={handleDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-9 w-36" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
      </div>
      <Skeleton className="h-64 rounded-2xl" />
    </div>
  );
}

function DashboardError({ error, onRetry }: { error: Error; onRetry: () => void }) {
  const [repairing, setRepairing] = useState(false);
  const [repairStatus, setRepairStatus] = useState('');
  const [repairDone, setRepairDone] = useState(false);
  const [repairFailed, setRepairFailed] = useState(false);

  const handleRepair = async () => {
    setRepairing(true);
    setRepairStatus('Reparatur wird gestartet...');
    setRepairFailed(false);

    const errorContext = JSON.stringify({
      type: 'data_loading',
      message: error.message,
      stack: (error.stack ?? '').split('\n').slice(0, 10).join('\n'),
      url: window.location.href,
    });

    try {
      const resp = await fetch(REPAIR_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ appgroup_id: APPGROUP_ID, error_context: errorContext }),
      });

      if (!resp.ok || !resp.body) {
        setRepairing(false);
        setRepairFailed(true);
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const raw of lines) {
          const line = raw.trim();
          if (!line.startsWith('data: ')) continue;
          const content = line.slice(6);
          if (content.startsWith('[STATUS]')) setRepairStatus(content.replace(/^\[STATUS]\s*/, ''));
          if (content.startsWith('[DONE]')) { setRepairDone(true); setRepairing(false); }
          if (content.startsWith('[ERROR]') && !content.includes('Dashboard-Links')) setRepairFailed(true);
        }
      }
    } catch {
      setRepairing(false);
      setRepairFailed(true);
    }
  };

  if (repairDone) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div className="w-12 h-12 rounded-2xl bg-green-500/10 flex items-center justify-center">
          <IconCheck size={22} className="text-green-500" />
        </div>
        <div className="text-center">
          <h3 className="font-semibold text-foreground mb-1">Dashboard repariert</h3>
          <p className="text-sm text-muted-foreground max-w-xs">Das Problem wurde behoben. Bitte lade die Seite neu.</p>
        </div>
        <Button size="sm" onClick={() => window.location.reload()}>
          <IconRefresh size={14} className="mr-1" />Neu laden
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <div className="w-12 h-12 rounded-2xl bg-destructive/10 flex items-center justify-center">
        <IconAlertCircle size={22} className="text-destructive" />
      </div>
      <div className="text-center">
        <h3 className="font-semibold text-foreground mb-1">Fehler beim Laden</h3>
        <p className="text-sm text-muted-foreground max-w-xs">
          {repairing ? repairStatus : error.message}
        </p>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={onRetry} disabled={repairing}>Erneut versuchen</Button>
        <Button size="sm" onClick={handleRepair} disabled={repairing}>
          {repairing
            ? <span className="inline-block w-3.5 h-3.5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin mr-1" />
            : <IconTool size={14} className="mr-1" />}
          {repairing ? 'Reparatur läuft...' : 'Dashboard reparieren'}
        </Button>
      </div>
      {repairFailed && <p className="text-sm text-destructive">Automatische Reparatur fehlgeschlagen. Bitte kontaktiere den Support.</p>}
    </div>
  );
}
