import React, { createContext, useContext, useState, useEffect } from 'react';
import { MONTH_NAMES } from '../utils/dateUtils';
import { APP_CONFIG } from '../constants/appConfig';
import { apiClient } from '../services/api/apiClient';

const RosterCycleContext = createContext(null);

export function RosterCycleProvider({ children }) {
  const [selectedYear, setSelectedYear] = useState(APP_CONFIG.defaultYear || 2026);
  const [selectedMonth, setSelectedMonth] = useState(APP_CONFIG.defaultMonth || 12);
  const [activeCycle, setActiveCycle] = useState(null);

  // Fetch active cycle on mount from backend
  useEffect(() => {
    let isMounted = true;
    async function fetchActiveCycle() {
      try {
        const res = await apiClient.get('/rosters/active-cycle');
        if (isMounted && res) {
          setActiveCycle(res);
          if (res.month && res.year) {
            setSelectedMonth(res.month);
            setSelectedYear(res.year);
          }
        }
      } catch (err) {
        console.warn('[RosterCycleContext] Using fallback default cycle:', err.message);
      }
    }
    fetchActiveCycle();
    return () => {
      isMounted = false;
    };
  }, []);

  const activeLabel = `${MONTH_NAMES[selectedMonth - 1] || 'December'} ${selectedYear}`;

  const value = {
    selectedYear,
    selectedMonth,
    setSelectedYear,
    setSelectedMonth,
    activeCycle,
    activeLabel,
    setCycle: (month, year) => {
      setSelectedMonth(Number(month));
      setSelectedYear(Number(year));
    },
  };

  return (
    <RosterCycleContext.Provider value={value}>
      {children}
    </RosterCycleContext.Provider>
  );
}

export function useRosterCycle() {
  const context = useContext(RosterCycleContext);
  if (!context) {
    throw new Error('useRosterCycle must be used within a RosterCycleProvider');
  }
  return context;
}
