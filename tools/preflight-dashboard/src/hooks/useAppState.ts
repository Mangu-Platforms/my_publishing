import { useState, useCallback, useEffect, createContext, useContext } from 'react';
import { phases as initialPhases } from '@/data/phases';
import type { Phase } from '@/data/phases';

export interface BookInfo {
  title: string;
  author: string;
  isbn: string;
  publisher: string;
  trimSize: string;
  pageCount: string;
}

interface Settings {
  compactMode: boolean;
  showTooltips: boolean;
  soundEffects: boolean;
  confirmPhaseSkip: boolean;
}

interface AppState {
  bookInfo: BookInfo;
  phases: Phase[];
  currentPhase: number;
  completedTasks: string[];
  settings: Settings;
}

interface AppContextValue {
  bookInfo: BookInfo;
  phases: Phase[];
  currentPhase: number;
  completedTasks: Set<string>;
  overallProgress: number;
  completedPhaseCount: number;
  settings: Settings;
  toggleTask: (phaseId: number, taskId: string) => void;
  setBookInfo: (field: keyof BookInfo, value: string) => void;
  navigateToPhase: (phaseId: number) => void;
  resetProgress: () => void;
  exportData: () => string;
  importData: (json: string) => boolean;
  isPhaseUnlocked: (phaseId: number) => boolean;
  updateSettings: (settings: Partial<Settings>) => void;
  resetAllData: () => void;
}

const STORAGE_KEY = 'preflight-book-tool';

const defaultBookInfo: BookInfo = {
  title: '',
  author: '',
  isbn: '',
  publisher: '',
  trimSize: '',
  pageCount: '',
};

const defaultSettings: Settings = {
  compactMode: false,
  showTooltips: true,
  soundEffects: false,
  confirmPhaseSkip: true,
};

function loadState(): AppState {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return {
        bookInfo: { ...defaultBookInfo, ...parsed.bookInfo },
        phases: parsed.phases || initialPhases.map(p => ({ ...p, checklists: p.checklists.map(c => ({ ...c })) })),
        currentPhase: parsed.currentPhase || 1,
        completedTasks: parsed.completedTasks || [],
        settings: { ...defaultSettings, ...parsed.settings },
      };
    }
  } catch {
    // ignore parse errors
  }
  return {
    bookInfo: { ...defaultBookInfo },
    phases: initialPhases.map(p => ({ ...p, checklists: p.checklists.map(c => ({ ...c })) })),
    currentPhase: 1,
    completedTasks: [],
    settings: { ...defaultSettings },
  };
}

function saveState(state: AppState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore storage errors
  }
}

export const AppContext = createContext<AppContextValue | null>(null);

