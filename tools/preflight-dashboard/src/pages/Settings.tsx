import { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Trash2,
  Upload,
  Download,
  SlidersHorizontal,
  Database,
  Keyboard,
  BookOpen,
  ExternalLink,
  Bug,
  Shield,
  AlertTriangle,
} from 'lucide-react';
import { useAppContext } from '@/hooks/useAppState';

export default function Settings() {
  const {
    resetProgress,
    exportData,
    importData,
    settings,
    updateSettings,
  } = useAppContext();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [pendingImportJson, setPendingImportJson] = useState<string | null>(null);
  const [importFileName, setImportFileName] = useState<string | null>(null);

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const json = ev.target?.result as string;
      setPendingImportJson(json);
      setShowImportDialog(true);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const confirmImport = () => {
    if (pendingImportJson) {
      const success = importData(pendingImportJson);
      setImportStatus(success ? 'Import successful!' : 'Import failed. Invalid file format.');
      setShowImportDialog(false);
      setPendingImportJson(null);
      setImportFileName(null);
      setTimeout(() => setImportStatus(null), 3000);
    }
  };

  const cancelImport = () => {
    setShowImportDialog(false);
    setPendingImportJson(null);
    setImportFileName(null);
  };

  const handleResetProgress = () => {
    resetProgress();
    setShowResetDialog(false);
  };

  const toggleSetting = (key: keyof typeof settings) => {
    updateSettings({ [key]: !settings[key] });
  };

  return (
    <div className="max-w-2xl">
      {/* Breadcrumb */}
      <motion.div
        initial={{ opacity: 0, x: -8 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3 }}
        className="flex items-center gap-2 text-sm text-brown-600 mb-6"
      >
        <Link to="/" className="text-brown-600 hover:text-brown-800 hover:underline">
          Dashboard
        </Link>
        <span className="text-cream-300">/</span>
        <span className="text-brown-800 font-semibold">Settings</span>
      </motion.div>

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
      >
        <h1 className="font-display text-3xl font-bold text-brown-800">
          Settings
        </h1>
        <p className="text-base text-brown-600 mt-2">
          Customize your Pre-Flight experience.
        </p>
      </motion.div>

      {/* Preferences */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.3 }}
        className="mt-6 bg-cream-100 border border-cream-200 rounded-xl overflow-hidden"
      >
        <div className="bg-cream-200 px-5 py-3.5 flex items-center gap-2">
          <SlidersHorizontal size={18} className="text-brown-600" />
          <h2 className="font-body text-base font-semibold text-brown-800">
            Preferences
          </h2>
        </div>
        <div className="divide-y divide-cream-200">
          <ToggleRow
            name="Compact Mode"
            description="Reduce padding and font sizes for a denser interface"
            enabled={settings.compactMode}
            onToggle={() => toggleSetting('compactMode')}
            delay={0.4}
          />
          <ToggleRow
            name="Show Tooltips"
            description="Display helpful tooltips when hovering over publishing terms"
            enabled={settings.showTooltips}
            onToggle={() => toggleSetting('showTooltips')}
            delay={0.46}
          />
          <ToggleRow
            name="Sound Effects"
            description="Play subtle sound effects on task completion and milestones"
            enabled={settings.soundEffects}
            onToggle={() => toggleSetting('soundEffects')}
            delay={0.52}
          />
          <ToggleRow
            name="Confirm Phase Skip"
            description="Show a confirmation dialog when marking a phase complete with unchecked items"
            enabled={settings.confirmPhaseSkip}
            onToggle={() => toggleSetting('confirmPhaseSkip')}
            delay={0.58}
          />
        </div>
      </motion.div>

      {/* Data Management */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.5 }}
        className="mt-6 bg-cream-100 border border-cream-200 rounded-xl overflow-hidden"
      >
        <div className="bg-cream-200 px-5 py-3.5 flex items-center gap-2">
          <Database size={18} className="text-brown-600" />
          <h2 className="font-body text-base font-semibold text-brown-800">
            Data Management
          </h2>
        </div>
        <div className="divide-y divide-cream-200">
          {/* Export */}
          <motion.div
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.6, duration: 0.25 }}
            className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4"
          >
            <div>
              <p className="text-sm font-medium text-brown-800">Export All Data</p>
              <p className="text-xs text-brown-500">Download all book data, checklists, and progress as a JSON file</p>
            </div>
            <button
              onClick={exportData}
              className="flex items-center justify-center gap-2 px-4 py-2 border border-cream-200 text-brown-700 text-sm font-medium rounded-lg hover:bg-cream-200 transition-colors w-full sm:w-auto"
            >
              <Download size={14} />
              Export JSON
            </button>
          </motion.div>

          {/* Import */}
          <motion.div
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.66, duration: 0.25 }}
            className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4"
          >
            <div>
              <p className="text-sm font-medium text-brown-800">Import Data</p>
              <p className="text-xs text-brown-500">Restore progress from a previously exported JSON file</p>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleImportFile}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center justify-center gap-2 px-4 py-2 border border-cream-200 text-brown-700 text-sm font-medium rounded-lg hover:bg-cream-200 transition-colors w-full sm:w-auto"
              >
                <Upload size={14} />
                Choose File
              </button>
            </div>
          </motion.div>
          {importStatus && (
            <p className={`px-5 pb-3 text-xs ${importStatus.includes('successful') ? 'text-success' : 'text-error'}`}>
              {importStatus}
            </p>
          )}

          {/* Reset */}
          <motion.div
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.72, duration: 0.25 }}
            className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4"
          >
            <div>
              <p className="text-sm font-medium text-brown-800">Reset All Progress</p>
              <p className="text-xs text-brown-500">Clear all checklist data and start fresh. Book info will be preserved.</p>
            </div>
            <button
              onClick={() => setShowResetDialog(true)}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-error text-white text-sm font-medium rounded-lg hover:opacity-90 transition-colors w-full sm:w-auto"
            >
              <Trash2 size={14} />
              Reset...
            </button>
          </motion.div>
        </div>
      </motion.div>

      {/* Keyboard Shortcuts */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.7 }}
        className="mt-6 bg-cream-100 border border-cream-200 rounded-xl overflow-hidden"
      >
        <div className="bg-cream-200 px-5 py-3.5 flex items-center gap-2">
          <Keyboard size={18} className="text-brown-600" />
          <h2 className="font-body text-base font-semibold text-brown-800">
            Keyboard Shortcuts
          </h2>
        </div>
        <div className="px-5 py-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {shortcuts.map(([shortcut, action], i) => (
              <motion.div
                key={shortcut}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.8 + i * 0.04, duration: 0.2 }}
                className="flex items-center justify-between gap-3"
              >
                <span className="text-sm text-brown-700">{action}</span>
                <kbd className="px-2 py-0.5 bg-cream-50 border border-cream-300 rounded text-xs font-mono text-brown-700 shadow-[0_1px_0_#DFD5C3] flex-shrink-0">
                  {shortcut}
                </kbd>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* About */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.9 }}
        className="mt-6 mb-8 bg-cream-100 border border-cream-200 rounded-xl p-5"
      >
        <div className="flex items-center gap-3 mb-3">
          <BookOpen size={24} className="text-gold-400" />
          <div>
            <h2 className="font-display text-xl text-brown-800">
              Pre-Flight Book Production Tool
            </h2>
            <p className="text-xs text-brown-500">Version 1.0.0</p>
          </div>
        </div>
        <p className="text-sm text-brown-600 leading-relaxed max-w-[500px]">
          A comprehensive pre-production checklist tool for authors, editors, and publishers.
          Guide your book through all 13 phases of preparation before it enters the design and printing workflow.
        </p>
        <div className="h-px bg-cream-200 my-4" />
        <div className="flex flex-wrap gap-4">
          <a href="#" className="flex items-center gap-1 text-sm text-brown-600 hover:text-brown-800 transition-colors">
            <ExternalLink size={12} />
            Documentation
          </a>
          <a href="#" className="flex items-center gap-1 text-sm text-brown-600 hover:text-brown-800 transition-colors">
            <Bug size={12} />
            Report an Issue
          </a>
          <a href="#" className="flex items-center gap-1 text-sm text-brown-600 hover:text-brown-800 transition-colors">
            <Shield size={12} />
            Privacy
          </a>
        </div>
        <p className="text-xs text-brown-400 italic mt-3">
          Built with care for the publishing community.
        </p>
      </motion.div>

      {/* ─── Reset Confirmation Dialog ─── */}
      <AnimatePresence>
        {showResetDialog && (
          <ConfirmDialog
            title="Reset All Progress?"
            message="This will uncheck all tasks and reset all phases to 'Not Started'. Your book information will be kept. This action cannot be undone."
            confirmLabel="Reset Progress"
            confirmVariant="danger"
            onConfirm={handleResetProgress}
            onCancel={() => setShowResetDialog(false)}
          />
        )}
      </AnimatePresence>

      {/* ─── Import Confirmation Dialog ─── */}
      <AnimatePresence>
        {showImportDialog && (
          <ConfirmDialog
            title="Import Data?"
            message={`This will replace your current progress with the imported data from "${importFileName || 'selected file'}". Your book info will be overwritten if present in the import.`}
            confirmLabel="Import and Replace"
            confirmVariant="primary"
            onConfirm={confirmImport}
            onCancel={cancelImport}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── Toggle Row ─── */

function ToggleRow({
  name,
  description,
  enabled,
  onToggle,
  delay,
}: {
  name: string;
  description: string;
  enabled: boolean;
  onToggle: () => void;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay, duration: 0.25 }}
      className="flex items-center justify-between gap-4 px-5 py-4"
    >
      <div>
        <p className="text-sm font-medium text-brown-800">{name}</p>
        <p className="text-xs text-brown-500 mt-0.5">{description}</p>
      </div>
      <button
        onClick={onToggle}
        className={`
          relative w-11 h-6 rounded-full transition-colors duration-200 flex-shrink-0
          ${enabled ? 'bg-brown-600' : 'bg-cream-300'}
        `}
        aria-label={`Toggle ${name}`}
      >
        <motion.div
          animate={{ x: enabled ? 20 : 2 }}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          className="absolute top-1 w-4 h-4 bg-cream-50 rounded-full shadow-sm"
        />
      </button>
    </motion.div>
  );
}

