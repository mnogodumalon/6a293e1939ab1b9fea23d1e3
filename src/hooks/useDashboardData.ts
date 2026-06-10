import { useState, useEffect, useMemo, useCallback } from 'react';
import type { Terminverwaltung, Kundenverwaltung } from '@/types/app';
import { LivingAppsService } from '@/services/livingAppsService';

export function useDashboardData() {
  const [terminverwaltung, setTerminverwaltung] = useState<Terminverwaltung[]>([]);
  const [kundenverwaltung, setKundenverwaltung] = useState<Kundenverwaltung[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchAll = useCallback(async () => {
    setError(null);
    try {
      const [terminverwaltungData, kundenverwaltungData] = await Promise.all([
        LivingAppsService.getTerminverwaltung(),
        LivingAppsService.getKundenverwaltung(),
      ]);
      setTerminverwaltung(terminverwaltungData);
      setKundenverwaltung(kundenverwaltungData);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Fehler beim Laden der Daten'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Silent background refresh (no loading state change → no flicker)
  useEffect(() => {
    async function silentRefresh() {
      try {
        const [terminverwaltungData, kundenverwaltungData] = await Promise.all([
          LivingAppsService.getTerminverwaltung(),
          LivingAppsService.getKundenverwaltung(),
        ]);
        setTerminverwaltung(terminverwaltungData);
        setKundenverwaltung(kundenverwaltungData);
      } catch {
        // silently ignore — stale data is better than no data
      }
    }
    function handleRefresh() { void silentRefresh(); }
    window.addEventListener('dashboard-refresh', handleRefresh);
    return () => window.removeEventListener('dashboard-refresh', handleRefresh);
  }, []);

  const kundenverwaltungMap = useMemo(() => {
    const m = new Map<string, Kundenverwaltung>();
    kundenverwaltung.forEach(r => m.set(r.record_id, r));
    return m;
  }, [kundenverwaltung]);

  return { terminverwaltung, setTerminverwaltung, kundenverwaltung, setKundenverwaltung, loading, error, fetchAll, kundenverwaltungMap };
}