import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Info, ChevronDown } from 'lucide-react';
import { tooltipGlossary } from '@/data/phases';

interface ChecklistItemProps {
  text: string;
  isComplete: boolean;
  guidance: string;
  tooltipTerm: string | null;
  onToggle: () => void;
}

export default function ChecklistItem({
  text,
  isComplete,
  guidance,
  tooltipTerm,
  onToggle,
}: ChecklistItemProps) {
  const [expanded, setExpanded] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);

  const tooltipText = tooltipTerm ? tooltipGlossary[tooltipTerm] : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`
        bg-cream-50 border border-cream-200 rounded-[10px] transition-colors duration-150
        ${isComplete ? 'opacity-90' : ''}
      `}
    >
      <div
        className={`
          flex items-center gap-3 px-4 py-3.5 cursor-pointer select-none
          ${!isComplete ? 'hover:bg-cream-100' : ''}
        `}
      >
        {/* Custom Checkbox */}
        <motion.button
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
          whileTap={{ scale: 0.8 }}
          animate={isComplete ? { scale: [0.8, 1.1, 1] } : { scale: 1 }}
          transition={{ type: 'spring', stiffness: 500, damping: 15 }}
          className={`
            w-5 h-5 rounded flex-shrink-0 flex items-center justify-center border-2 transition-colors duration-200
            ${isComplete
              ? 'bg-success border-success'
              : 'border-cream-300 hover:border-brown-400 bg-transparent'
            }
          `}
        >
          <AnimatePresence>
            {isComplete && (
              <motion.svg
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                exit={{ pathLength: 0 }}
                width="12"
                height="12"
                viewBox="0 0 12 12"
                fill="none"
                className="text-white"
              >
                <motion.path
                  d="M2 6L5 9L10 3"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 0.2 }}
                />
              </motion.svg>
            )}
          </AnimatePresence>
        </motion.button>

        {/* Item text */}
        <span
          onClick={() => setExpanded(!expanded)}
          className={`
            flex-1 font-body transition-all duration-300 select-none
            ${isComplete ? 'text-sm text-brown-500 line-through' : 'text-base text-brown-800'}
          `}
        >
          {text}
        </span>

        {/* Tooltip icon */}
        {tooltipTerm && tooltipText && (
          <div
            className="relative flex-shrink-0"
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
          >
            <Info size={16} className="text-brown-400 cursor-help" />
            <AnimatePresence>
              {showTooltip && (
                <motion.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1.5 bg-brown-800 text-cream-50 text-xs font-body rounded-md z-50 max-w-[240px]"
                >
                  <span className="font-semibold">{tooltipTerm}:</span> {tooltipText}
                  <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px border-4 border-transparent border-t-brown-800" />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Expand chevron */}
        {guidance && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(!expanded);
            }}
            className="flex-shrink-0 p-0.5"
          >
            <motion.div
              animate={{ rotate: expanded ? 180 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <ChevronDown size={16} className="text-brown-400" />
            </motion.div>
          </button>
        )}
      </div>

      {/* Expanded guidance */}
      <AnimatePresence>
        {expanded && guidance && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="overflow-hidden"
          >
            <div className="mx-4 mb-3 px-4 py-3 bg-cream-100 border-l-[3px] border-gold-400 rounded-r-lg">
              <p className="text-sm text-brown-600 font-body leading-relaxed">{guidance}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