export function useAppStateProvider() {
  const [state, setState] = useState<AppState>(loadState);

  // Persist to localStorage whenever state changes
  useEffect(() => {
    saveState(state);
  }, [state]);

  const completedTasksSet = new Set(state.completedTasks);

  // Compute phase completion and locking
  const phasesWithStatus = state.phases.map((phase, index) => {
    const phaseTaskIds = phase.checklists.map(c => c.id);
    const phaseCompletedCount = phaseTaskIds.filter(id => completedTasksSet.has(id)).length;
    const isComplete = phaseCompletedCount === phase.checklists.length && phase.checklists.length > 0;
    // Phase 1 always unlocked; Phase N unlocked when Phase N-1 is 100% complete
    let isLocked = false;
    if (index > 0) {
      const prevPhase = state.phases[index - 1];
      const prevCompleted = prevPhase.checklists.every(c => completedTasksSet.has(c.id));
      isLocked = !prevCompleted;
    }

    return {
      ...phase,
      isComplete,
      isLocked,
      checklists: phase.checklists.map(c => ({
        ...c,
        isComplete: completedTasksSet.has(c.id),
      })),
    };
  });

  const completedPhaseCount = phasesWithStatus.filter(p => p.isComplete).length;
  const totalTasks = state.phases.reduce((sum, p) => sum + p.checklists.length, 0);
  const overallProgress = totalTasks > 0 ? Math.round((state.completedTasks.length / totalTasks) * 100) : 0;

  const toggleTask = useCallback((phaseId: number, taskId: string) => {
    setState(prev => {
      const newCompleted = new Set(prev.completedTasks);
      if (newCompleted.has(taskId)) {
        newCompleted.delete(taskId);
      } else {
        newCompleted.add(taskId);
      }
      return {
        ...prev,
        completedTasks: Array.from(newCompleted),
        currentPhase: phaseId,
      };
    });
  }, []);

  const setBookInfoField = useCallback((field: keyof BookInfo, value: string) => {
    setState(prev => ({
      ...prev,
      bookInfo: { ...prev.bookInfo, [field]: value },
    }));
  }, []);

  const navigateToPhase = useCallback((phaseId: number) => {
    setState(prev => ({ ...prev, currentPhase: phaseId }));
  }, []);

  const resetProgress = useCallback(() => {
    setState(prev => ({
      ...prev,
      phases: initialPhases.map(p => ({ ...p, checklists: p.checklists.map(c => ({ ...c })) })),
      completedTasks: [],
      currentPhase: 1,
    }));
  }, []);

  const resetAllData = useCallback(() => {
    setState({
      bookInfo: { ...defaultBookInfo },
      phases: initialPhases.map(p => ({ ...p, checklists: p.checklists.map(c => ({ ...c })) })),
      currentPhase: 1,
      completedTasks: [],
      settings: { ...defaultSettings },
    });
  }, []);

  const exportData = useCallback(() => {
    const exportObj = {
      bookInfo: state.bookInfo,
      completedTasks: state.completedTasks,
      currentPhase: state.currentPhase,
      settings: state.settings,
      exportedAt: new Date().toISOString(),
    };
    const json = JSON.stringify(exportObj, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const timestamp = new Date().toISOString().split('T')[0];
    const safeTitle = (state.bookInfo.title || 'book').replace(/[^a-z0-9]/gi, '-').toLowerCase();
    a.download = `preflight-${safeTitle}-${timestamp}.json`;
    a.click();
    URL.revokeObjectURL(url);
    return json;
  }, [state]);

  const importData = useCallback((json: string) => {
    try {
      const parsed = JSON.parse(json);
      if (Array.isArray(parsed.completedTasks)) {
        setState(prev => ({
          ...prev,
          bookInfo: { ...defaultBookInfo, ...parsed.bookInfo },
          completedTasks: parsed.completedTasks,
          currentPhase: parsed.currentPhase || 1,
          settings: { ...defaultSettings, ...parsed.settings },
        }));
        return true;
      }
    } catch {
      // ignore parse errors
    }
    return false;
  }, []);

  const isPhaseUnlocked = useCallback((phaseId: number) => {
    if (phaseId === 1) return true;
    const phaseIndex = phaseId - 1;
    const prevPhase = phasesWithStatus[phaseIndex - 1];
    return prevPhase ? prevPhase.isComplete : false;
  }, [phasesWithStatus]);

  const updateSettings = useCallback((newSettings: Partial<Settings>) => {
    setState(prev => ({
      ...prev,
      settings: { ...prev.settings, ...newSettings },
    }));
  }, []);

  return {
    bookInfo: state.bookInfo,
    phases: phasesWithStatus,
    currentPhase: state.currentPhase,
    completedTasks: completedTasksSet,
    overallProgress,
    completedPhaseCount,
    settings: state.settings,
    toggleTask,
    setBookInfo: setBookInfoField,
    navigateToPhase,
    resetProgress,
    exportData,
    importData,
    isPhaseUnlocked,
    updateSettings,
    resetAllData,
  };
}

export function useAppContext() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppContext must be used within AppContext.Provider');
  return ctx;
}
