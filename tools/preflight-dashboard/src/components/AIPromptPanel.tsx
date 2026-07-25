import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, ChevronDown, CheckCircle, AlertTriangle, Loader2, Copy, Bot } from 'lucide-react';

interface AIPromptPanelProps {
  prompt: string;
  phaseComplete: boolean;
}

export default function AIPromptPanel({ prompt, phaseComplete }: AIPromptPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<'success' | 'warning' | null>(null);
  const [copied, setCopied] = useState(false);

  const handleRunCheck = () => {
    setChecking(true);
    setResult(null);
    setTimeout(() => {
      setChecking(false);
      setResult(phaseComplete ? 'success' : 'warning');
    }, 2500);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Fallback for browsers without clipboard API
      const textarea = document.createElement('textarea');
      textarea.value = prompt;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  return (
    <div className="mt-8">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles size={14} className="text-gold-400" />
        <span className="text-xs text-brown-500 uppercase tracking-[0.1em] font-medium">
          AI Verification
        </span>
      </div>

      <div className="bg-cream-50 border border-cream-200 rounded-xl overflow-hidden">
        {/* Header */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-between px-4 py-3.5 bg-cream-100 hover:bg-cream-200 transition-colors duration-150 border-b border-cream-200"
        >
          <div className="flex items-center gap-2">
            <Bot size={20} className="text-brown-600" />
            <span className="text-sm font-semibold text-brown-700">AI Verification Prompt</span>
          </div>

          <div className="flex items-center gap-2">
            {result && (
              <span className={`text-xs px-2 py-0.5 rounded-full ${result === 'success' ? 'bg-success-light text-success' : 'bg-warning-light text-warning'}`}>
                {result === 'success' ? 'Verified' : 'Issues Found'}
              </span>
            )}
            <motion.div
              animate={{ rotate: expanded ? 180 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <ChevronDown size={16} className="text-brown-400" />
            </motion.div>
          </div>
        </button>

        {/* Expanded content */}
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: 'auto' }}
              exit={{ height: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="overflow-hidden"
            >
              <div className="p-4 space-y-4">
                {/* Prompt text */}
                <div className="bg-brown-900 rounded-lg p-4">
                  <pre className="font-mono text-sm text-cream-50 leading-relaxed whitespace-pre-wrap">
                    {prompt}
                  </pre>
                </div>

                {/* Action row */}
                <div className="flex items-center gap-3 pt-2 border-t border-cream-200">
                  <button
                    onClick={handleRunCheck}
                    disabled={checking}
                    className="flex items-center gap-2 px-5 py-2.5 bg-brown-600 text-cream-50 text-sm font-medium rounded-lg hover:bg-brown-700 transition-colors disabled:opacity-60"
                  >
                    {checking ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        Running...
                      </>
                    ) : (
                      <>
                        <Sparkles size={16} />
                        {result ? 'Re-run Check' : 'Run AI Check'}
                      </>
                    )}
                  </button>
                  <button
                    onClick={handleCopy}
                    className="flex items-center gap-2 px-4 py-2.5 text-brown-600 text-sm font-medium rounded-lg hover:bg-cream-100 transition-colors"
                  >
                    <Copy size={16} />
                    {copied ? 'Copied!' : 'Copy Prompt'}
                  </button>
                </div>

                {/* Result */}
                <AnimatePresence>
                  {result && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      transition={{ duration: 0.3, delay: 0.1 }}
                      className={`
                        p-4 rounded-lg border-l-[3px]
                        ${result === 'success'
                          ? 'bg-success-light border-success'
                          : 'bg-warning-light border-warning'
                        }
                      `}
                    >
                      <div className="flex items-start gap-3">
                        {result === 'success' ? (
                          <CheckCircle size={20} className="text-success flex-shrink-0 mt-0.5" />
                        ) : (
                          <AlertTriangle size={20} className="text-warning flex-shrink-0 mt-0.5" />
                        )}
                        <p className={`text-sm ${result === 'success' ? 'text-success' : 'text-warning'}`}>
                          {result === 'success'
                            ? 'All tasks verified. This phase is ready for completion.'
                            : 'Some tasks are still pending. Complete all checklist items before finishing this phase.'
                          }
                        </p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
