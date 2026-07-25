import { motion } from 'framer-motion';

interface ProgressRingProps {
  size?: number;
  strokeWidth?: number;
  progress: number;
}

export default function ProgressRing({ size = 56, strokeWidth = 4, progress }: ProgressRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#EDE7DA"
          strokeWidth={strokeWidth}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#D4A853"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset }}
          transition={{ duration: 0.8, ease: 'easeOut', delay: 0.5 }}
        />
      </svg>
      <span
        className="absolute font-display text-brown-800 font-semibold"
        style={{ fontSize: size < 48 ? '0.75rem' : '1.125rem' }}
      >
        {Math.round(progress)}%
      </span>
    </div>
  );
}
