import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Lock, ArrowRight, Check } from 'lucide-react';
import type { Phase } from '@/data/phases';
import * as Icons from 'lucide-react';

interface PhaseCardProps {
  phase: Phase;
  index: number;
  onLockedClick: () => void;
}

// Map kebab-case icon names to PascalCase for lucide-react
type IconMap = Record<string, React.ComponentType<{ size?: number; className?: string }>>;

function getIconComponent(iconName: string): React.ComponentType<{ size?: number; className?: string }> {
  const icons = Icons as unknown as IconMap;
  // Convert kebab-case to PascalCase (e.g., "file-text" -> "FileText")
  const pascalName = iconName
    .split('-')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
  return icons[pascalName] || Icons.FileText;
}

export default function PhaseCard({ phase, index, onLockedClick }: PhaseCardProps) {
  const completedCount = phase.checklists.filter(c => c.isComplete).length;
  const totalCount = phase.checklists.length;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const IconComponent = getIconComponent(phase.icon);

  const cardContent = (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        delay: 0.1 + index * 0.06,
        duration: 0.4,
        ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number],
      }}
      whileHover={phase.isLocked ? {} : { y: -3, boxShadow: 'rgba(31, 24, 13, 0.10) 0px 4px 12px' }}
      className={`
        bg-cream-100 border border-cream-200 rounded-xl p-6 relative transition-colors duration-250
        ${phase.isLocked ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer hover:border-cream-300'}
      `}
      onClick={phase.isLocked ? onLockedClick : undefined}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="w-10 h-10 bg-cream-200 rounded-[10px] flex items-center justify-center">
          <IconComponent size={24} className="text-brown-600" />
          {phase.isLocked && (
            <div className="absolute bottom-0 right-0 bg-cream-100 rounded-full p-0.5">
              <Lock size={10} className="text-cream-400" />
            </div>
          )}
        </div>
        <span className="font-display text-lg text-gold-400">
          {String(phase.id).padStart(2, '0')}
        </span>
      </div>

      {/* Phase name */}
      <h3 className={`font-display text-xl font-semibold text-brown-800 mt-3 ${phase.isComplete ? 'line-through text-brown-500' : ''}`}>
        {phase.name}
      </h3>

      {/* Description */}
      <p className="text-sm text-brown-600 mt-1 line-clamp-2 leading-relaxed">
        {phase.description}
      </p>

      {/* Progress bar */}
      <div className="mt-4">
        <div className="w-full h-1 bg-cream-200 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gold-400 rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${progressPercent}%` }}
            transition={{ duration: 0.5, ease: 'easeOut', delay: 0.3 + index * 0.06 }}
          />
        </div>
        <p className="text-xs text-brown-500 mt-1.5">
          {completedCount} of {totalCount} tasks
        </p>
      </div>

      {/* Status */}
      <div className="flex items-center justify-between mt-3">
        <span className={`
          inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium
          ${phase.isLocked ? 'bg-cream-200 text-cream-400' : phase.isComplete ? 'bg-success-light text-success' : 'bg-warning-light text-warning'}
        `}>
          {phase.isLocked ? (
            <>
              <Lock size={12} /> Locked
            </>
          ) : phase.isComplete ? (
            <>
              <Check size={12} /> Complete
            </>
          ) : (
            <>
              <div className="w-1.5 h-1.5 rounded-full bg-warning" /> In Progress
            </>
          )}
        </span>

        {!phase.isLocked && (
          <motion.div
            whileHover={{ x: 4 }}
            transition={{ duration: 0.2 }}
          >
            <ArrowRight size={16} className="text-brown-400" />
          </motion.div>
        )}
      </div>
    </motion.div>
  );

  if (phase.isLocked) {
    return cardContent;
  }

  return (
    <Link to={`/phase/${phase.id}`} className="block no-underline">
      {cardContent}
    </Link>
  );
}
