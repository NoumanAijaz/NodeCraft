import { useState, useEffect, useMemo, useRef } from 'react';
import { X, GitBranch, AlertTriangle, FileCode2 } from 'lucide-react';
import { parseMermaid, MERMAID_EXAMPLE } from '../../utils/mermaid';

interface MermaidImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (mermaidText: string) => void;
}

export function MermaidImportModal({ isOpen, onClose, onImport }: MermaidImportModalProps) {
  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const result = useMemo(() => {
    if (!text.trim()) return null;
    return parseMermaid(text);
  }, [text]);

  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => textareaRef.current?.focus());
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const nodeCount = result?.nodes.length ?? 0;
  const edgeCount = result?.edges.length ?? 0;
  const canImport = nodeCount > 0;

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in p-4"
      onMouseDown={onClose}
    >
      <div
        className="w-full max-w-2xl bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden animate-scale-in flex flex-col max-h-[85vh]"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700 shrink-0">
          <h2 className="flex items-center gap-2 text-sm font-bold text-gray-900 dark:text-white">
            <GitBranch size={16} className="text-violet-500" />
            Import from Mermaid
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-md transition-colors"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3 min-h-0">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Paste a Mermaid flowchart definition. Supports <code className="font-mono bg-gray-100 dark:bg-slate-700 px-1 rounded">graph TD/LR</code>,
            shapes <code className="font-mono bg-gray-100 dark:bg-slate-700 px-1 rounded">[] {"()"} {"{}"} (( )) [( )]</code>,
            arrows <code className="font-mono bg-gray-100 dark:bg-slate-700 px-1 rounded">--&gt; --- -.-&gt; ==&gt;</code>, labels via{' '}
            <code className="font-mono bg-gray-100 dark:bg-slate-700 px-1 rounded">|text|</code> or{' '}
            <code className="font-mono bg-gray-100 dark:bg-slate-700 px-1 rounded">-- text --&gt;</code>, and chains.
          </p>

          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={MERMAID_EXAMPLE}
            rows={10}
            spellCheck={false}
            className="w-full font-mono text-xs bg-gray-950 text-emerald-300 border border-gray-200 dark:border-gray-700 rounded-xl p-3 outline-none focus:ring-2 focus:ring-violet-500/40 resize-y leading-relaxed"
          />

          <div className="flex items-center justify-between gap-2">
            <button
              onClick={() => setText(MERMAID_EXAMPLE)}
              className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-violet-500 hover:text-violet-400 transition-colors"
            >
              <FileCode2 size={13} />
              Insert example
            </button>
            <div className="flex items-center gap-3 text-[11px]">
              {result && (
                <>
                  <span className={canImport ? 'text-emerald-500 font-semibold' : 'text-gray-400'}>
                    {nodeCount} node{nodeCount !== 1 ? 's' : ''} · {edgeCount} edge{edgeCount !== 1 ? 's' : ''}
                  </span>
                  {result.errors.length > 0 && (
                    <span className="inline-flex items-center gap-1 text-amber-500" title={result.errors.slice(0, 5).join('\n')}>
                      <AlertTriangle size={12} />
                      {result.errors.length} line{result.errors.length !== 1 ? 's' : ''} skipped
                    </span>
                  )}
                </>
              )}
            </div>
          </div>

          {result && result.errors.length > 0 && (
            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 rounded-lg p-2.5 max-h-24 overflow-y-auto">
              {result.errors.slice(0, 6).map((err, i) => (
                <p key={i} className="text-[10px] text-amber-700 dark:text-amber-400 font-mono">{err}</p>
              ))}
              {result.errors.length > 6 && (
                <p className="text-[10px] text-amber-600 dark:text-amber-500 mt-1">+{result.errors.length - 6} more…</p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-gray-200 dark:border-gray-700 shrink-0">
          <button
            onClick={onClose}
            className="px-3.5 py-2 text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => canImport && onImport(text)}
            disabled={!canImport}
            className="px-4 py-2 text-xs font-semibold bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg shadow-sm transition-all active:scale-[0.98]"
          >
            Import to canvas
          </button>
        </div>
      </div>
    </div>
  );
}
