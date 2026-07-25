import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BookOpen,
  FileCheck,
  Settings,
  Lock,
  Menu,
  X,
} from 'lucide-react';
import { useAppContext } from '@/hooks/useAppState';
import { useViewport } from '@/hooks/useViewport';
import ProgressRing from './ProgressRing';

const springTransition = { type: 'spring' as const, stiffness: 300, damping: 30 };

export default function Sidebar() {
  const { phases, overallProgress, completedPhaseCount } = useAppContext();
  const location = useLocation();
  const { isMobile, isTablet, isDesktop } = useViewport();
  const [mobileOpen, setMobileOpen] = useState(false);

  const sidebarWidth = isDesktop ? 280 : isTablet ? 64 : 0;

  const handlePhaseClick = () => {
    if (isMobile) {
      setMobileOpen(false);
    }
  };

  return (
    <>
      {/* Mobile hamburger button */}
      {isMobile && (
        <button
          onClick={() => setMobileOpen(true)}
          className="fixed top-[84px] left-4 z-40 p-2 bg-cream-100 border border-cream-200 rounded-lg shadow-sm"
          aria-label="Open menu"
        >
          <Menu size={20} className="text-brown-800" />
        </button>
      )}

      {/* Mobile overlay drawer */}
      <AnimatePresence>
        {isMobile && mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-[rgba(31,24,13,0.45)] z-50"
              onClick={() => setMobileOpen(false)}
            />
            <motion.div
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              className="fixed left-0 top-0 bottom-0 w-[280px] bg-cream-100 z-50 flex flex-col border-r border-cream-200"
            >
              <SidebarContent
                phases={phases}
                overallProgress={overallProgress}
                completedPhaseCount={completedPhaseCount}
                location={location}
                onPhaseClick={handlePhaseClick}
                isCollapsed={false}
                onClose={() => setMobileOpen(false)}
                showCloseButton
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Desktop / Tablet Sidebar */}
      {!isMobile && (
        <motion.aside
          initial={{ x: -280 }}
          animate={{ x: 0, width: sidebarWidth }}
          transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number] }}
          className="fixed left-0 top-[72px] h-[calc(100dvh-72px)] bg-cream-100 border-r border-cream-200 flex flex-col overflow-hidden z-40"
          style={{ width: sidebarWidth }}
        >
          <SidebarContent
            phases={phases}
            overallProgress={overallProgress}
            completedPhaseCount={completedPhaseCount}
            location={location}
            onPhaseClick={handlePhaseClick}
            isCollapsed={isTablet}
          />
        </motion.aside>
      )}
    </>
  );
}

/* ─── Sidebar Content (shared between mobile & desktop) ─── */

interface SidebarContentProps {
  phases: { id: number; name: string; isLocked: boolean; isComplete: boolean }[];
  overallProgress: number;
  completedPhaseCount: number;
  location: { pathname: string };
  onPhaseClick: () => void;
  isCollapsed: boolean;
  onClose?: () => void;
  showCloseButton?: boolean;
}

function SidebarContent({
  phases,
  overallProgress,
  completedPhaseCount,
  location,
  onPhaseClick,
  isCollapsed,
  onClose,
  showCloseButton,
}: SidebarContentProps) {
  return (
    <>
      {/* Logo */}
      <div className="px-5 py-5 border-b border-cream-200">
        <div className="flex items-center gap-2">
          <BookOpen size={24} className="text-brown-800 flex-shrink-0" />
          {!isCollapsed && (
            <div className="flex-1 min-w-0">
              <h1 className="font-display text-xl font-semibold text-brown-800 leading-tight">
                Pre-Flight
              </h1>
              <p className="text-sm text-brown-500 font-body">Book Production Tool</p>
            </div>
          )}
          {showCloseButton && onClose && (
            <button onClick={onClose} className="ml-auto p-1 hover:bg-cream-200 rounded">
              <X size={20} className="text-brown-600" />
            </button>
          )}
        </div>
      </div>

      {/* Progress */}
      <div className="px-5 py-5 border-b border-cream-200 flex flex-col items-center">
        <ProgressRing
          size={isCollapsed ? 40 : 56}
          progress={overallProgress}
        />
        {!isCollapsed && (
          <p className="text-sm text-brown-600 mt-2 text-center">
            {completedPhaseCount} of 13 Phases Complete
          </p>
        )}
      </div>

      {/* Phase List */}
      <div className="flex-1 overflow-y-auto py-2">
        {phases.map((phase, index) => {
          const isActive = location.pathname === `/phase/${phase.id}`;
          const isLocked = phase.isLocked;
          const delay = 0.2 + index * 0.04;

          return (
            <motion.div
              key={phase.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay, duration: 0.3 }}
            >
              <Link
                to={isLocked ? '#' : `/phase/${phase.id}`}
                onClick={(e) => {
                  if (isLocked) {
                    e.preventDefault();
                    return;
                  }
                  onPhaseClick();
                }}
                className={`
                  flex items-center h-12 px-5 relative transition-colors duration-200
                  ${isActive ? 'bg-cream-200' : ''}
                  ${!isActive && !isLocked ? 'hover:bg-cream-200' : ''}
                  ${isLocked ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}
                `}
              >
                {/* Active indicator */}
                {isActive && (
                  <motion.div
                    layoutId="activePhaseIndicator"
                    className="absolute left-0 top-0 bottom-0 w-[3px] bg-gold-400"
                    transition={springTransition}
                  />
                )}

                {/* Phase number */}
                <span
                  className={`font-display text-lg text-gold-400 flex-shrink-0 ${
                    isCollapsed ? 'text-base w-8 text-center' : 'w-9'
                  }`}
                >
                  {String(phase.id).padStart(2, '0')}
                </span>

                {/* Phase name */}
                {!isCollapsed && (
                  <span
                    className={`
                      flex-1 text-sm font-medium font-body truncate ml-0
                      ${isActive ? 'text-brown-800 font-semibold' : isLocked ? 'text-cream-300' : 'text-brown-700'}
                      ${phase.isComplete ? 'line-through text-brown-500' : ''}
                    `}
                  >
                    {phase.name}
                  </span>
                )}

                {/* Status */}
                <div className="flex items-center gap-1 flex-shrink-0 ml-auto">
                  {isLocked ? (
                    <Lock size={12} className="text-cream-300" />
                  ) : phase.isComplete ? (
                    <div className="w-2 h-2 rounded-full bg-success" />
                  ) : (
                    <div className="w-2 h-2 rounded-full bg-warning" />
                  )}
                </div>
              </Link>
            </motion.div>
          );
        })}
      </div>

      {/* Bottom Links */}
      <div className="px-5 py-4 border-t border-cream-200 space-y-2">
        <Link
          to="/report"
          onClick={onPhaseClick}
          className={`
            flex items-center gap-2 text-sm text-brown-600 hover:text-brown-800 transition-colors
            ${location.pathname === '/report' ? 'font-semibold text-brown-800' : ''}
          `}
        >
          <FileCheck size={16} className="flex-shrink-0" />
          {!isCollapsed && <span>Readiness Report</span>}
        </Link>
        <Link
          to="/settings"
          onClick={onPhaseClick}
          className={`
            flex items-center gap-2 text-sm text-brown-600 hover:text-brown-800 transition-colors
            ${location.pathname === '/settings' ? 'font-semibold text-brown-800' : ''}
          `}
        >
          <Settings size={16} className="flex-shrink-0" />
          {!isCollapsed && <span>Settings</span>}
        </Link>
      </div>
    </>
  );
}
