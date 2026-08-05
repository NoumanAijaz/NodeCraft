import { useEffect } from 'react';
import { X } from 'lucide-react';

interface ShortcutItem {
  key: string;
  description: string;
  shortcut: string;
}

interface Shortcut {
  category: string;
  items: ShortcutItem[];
}

interface ShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ShortcutsModal({ isOpen, onClose }: ShortcutsModalProps) {
  const isMac = typeof window !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
  const modKey = isMac ? '⌘' : 'Ctrl';

  const shortcuts: Shortcut[] = [
    {
      category: 'Node Operations',
      items: [
        { key: 'quick-sticky', description: 'Spawn a sticky note at center', shortcut: 'N' },
        { key: 'edit', description: 'Edit node text', shortcut: 'Double-click node' },
        { key: 'delete', description: 'Remove selected node', shortcut: 'Delete / Backspace' },
        { key: 'select-all', description: 'Select all nodes', shortcut: `${modKey} + A` },
        { key: 'copy', description: 'Copy selected node(s)', shortcut: `${modKey} + C` },
        { key: 'paste', description: 'Paste copied selection or clipboard image', shortcut: `${modKey} + V` },
        { key: 'duplicate', description: 'Duplicate selection', shortcut: `${modKey} + D` },
        { key: 'deselect-all', description: 'Deselect all', shortcut: 'Esc' },
      ],
    },
    {
      category: 'Mind Mapping',
      items: [
        { key: 'child', description: 'Add child to selected node', shortcut: 'Tab' },
        { key: 'sibling', description: 'Add sibling to selected node', shortcut: 'Enter' },
      ],
    },
    {
      category: 'Undo / Redo',
      items: [
        { key: 'undo', description: 'Undo last action', shortcut: `${modKey} + Z` },
        { key: 'redo', description: 'Redo last action', shortcut: isMac ? `⇧ + ⌘ + Z` : `Ctrl + Y` },
      ],
    },
    {
      category: 'Canvas',
      items: [
        { key: 'lasso', description: 'Lasso select multiple items', shortcut: 'Shift + Drag' },
        { key: 'pan', description: 'Pan canvas (when in Select mode)', shortcut: 'Space + Drag' },
        { key: 'present', description: 'Toggle presentation mode', shortcut: 'P' },
        { key: 'fit-view', description: 'Fit all nodes in view', shortcut: 'F' },
        { key: 'toggle-grid', description: 'Toggle snap to grid', shortcut: 'G' },
        { key: 'help', description: 'Open this shortcuts menu', shortcut: '?' },
      ],
    },
  ];

  // Self-contained Escape handler so the modal closes even if Canvas is unmounted.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, true); // capture so we beat Canvas's listener
    return () => window.removeEventListener('keydown', onKey, true);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div 
        className="bg-white dark:bg-gray-800 rounded-lucid-lg shadow-lucid-xl w-full max-w-2xl max-h-[80vh] overflow-hidden animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Keyboard Shortcuts</h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(80vh-80px)] p-5">
          {shortcuts.map((section) => (
            <div key={section.category} className="mb-6 last:mb-0">
              <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
                {section.category}
              </h3>
              <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lucid divide-y divide-gray-100 dark:divide-gray-700/50">
                {section.items.map((item) => (
                  <div 
                    key={item.key} 
                    className="flex items-center justify-between px-4 py-3"
                  >
                    <span className="text-sm text-gray-700 dark:text-gray-300">{item.description}</span>
                    <kbd className="px-2.5 py-0.5 text-xs font-mono bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded shadow-sm text-gray-600 dark:text-gray-400">
                      {item.shortcut}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 dark:border-gray-700 p-4 text-center">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Press <kbd className="px-1.5 py-0.5 text-xs font-mono bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded">Esc</kbd> to close
          </p>
        </div>
      </div>
    </div>
  );
}