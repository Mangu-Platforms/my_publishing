import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ListChecks,
  CheckCircle,
  Circle,
  Clock,
  ArrowRight,
} from 'lucide-react';
import { useAppContext } from '@/hooks/useAppState';
import PhaseCard from '@/components/PhaseCard';

export default function Home() {
  const { bookInfo, phases, overallProgress, completedPhaseCount } = useAppContext();
  const [shakePhase, setShakePhase] = useState<number | null>(null);

  const hasBookTitle = bookInfo.title.trim().length > 0;
  const hasStarted = completedPhaseCount > 0 || overallProgress > 0;
  const showEmptyState = !hasBookTitle && !hasStarted;

  const totalTasks = phases.reduce((sum, p) => sum + p.checklists.length, 0);
  const completedTasks = phases.reduce(
    (sum, p) => sum + p.checklists.filter(c => c.isComplete).length,
    0
  );
  const pendingTasks = totalTasks - completedTasks;

  const handleLockedClick = (phaseId: number) => {
    setShakePhase(phaseId);
    setTimeout(() => setShakePhase(null), 300);
  };

  return (
    <div>
      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <h2 className="font-display text-3xl lg:text-4xl font-bold text-brown-800">
          {hasBookTitle ? bookInfo.title : 'Your Book Production Command Center'}
        </h2>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="text-base text-brown-600 mt-2 max-w-[600px] leading-relaxed"
        >
          Welcome to your pre-flight workspace. Complete each phase to prepare your book for production.
        </motion.p>

        {/* Status badge */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, delay: 0.4 }}
          className="mt-4"
        >
          {showEmptyState ? (
            <span className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-info-light text-info text-sm rounded-full font-medium">
              <span className="w-2 h-2 rounded-full bg-info" />
              Enter your book details above to get started
            </span>
          ) : completedPhaseCount === 13 ? (
            <span className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-success-light text-success text-sm rounded-full font-medium">
              <CheckCircle size={14} />
              All Phases Complete — Ready for Production!
            </span>
          ) : (
            <span className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-warning-light text-warning text-sm rounded-full font-medium">
              <span className="w-2 h-2 rounded-full bg-warning animate-pulse" />
              Phase {Math.min(completedPhaseCount + 1, 13)}: {phases[Math.min(completedPhaseCount, 12)]?.name} — In Progress
            </span>
          )}
        </motion.div>
      </motion.div>

      {/* Empty state */}
      {showEmptyState ? (
        <EmptyState />
      ) : (
        <>
          {/* Phase Grid - ALWAYS shows */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
            {phases.map((phase, index) => (
              <div
                key={phase.id}
                style={{
                  animation: shakePhase === phase.id ? 'shake 0.3s ease-in-out' : undefined,
                }}
              >
                <PhaseCard
                  phase={phase}
                  index={index}
                  onLockedClick={() => handleLockedClick(phase.id)}
                />
              </div>
            ))}
          </div>

          {/* Quick Stats Bar */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.6 }}
            className="mt-8 bg-cream-100 border border-cream-200 rounded-xl px-6 py-5"
          >
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
              <StatItem
                icon={<ListChecks size={20} className="text-brown-500" />}
                value={totalTasks}
                label="Total Tasks"
                delay={0}
              />
              <StatItem
                icon={<CheckCircle size={20} className="text-brown-500" />}
                value={completedTasks}
                label="Completed"
                delay={0.1}
              />
              <StatItem
                icon={<Circle size={20} className="text-brown-500" />}
                value={pendingTasks}
                label="Pending"
                delay={0.2}
              />
              <StatItem
                icon={<Clock size={20} className="text-brown-500" />}
                value={`${Math.ceil(pendingTasks * 0.08)}h`}
                label="Est. Time Remaining"
                delay={0.3}
                isString
              />
            </div>
          </motion.div>
        </>
      )}

      {/* Footer */}
      <motion.footer
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.8 }}
        className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-brown-500 border-t border-cream-200 pt-4"
      >
        <span>Pre-Flight Book Production Tool v1.0</span>
        <span className="text-brown-400">All progress is saved locally in your browser</span>
      </motion.footer>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-4px); }
          50% { transform: translateX(4px); }
          75% { transform: translateX(-4px); }
        }
      `}</style>
    </div>
  );
}

/* ─── CountUp with useEffect (NOT useState) ─── */

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

      // Ensure final value is set
      setTimeout(() => setCount(end), duration + 50);
    }, delay * 1000);

    return () => clearTimeout(startTimer);
  }, [end, delay]);

  return <>{count}</>;
}

/* ─── Stat Item ─── */

function StatItem({
  icon,
  value,
  label,
  delay,
  isString = false,
}: {
  icon: React.ReactNode;
  value: number | string;
  label: string;
  delay: number;
  isString?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.7 + delay }}
      className="flex items-center gap-3"
    >
      {icon}
      <div>
        <p className="font-display text-2xl font-bold text-brown-800">
          {isString ? value : <CountUp end={value as number} delay={delay} />}
        </p>
        <p className="text-xs text-brown-500 uppercase tracking-wide">{label}</p>
      </div>
    </motion.div>
  );
}

/* ─── Empty State ─── */

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center max-w-[500px] mx-auto mt-16 text-center">
      {/* SVG Illustration (inline since we may not have the file) */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, delay: 0.3 }}
        className="w-[200px] h-[160px] mb-4"
      >
        <svg viewBox="0 0 200 160" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="40" y="20" width="120" height="100" rx="8" fill="#F7F3EC" stroke="#EDE7DA" strokeWidth="2"/>
          <path d="M100 20V120" stroke="#EDE7DA" strokeWidth="2"/>
          <path d="M60 45H85" stroke="#DFD5C3" strokeWidth="3" strokeLinecap="round"/>
          <path d="M60 55H80" stroke="#DFD5C3" strokeWidth="3" strokeLinecap="round"/>
          <path d="M60 65H90" stroke="#DFD5C3" strokeWidth="3" strokeLinecap="round"/>
          <path d="M115 45H140" stroke="#DFD5C3" strokeWidth="3" strokeLinecap="round"/>
          <path d="M115 55H135" stroke="#DFD5C3" strokeWidth="3" strokeLinecap="round"/>
          <path d="M115 65H145" stroke="#DFD5C3" strokeWidth="3" strokeLinecap="round"/>
          <rect x="75" y="130" width="50" height="6" rx="3" fill="#EDE7DA"/>
          <path d="M155 80L165 70" stroke="#D4A853" strokeWidth="2" strokeLinecap="round"/>
          <path d="M160 85L170 75" stroke="#D4A853" strokeWidth="2" strokeLinecap="round"/>
          <circle cx="168" cy="68" r="4" fill="#D4A853" opacity="0.3"/>
        </svg>
      </motion.div>

      <motion.h3
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.5 }}
        className="font-display text-3xl text-brown-800 mt-6"
      >
        Let's Get Started
      </motion.h3>
      <motion.p
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.6 }}
        className="text-base text-brown-600 mt-2 leading-relaxed"
      >
        Enter your book details above, then work through each production phase to prepare your manuscript for the press.
      </motion.p>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, delay: 0.7 }}
      >
        <Link
          to="/phase/1"
          className="inline-flex items-center gap-2 mt-6 px-6 py-3 bg-brown-600 text-cream-50 text-sm font-medium rounded-lg hover:bg-brown-700 transition-colors"
        >
          Start Phase 1
          <ArrowRight size={16} />
        </Link>
      </motion.div>
    </div>
  );
}