/* ─── Confirm Dialog ─── */

function ConfirmDialog({
  title,
  message,
  confirmLabel,
  confirmVariant,
  onConfirm,
  onCancel,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  confirmVariant: 'danger' | 'primary';
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center"
    >
      <div
        className="absolute inset-0 bg-[rgba(31,24,13,0.45)] backdrop-blur-sm"
        onClick={onCancel}
      />
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        className="relative bg-cream-50 border border-cream-200 rounded-xl shadow-lg p-6 max-w-md mx-4 w-full"
      >
        <div className="flex items-start gap-3 mb-4">
          {confirmVariant === 'danger' && (
            <AlertTriangle size={24} className="text-error flex-shrink-0 mt-0.5" />
          )}
          <div>
            <h3 className="font-display text-xl font-semibold text-brown-800">{title}</h3>
            <p className="text-sm text-brown-600 mt-2">{message}</p>
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-brown-600 text-sm font-medium rounded-lg hover:bg-cream-100 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={`
              px-4 py-2 text-sm font-medium rounded-lg transition-colors
              ${confirmVariant === 'danger'
                ? 'bg-error text-white hover:opacity-90'
                : 'bg-brown-600 text-cream-50 hover:bg-brown-700'
              }
            `}
          >
            {confirmLabel}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ─── Keyboard Shortcuts Data ─── */

const shortcuts: [string, string][] = [
  ['Esc', 'Close modals, cancel editing'],
  ['Enter', 'Save edit, confirm action'],
  ['Tab', 'Navigate between interactive elements'],
  ['Ctrl + D', 'Go to Dashboard'],
  ['Ctrl + R', 'Go to Readiness Report'],
  ['Ctrl + ,', 'Open Settings'],
  ['1 \u2013 9', 'Navigate to Phase 1\u20139'],
  ['Space', 'Toggle focused checklist item'],
  ['\u2191 / \u2193', 'Navigate checklist items'],
  ['?', 'Show keyboard shortcuts reference'],
];
