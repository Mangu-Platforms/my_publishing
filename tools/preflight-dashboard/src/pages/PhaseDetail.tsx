import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle,
  Circle,
  Home,
  Trophy,
} from 'lucide-react';
import { useAppContext } from '@/hooks/useAppState';
import ChecklistItem from '@/components/ChecklistItem';
import AIPromptPanel from '@/components/AIPromptPanel';

export default function PhaseDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { phases, toggleTask, navigateToPhase, isPhaseUnlocked } = useAppContext();
  const [showCelebration, setShowCelebration] = useState(false);
  const [showFinalCelebration, setShowFinalCelebration] = useState(false);

  const phaseId = parseInt(id || '1', 10);
  const phase = phases.find(p => p.id === phaseId);

  useEffect(() => {
    if (phase && !phase.isLocked) {
      navigateToPhase(phaseId);
    }
  }, [phaseId, phase?.isLocked]);

  // Redirect if phase is locked
  useEffect(() => {
    if (phase?.isLocked) {
      // Find the first unlocked phase and redirect
      const firstUnlocked = phases.find(p => !p.isLocked);
      if (firstUnlocked && firstUnlocked.id !== phaseId) {
        navigate(`/phase/${firstUnlocked.id}`);
      }
    }
  }, [phase?.isLocked, phaseId, phases, navigate]);

  // Check if all items are completed for celebration
  useEffect(() => {
    if (phase && phase.checklists.every(c => c.isComplete) && phase.checklists.length > 0) {
      setShowCelebration(true);
      const timer = setTimeout(() => setShowCelebration(false), 3000);
      return () => clearTimeout(timer);
    } else {
      setShowCelebration(false);
    }
  }, [phase?.checklists.map(c => c.isComplete).join(',')]);

  if (!phase) {
    return (
      <div className="text-center py-20">
        <h2 className="font-display text-2xl text-brown-800">Phase not found</h2>
        <Link to="/" className="text-brown-600 hover:text-brown-800 mt-4 inline-block">
          Back to Dashboard
        </Link>
      </div>
    );
  }

  const completedCount = phase.checklists.filter(c => c.isComplete).length;
  const totalCount = phase.checklists.length;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const isComplete = completedCount === totalCount && totalCount > 0;

  const prevPhase = phases.find(p => p.id === phaseId - 1);
  const nextPhase = phases.find(p => p.id === phaseId + 1);
  const isLastPhase = phaseId === 13;

  const handleMarkComplete = () => {
    if (!isComplete) return;

    if (isLastPhase) {
      setShowFinalCelebration(true);
    } else if (nextPhase && isPhaseUnlocked(nextPhase.id)) {
      navigate(`/phase/${nextPhase.id}`);
    }
  };

  return (
    <div className="max-w-3xl">
      {/* Phase complete celebration overlay */}
      <AnimatePresence>
        {showCelebration && isComplete && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none"
          >
            <div className="absolute inset-0 bg-[rgba(31,24,13,0.2)]" />
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              className="relative bg-cream-50 border border-cream-200 rounded-2xl p-8 text-center shadow-lg pointer-events-auto max-w-sm mx-4"
            >
              <CheckCircle size={48} className="text-success mx-auto mb-3" />
              <h3 className="font-display text-2xl font-bold text-brown-800">
                Phase Complete!
              </h3>
              <p className="text-brown-600 mt-2">
                {phase.name} is finished. Great work!
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Final celebration modal */}
      <AnimatePresence>
        {showFinalCelebration && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center"
          >
            <div
              className="absolute inset-0 bg-[rgba(31,24,13,0.45)] backdrop-blur-sm"
              onClick={() => setShowFinalCelebration(false)}
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              className="relative bg-cream-50 border-2 border-gold-400 rounded-2xl p-8 text-center shadow-lg max-w-md mx-4"
            >
              <Trophy size={56} className="text-gold-400 mx-auto mb-4" />
              <h3 className="font-display text-3xl font-bold text-gold-400">
                Book Production Complete!
              </h3>
              <p className="text-brown-600 mt-3">
                All 13 phases are finished. Your book is ready for InDesign.
              </p>
              <div className="flex gap-3 justify-center mt-6">
                <Link
                  to="/report"
                  className="px-5 py-2.5 bg-brown-600 text-cream-50 text-sm font-medium rounded-lg hover:bg-brown-700 transition-colors"
                >
                  View Readiness Report
                </Link>
                <button
                  onClick={() => setShowFinalCelebration(false)}
                  className="px-5 py-2.5 text-brown-600 text-sm font-medium rounded-lg hover:bg-cream-100 transition-colors"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Breadcrumb */}
      <motion.div
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3 }}
        className="flex items-center gap-2 text-sm text-brown-600 mb-6"
      >
        <Link
          to="/"
          className="text-brown-600 hover:text-brown-800 hover:underline flex items-center gap-1"
        >
          <Home size={14} />
          Dashboard
        </Link>
        <span className="text-cream-300">/</span>
        <span className="text-brown-800 font-semibold">
          Phase {phase.id}: {phase.name}
        </span>
      </motion.div>

      {/* Phase Header */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4 }}
      >
        <div className="flex items-baseline gap-4 flex-wrap">
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="font-display text-4xl text-gold-400 font-normal"
          >
            {String(phase.id).padStart(2, '0')}
          </motion.span>
          <motion.h1
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="font-display text-3xl font-bold text-brown-800"
          >
            {phase.name}
          </motion.h1>
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2, delay: 0.3 }}
            className={`
              inline-flex items-center gap-1.5 text-xs px-3 py-1 rounded-full font-medium
              ${isComplete ? 'bg-success-light text-success' : 'bg-warning-light text-warning'}
            `}
          >
            {isComplete ? <CheckCircle size={12} /> : <Circle size={12} />}
            {isComplete ? 'Complete' : 'In Progress'}
          </motion.span>
        </div>

        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="text-base text-brown-600 mt-2 max-w-[680px] leading-relaxed"
        >
          {phase.description}
        </motion.p>

        {/* Progress Summary Bar */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
          className="mt-6 bg-cream-100 border border-cream-200 rounded-[10px] px-5 py-4 flex flex-col sm:flex-row items-center gap-4"
        >
          <div className="flex-1 w-full max-w-[400px]">
            <div className="w-full h-2 bg-cream-200 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gold-400 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${progressPercent}%` }}
                transition={{ duration: 0.6, ease: 'easeOut', delay: 0.6 }}
              />
            </div>
          </div>
          <span className="text-sm text-brown-600 whitespace-nowrap">
            {completedCount} of {totalCount} tasks complete
          </span>
          <span className="font-display text-2xl font-bold text-gold-400 whitespace-nowrap">
            {progressPercent}%
          </span>
        </motion.div>
      </motion.div>

      {/* Checklist */}
      <div className="mt-8">
        <span className="text-xs text-brown-500 uppercase tracking-[0.1em] font-medium">
          Checklist
        </span>
        <div className="mt-3 space-y-2">
          {phase.checklists.map((item, index) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 + index * 0.05, duration: 0.3 }}
            >
              <ChecklistItem
                text={item.text}
                isComplete={item.isComplete}
                guidance={item.guidance}
                tooltipTerm={item.tooltipTerm}
                onToggle={() => toggleTask(phase.id, item.id)}
              />
            </motion.div>
          ))}
        </div>
      </div>

      {/* AI Prompt Panel */}
      <AIPromptPanel prompt={phase.aiPrompt} phaseComplete={isComplete} />

      {/* Phase Navigation Footer */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.5 }}
        className="mt-8 pt-4 border-t border-cream-200 flex flex-col sm:flex-row items-center justify-between gap-4 mb-8"
      >
        {/* Previous */}
        <Link
          to={prevPhase ? `/phase/${prevPhase.id}` : '/'}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-brown-600 hover:bg-cream-100 transition-colors cursor-pointer"
        >
          <ArrowLeft size={16} />
          {prevPhase ? 'Previous Phase' : 'Dashboard'}
        </Link>

        {/* Phase dots */}
        <div className="flex items-center gap-1.5">
          <span className="text-sm text-brown-500 mr-2">
            Phase {phase.id} of 13
          </span>
          {phases.map(p => {
            const isCurrent = p.id === phaseId;
            return (
              <Link
                key={p.id}
                to={p.isLocked ? '#' : `/phase/${p.id}`}
                onClick={(e) => {
                  if (p.isLocked) e.preventDefault();
                }}
                className={`
                  w-2 h-2 rounded-full transition-colors
                  ${p.isComplete ? 'bg-success' : isCurrent ? 'bg-gold-400 ring-2 ring-brown-800' : p.isLocked ? 'bg-cream-300' : 'bg-cream-300'}
                `}
                title={p.name}
              />
            );
          })}
        </div>

        {/* Next / Complete */}
        {isComplete && nextPhase && !isLastPhase ? (
          <Link
            to={`/phase/${nextPhase.id}`}
            className="flex items-center gap-2 px-5 py-2.5 bg-brown-600 text-cream-50 text-sm font-medium rounded-lg hover:bg-brown-700 transition-colors"
          >
            Next Phase
            <ArrowRight size={16} />
          </Link>
        ) : isComplete && isLastPhase ? (
          <button
            onClick={handleMarkComplete}
            className="flex items-center gap-2 px-5 py-2.5 bg-success text-white text-sm font-medium rounded-lg hover:opacity-90 transition-colors"
          >
            <CheckCircle size={16} />
            Complete Production
          </button>
        ) : (
          <button
            disabled
            className="flex items-center gap-2 px-5 py-2.5 bg-brown-600 text-cream-50 text-sm font-medium rounded-lg opacity-50 cursor-not-allowed"
          >
            <CheckCircle size={16} />
            Mark Complete
          </button>
        )}
      </motion.div>
    </div>
  );
}
