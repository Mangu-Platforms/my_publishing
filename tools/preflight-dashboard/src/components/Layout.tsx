import type { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useViewport } from '@/hooks/useViewport';
import BookInfoPanel from './BookInfoPanel';
import Sidebar from './Sidebar';

interface LayoutProps {
  children: ReactNode;
}

const pageTransition = {
  initial: { opacity: 0, x: 20 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -20 },
};

export default function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const { isMobile, isTablet } = useViewport();

  const sidebarWidth = isMobile ? 0 : isTablet ? 64 : 280;
  const topBarHeight = 72;

  return (
    <div className="min-h-[100dvh] bg-cream-50">
      <BookInfoPanel />
      <Sidebar />

      {/* Main content area */}
      <main
        className="min-h-[100dvh] transition-all duration-300 ease-out"
        style={{
          paddingTop: topBarHeight,
          marginLeft: sidebarWidth,
        }}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            variants={pageTransition}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{
              duration: 0.3,
              delay: 0.1,
              ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number],
            }}
            className="p-6 lg:p-8"
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
