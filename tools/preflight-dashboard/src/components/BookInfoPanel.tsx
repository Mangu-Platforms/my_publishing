import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAppContext } from '@/hooks/useAppState';
import type { BookInfo } from '@/hooks/useAppState';

type BookField = keyof BookInfo;

const fieldLabels: Record<BookField, string> = {
  title: 'Title',
  author: 'Author',
  isbn: 'ISBN',
  publisher: 'Publisher',
  trimSize: 'Trim Size',
  pageCount: 'Page Count',
};

const fieldPlaceholders: Record<BookField, string> = {
  title: 'Add Book Title',
  author: 'Add Author Name',
  isbn: 'Add ISBN',
  publisher: 'Add Publisher',
  trimSize: 'Add Trim Size',
  pageCount: 'Add Pages',
};

export default function BookInfoPanel() {
  const { bookInfo, setBookInfo, overallProgress } = useAppContext();
  const [editingField, setEditingField] = useState<BookField | null>(null);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingField && inputRef.current) {
      inputRef.current.focus();
    }
  }, [editingField]);

  const startEdit = (field: BookField) => {
    setEditingField(field);
    setEditValue(bookInfo[field]);
  };

  const saveEdit = () => {
    if (editingField) {
      setBookInfo(editingField, editValue);
      setEditingField(null);
    }
  };

  const cancelEdit = () => {
    setEditingField(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') saveEdit();
    if (e.key === 'Escape') cancelEdit();
  };

  const fields: BookField[] = ['title', 'author', 'isbn', 'publisher', 'trimSize', 'pageCount'];

  return (
    <motion.header
      initial={{ y: -72, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.4, delay: 0.1, ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number] }}
      className="fixed top-0 left-0 right-0 h-[72px] bg-cream-50 z-50 flex items-center px-4 lg:px-8 gap-4"
      style={{ boxShadow: 'rgba(31, 24, 13, 0.06) 0px 1px 4px' }}
    >
      {/* Book info fields */}
      <div className="flex-1 flex items-center gap-2 overflow-x-auto scrollbar-hide">
        {fields.map((field, index) => (
          <motion.div
            key={field}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 + index * 0.06, duration: 0.3 }}
          >
            {editingField === field ? (
              <div className="flex items-center gap-1 bg-cream-100 border border-cream-300 rounded-lg px-2 py-1 min-w-[140px]">
                <span className="text-xs text-brown-500 uppercase tracking-wide flex-shrink-0">
                  {fieldLabels[field]}
                </span>
                <input
                  ref={inputRef}
                  type="text"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onBlur={saveEdit}
                  onKeyDown={handleKeyDown}
                  className="bg-transparent text-sm text-brown-800 outline-none w-full font-medium"
                />
              </div>
            ) : (
              <button
                onClick={() => startEdit(field)}
                className={`
                  flex items-center gap-1 px-2.5 py-1.5 rounded-lg border transition-colors duration-150 min-h-[32px]
                  ${bookInfo[field]
                    ? 'bg-cream-100 border-cream-200 hover:border-cream-300'
                    : 'bg-transparent border-dashed border-brown-500 hover:bg-cream-100'
                  }
                `}
              >
                <span className="text-xs text-brown-500 uppercase tracking-wide flex-shrink-0">
                  {fieldLabels[field]}
                </span>
                <span className="text-sm text-brown-800 font-medium truncate max-w-[100px] lg:max-w-[160px]">
                  {bookInfo[field] || `+ ${fieldPlaceholders[field]}`}
                </span>
              </button>
            )}
          </motion.div>
        ))}
      </div>

      {/* Progress */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="hidden sm:flex items-center gap-3 flex-shrink-0"
      >
        <div className="text-right">
          <p className="text-xs text-brown-500">Overall Progress</p>
          <div className="flex items-center gap-2">
            <span className="text-sm text-brown-700 font-semibold">{overallProgress}%</span>
            <div className="w-[180px] h-2 bg-cream-200 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gold-400 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${overallProgress}%` }}
                transition={{ duration: 0.8, ease: 'easeOut', delay: 0.6 }}
              />
            </div>
          </div>
        </div>
      </motion.div>
    </motion.header>
  );
}
