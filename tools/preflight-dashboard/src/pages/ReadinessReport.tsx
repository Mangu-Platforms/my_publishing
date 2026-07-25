import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  FileCheck,
  CheckCircle,
  BookCheck,
  Trophy,
  Circle,
  Lock,
  Printer,
  Copy,
  Download,
} from 'lucide-react';
import { useAppContext } from '@/hooks/useAppState';
import ProgressRing from '@/components/ProgressRing';

export default function ReadinessReport() {
  const { phases, overallProgress, completedPhaseCount, bookInfo, exportData } = useAppContext();
  const [copied, setCopied] = useState(false);

  const totalTasks = phases.reduce((sum, p) => sum + p.checklists.length, 0);
  const completedTasks = phases.reduce(
    (sum, p) => sum + p.checklists.filter(c => c.isComplete).length,
    0
  );
  const allComplete = completedPhaseCount === 13;

  const pendingItems = phases.flatMap(phase =>
    phase.checklists
      .filter(c => !c.isComplete)
      .map(c => ({ phaseId: phase.id, phaseName: phase.name, task: c }))
  );

  const handleCopySummary = async () => {
    const summary = `Pre-Flight Report: ${bookInfo.title || 'Untitled Book'} — ${overallProgress}% complete (${completedTasks}/${totalTasks} tasks, ${completedPhaseCount}/13 phases)`;
    try {
      await navigator.clipboard.writeText(summary);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = summary;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handlePrint = () => {
    window.print();
  };

  const today = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="max-w-3xl">
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
        <span className="text-brown-800 font-semibold">Readiness Report</span>
      </motion.div>

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
      >
        <h1 className="font-display text-3xl font-bold text-brown-800">
          Readiness Report
        </h1>
        <p className="text-base text-brown-600 mt-2">
          {bookInfo.title
            ? <>Production status for <em className="font-display text-brown-700 not-italic">{bookInfo.title}</em>{bookInfo.author ? <> by <em className="font-display text-brown-700 not-italic">{bookInfo.author}</em></> : ''}</>
            : 'Enter your book details to personalize this report.'}
        </p>
        <p className="text-xs text-brown-500 mt-1">Generated on {today}</p>
      </motion.div>

      {/* Completion Celebration Banner */}
      {allComplete && (
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.2 }}
          className="mt-6 bg-gradient-to-b from-cream-50 to-cream-100 border-2 border-gold-400 rounded-2xl p-8 text-center relative overflow-hidden"
        >
          <div className="absolute inset-0 opacity-10">
            {[...Array(5)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute w-3 h-3 bg-gold-400 rounded-full"
                style={{
                  left: `${20 + i * 15}%`,
                  bottom: '10%',
                }}
                animate={{
                  y: [0, -40, -80],
                  opacity: [0.4, 0.2, 0],
                }}
                transition={{
                  duration: 6 + i * 2,
                  repeat: Infinity,
                  delay: i * 1.5,
                }}
              />
            ))}
          </div>
          <motion.div
            initial={{ y: -20, scale: 0.5 }}
            animate={{ y: 0, scale: 1 }}
            transition={{ type: 'spring', stiffness: 400, damping: 15, delay: 0.4 }}
          >
            <Trophy size={48} className="text-gold-400 mx-auto mb-3" />
          </motion.div>
          <h2 className="font-display text-4xl font-bold text-gold-400">
            Production Complete!
          </h2>
          <p className="text-lg text-brown-600 mt-2">
            Your book has successfully completed all 13 pre-flight phases.
          </p>
          {bookInfo.title && (
            <p className="font-display text-2xl italic text-brown-800 mt-2">
              {bookInfo.title}
            </p>
          )}
          {(bookInfo.isbn || bookInfo.publisher) && (
            <p className="text-sm text-brown-500 mt-2">
              {bookInfo.isbn && `ISBN: ${bookInfo.isbn}`}
              {bookInfo.isbn && bookInfo.publisher && ' | '}
              {bookInfo.publisher && `Publisher: ${bookInfo.publisher}`}
            </p>
          )}
          <div className="flex gap-3 justify-center mt-5">
            <button
              onClick={handlePrint}
              className="px-5 py-2.5 bg-brown-600 text-cream-50 text-sm font-medium rounded-lg hover:bg-brown-700 transition-colors"
            >
              Export Final Report
            </button>
            <Link
              to="/settings"
              className="px-5 py-2.5 border border-cream-200 text-brown-700 text-sm font-medium rounded-lg hover:bg-cream-200 transition-colors"
            >
              Start New Book
            </Link>
          </div>
        </motion.div>
      )}

      {/* Statistics Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
          className="bg-cream-100 border border-cream-200 rounded-xl p-6 text-center"
        >
          <div className="flex justify-center">
            <ProgressRing size={64} progress={overallProgress} />
          </div>
          <p className="text-sm text-brown-600 mt-3">Overall Progress</p>
          <p className="text-xs text-brown-500">Across all 13 phases</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.38 }}
          className="bg-cream-100 border border-cream-200 rounded-xl p-6 text-center"
        >
          <CheckCircle size={32} className="text-success mx-auto" />
          <p className="font-display text-3xl font-bold text-brown-800 mt-3">
            <CountUp end={completedTasks} delay={0.5} /> / {totalTasks}
          </p>
          <p className="text-sm text-brown-600 mt-1">Tasks Completed</p>
          <p className="text-xs text-brown-500">Total checklist items</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.46 }}
          className="bg-cream-100 border border-cream-200 rounded-xl p-6 text-center"
        >
          <BookCheck size={32} className="text-gold-400 mx-auto" />
          <p className="font-display text-3xl font-bold text-brown-800 mt-3">
            <CountUp end={completedPhaseCount} delay={0.6} /> of 13
          </p>
          <p className="text-sm text-brown-600 mt-1">Phases Complete</p>
          <p className="text-xs text-brown-500">Production phases finished</p>
        </motion.div>
      </div>

      {/* Book Information Summary */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.5 }}
        className="mt-8 bg-cream-100 border border-cream-200 rounded-xl p-5"
      >
        <div className="flex items-center gap-2 mb-4">
          <FileCheck size={18} className="text-brown-600" />
          <h2 className="font-body text-lg font-semibold text-brown-800">
            Book Information
          </h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {([
            ['Title', bookInfo.title],
            ['Author', bookInfo.author],
            ['ISBN', bookInfo.isbn],
            ['Publisher', bookInfo.publisher],
            ['Trim Size', bookInfo.trimSize],
            ['Page Count', bookInfo.pageCount],
          ] as const).map(([label, value]) => (
            <motion.div
              key={label}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
            >
              <p className="text-xs text-brown-500 uppercase tracking-wide">{label}</p>
              <p className="text-sm text-brown-800 font-medium">
                {value || <span className="text-brown-400">—</span>}
              </p>
            </motion.div>
          ))}
        </div>
        <div className="mt-4 text-right">
          <Link
            to="/"
            className="text-sm text-brown-600 hover:text-brown-800 transition-colors"
          >
            Edit in Dashboard &rarr;
          </Link>
        </div>
      </motion.div>

      {/* Phase Breakdown */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.6 }}
        className="mt-8"
      >
        <span className="text-xs text-brown-500 uppercase tracking-[0.1em] font-medium">
          Phase Breakdown
        </span>
        <div className="mt-3 bg-cream-100 border border-cream-200 rounded-xl overflow-hidden">
          {phases.map((phase, index) => {
            const done = phase.checklists.filter(c => c.isComplete).length;
            const total = phase.checklists.length;
            const pct = Math.round((done / total) * 100);

            return (
              <motion.div
                key={phase.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.7 + index * 0.04, duration: 0.25 }}
                className={`
                  flex items-center gap-4 px-5 py-3.5 border-b border-cream-200 last:border-b-0
                  ${phase.isLocked ? 'opacity-60' : 'hover:bg-cream-50 transition-colors'}
                `}
              >
                {/* Phase number + icon */}
                <div className="w-12 flex-shrink-0 text-center">
                  <span className="font-display text-lg text-gold-400 block">
                    {String(phase.id).padStart(2, '0')}
                  </span>
                </div>

                {/* Phase name + status */}
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold text-brown-800 truncate ${phase.isComplete ? 'line-through opacity-70' : ''}`}>
                    {phase.name}
                  </p>
                  <span className={`
                    inline-flex items-center gap-1 text-xs mt-0.5
                    ${phase.isComplete ? 'text-success' : phase.isLocked ? 'text-cream-400' : 'text-warning'}
                  `}>
                    {phase.isComplete ? (
                      <><CheckCircle size={12} /> Complete</>
                    ) : phase.isLocked ? (
                      <><Lock size={12} /> Locked</>
                    ) : (
                      <><Circle size={12} /> In Progress</>
                    )}
                  </span>
                </div>

                {/* Progress bar */}
                <div className="w-32 lg:w-48 flex-shrink-0 hidden sm:block">
                  <div className="w-full h-1.5 bg-cream-200 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-gold-400 rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.5, ease: 'easeOut', delay: 0.8 + index * 0.05 }}
                    />
                  </div>
                </div>

                {/* Task count */}
                <span className="text-sm text-brown-600 w-12 text-right flex-shrink-0 hidden md:block">
                  {done}/{total}
                </span>

                {/* Action */}
                {!phase.isLocked && (
                  <Link
                    to={`/phase/${phase.id}`}
                    className="text-sm text-brown-600 hover:text-brown-800 transition-colors flex-shrink-0 hidden lg:block"
                  >
                    View &rarr;
                  </Link>
                )}
              </motion.div>
            );
          })}
        </div>
      </motion.div>

      {/* Pending Tasks List */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.8 }}
        className="mt-8"
      >
        <div className="flex items-center gap-2 mb-3">
          <Circle size={12} className="text-warning" />
          <span className="text-xs text-brown-500 uppercase tracking-[0.1em] font-medium">
            Pending Tasks
          </span>
        </div>
        <div className="bg-cream-100 border border-cream-200 rounded-xl overflow-hidden">
          {pendingItems.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-center">
              <CheckCircle size={48} className="text-success mb-3" />
              <p className="font-display text-xl text-success">All tasks complete!</p>
              <p className="text-sm text-brown-600 mt-1">Your book is ready for production.</p>
            </div>
          ) : (
            // Group by phase
            (() => {
              const grouped = pendingItems.reduce<Record<number, typeof pendingItems>>((acc, item) => {
                if (!acc[item.phaseId]) acc[item.phaseId] = [];
                acc[item.phaseId].push(item);
                return acc;
              }, {});

              return Object.entries(grouped).map(([phaseIdStr, items]) => {
                const phaseId = parseInt(phaseIdStr);
                return (
                  <div key={phaseId}>
                    <div className="bg-cream-200 px-5 py-2.5">
                      <p className="text-sm font-semibold text-brown-700">
                        Phase {phaseId}: {items[0].phaseName}
                      </p>
                    </div>
                    {items.map((item, i) => (
                      <motion.div
                        key={item.task.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.9 + i * 0.03 }}
                        className="flex items-center gap-3 px-5 py-3 border-b border-cream-200 last:border-b-0"
                      >
                        <div className="w-5 h-5 rounded border-2 border-cream-300 flex-shrink-0" />
                        <span className="flex-1 text-sm text-brown-700">{item.task.text}</span>
                        <Link
                          to={`/phase/${phaseId}`}
                          className="text-xs text-brown-600 hover:text-brown-800 hover:underline transition-colors flex-shrink-0"
                        >
                          Go to Phase &rarr;
                        </Link>
                      </motion.div>
                    ))}
                  </div>
                );
              });
            })()
          )}
        </div>
      </motion.div>

      {/* Export Actions Bar */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 1.0 }}
        className="mt-8 mb-8 bg-cream-100 border border-cream-200 rounded-xl px-5 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
      >
        <div className="flex items-center gap-2">
          <Download size={18} className="text-brown-600" />
          <span className="font-body text-base font-semibold text-brown-800">
            Export Report
          </span>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <button
            onClick={exportData}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-brown-600 text-cream-50 text-sm font-medium rounded-lg hover:bg-brown-700 transition-colors"
          >
            <FileCheck size={16} />
            Export as JSON
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center justify-center gap-2 px-4 py-2.5 border border-cream-200 text-brown-700 text-sm font-medium rounded-lg hover:bg-cream-200 transition-colors"
          >
            <Printer size={16} />
            Print Report
          </button>
          <button
            onClick={handleCopySummary}
            className="flex items-center justify-center gap-2 px-4 py-2.5 text-brown-600 text-sm font-medium rounded-lg hover:bg-cream-200 transition-colors"
          >
            <Copy size={16} />
            {copied ? 'Copied!' : 'Copy Summary'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

/* ─── CountUp helper ─── */

function CountUp({ end, delay = 0 }: { end: number; delay?: number }) {
  const [count, setCount] = useState(0);
  const hasStarted = useRef(false);

  useEffect(() => {
    if (hasStarted.current) return;
    hasStarted.current = true;

    const startTimer = setTimeout(() => {
      const duration = 800;
      const steps = Math.min(end, 30);
      let current = 0;
      const interval = setInterval(() => {
        current++;
        setCount(Math.min(current, end));
        if (current >= steps) {
          setCount(end);
          clearInterval(interval);
        }
      }, duration / steps);
      setTimeout(() => setCount(end), duration + 50);
    }, delay * 1000);

    return () => clearTimeout(startTimer);
  }, [end, delay]);

  return <>{count}</>;
}
