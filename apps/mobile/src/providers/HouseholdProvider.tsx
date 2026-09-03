import type { HouseholdWithRole } from '@notre-nid/shared';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { useHouseholds } from '../hooks/useHouseholds';
import {
  clearLastHouseholdId,
  getLastHouseholdId,
  setLastHouseholdId,
} from '../lib/lastHouseholdStorage';

import { useAuth } from './AuthProvider';

interface HouseholdContextValue {
  householdId: string | null;
  households: HouseholdWithRole[];
  isLoading: boolean;
  isError: boolean;
  selectHousehold: (householdId: string) => void;
  /** Revient à l'écran de sélection (sans effet si un seul household existe). */
  clearSelection: () => void;
  refetch: () => void;
}

const HouseholdContext = createContext<HouseholdContextValue | null>(null);

/**
 * Sélectionne automatiquement l'unique household de l'utilisateur, sinon
 * mémorise/restaure le dernier household utilisé, sinon laisse `householdId`
 * à `null` (l'écran de sélection prend le relais — docs/NOTRE_NID_PRD.md
 * section 9, « Sélection du household »).
 */
export function HouseholdProvider({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const householdsQuery = useHouseholds(status === 'authenticated');
  const [manualSelection, setManualSelection] = useState<string | null>(null);
  const [persistedLastId, setPersistedLastId] = useState<string | null>(null);
  const [lastStatus, setLastStatus] = useState(status);

  /**
   * Ajustement pendant le rendu plutôt qu'un effet (docs React — « Adjusting
   * state when a prop changes ») : une sélection de household (manuelle ou
   * mémorisée) appartient à une session précise. Sans ce reset, elle
   * survivrait en mémoire — ce provider ne se démonte jamais — à un logout et
   * resterait visible le temps qu'une nouvelle connexion recharge la vraie
   * liste de households du prochain utilisateur (cause racine confirmée du
   * bug d'isolation de compte, voir docs/PHASE_STATUS.md).
   */
  if (status !== lastStatus) {
    setLastStatus(status);
    if (status === 'unauthenticated') {
      setManualSelection(null);
      setPersistedLastId(null);
    }
  }

  useEffect(() => {
    void getLastHouseholdId().then((id) => setPersistedLastId(id));
  }, []);

  const households = householdsQuery.data;

  const householdId = useMemo<string | null>(() => {
    if (!households) return null;
    if (manualSelection && households.some((h) => h.id === manualSelection)) {
      return manualSelection;
    }
    if (households.length === 1) {
      return households[0]?.id ?? null;
    }
    if (persistedLastId && households.some((h) => h.id === persistedLastId)) {
      return persistedLastId;
    }
    return null;
  }, [households, manualSelection, persistedLastId]);

  useEffect(() => {
    if (householdId) void setLastHouseholdId(householdId);
  }, [householdId]);

  const value = useMemo<HouseholdContextValue>(
    () => ({
      householdId,
      households: households ?? [],
      isLoading: householdsQuery.isLoading,
      isError: householdsQuery.isError,
      selectHousehold: (id: string) => {
        setManualSelection(id);
      },
      clearSelection: () => {
        setManualSelection(null);
        setPersistedLastId(null);
        void clearLastHouseholdId();
      },
      refetch: () => void householdsQuery.refetch(),
    }),
    [householdId, households, householdsQuery],
  );

  return <HouseholdContext.Provider value={value}>{children}</HouseholdContext.Provider>;
}

export function useHousehold(): HouseholdContextValue {
  const ctx = useContext(HouseholdContext);
  if (!ctx) throw new Error('useHousehold doit être utilisé à l’intérieur de <HouseholdProvider>.');
  return ctx;
}
