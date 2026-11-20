import { useState, useEffect, useCallback } from 'react';
import { X, History, RotateCcw, Trash2, Camera, Loader2 } from 'lucide-react';
import { api } from '../../utils/api';

interface VersionEntry {
  seq: number;
  createdAt: string;
  label: string;
  name: string;
  size: number;
}

interface VersionHistoryModalProps {
  isOpen: boolean;
  projectId: string | null;
  onClose: () => void;
  onRestored: (data: any, name: string, revision: string) => void;
  getRevision: () => string | null;
  showToast: (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
}

function formatWhen(iso: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function VersionHistoryModal({ isOpen, projectId, onClose, onRestored, getRevision, showToast }: VersionHistoryModalProps) {
  const [versions, setVersions] = useState<VersionEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [busySeq, setBusySeq] = useState<number | null>(null);
  const [snapshotLabel, setSnapshotLabel] = useState('');
  const [snapshotting, setSnapshotting] = useState(false);

  const refresh = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const res = await api.get<{ versions: VersionEntry[] }>(`/projects/${projectId}/versions`);
      setVersions(res.versions || []);
    } catch (err: any) {
      showToast(err?.message || 'Failed to load versions', 'error');
    } finally {
      setLoading(false);
    }
  }, [projectId, showToast]);

  useEffect(() => {
    if (isOpen && projectId) void refresh();
    if (!isOpen) {
      setVersions([]);
      setSnapshotLabel('');
    }
  }, [isOpen, projectId, refresh]);

  const handleSnapshot = async () => {
    if (!projectId) return;
    setSnapshotting(true);
    try {
      await api.post(`/projects/${projectId}/versions`, { label: snapshotLabel.trim() });
      setSnapshotLabel('');
      showToast('Version snapshot saved', 'success');
      await refresh();
    } catch (err: any) {
      showToast(err?.message || 'Failed to save version', 'error');
    } finally {
      setSnapshotting(false);
    }
  };

  const handleRestore = async (v: VersionEntry) => {
    const revision = getRevision();
    if (!projectId || !revision) return;
    if (!window.confirm(`Restore version #${v.seq} from ${formatWhen(v.createdAt)}? Current canvas will be replaced.`)) return;
    setBusySeq(v.seq);
    try {
      const res = await api.post<{ name: string; data: any; revision: string }>(
        `/projects/${projectId}/versions/${v.seq}/restore`,
        { revision }
      );
      onRestored(res.data, res.name, res.revision);
      showToast(`Restored version #${v.seq}`, 'success');
      onClose();
    } catch (err: any) {
      showToast(err?.message || 'Restore failed', 'error');
    } finally {
      setBusySeq(null);
    }
  };

  const handleDelete = async (v: VersionEntry) => {
    if (!projectId) return;
    if (!window.confirm(`Permanently delete version #${v.seq}?`)) return;
    setBusySeq(v.seq);
    try {
      await api.delete(`/projects/${projectId}/versions/${v.seq}`);
      setVersions(prev => prev.filter(x => x.seq !== v.seq));
      showToast('Version deleted', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Delete failed', 'error');
    } finally {
      setBusySeq(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in p-4"
      onMouseDown={onClose}
    >
      <div
        className="w-full max-w-lg bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden animate-scale-in flex flex-col max-h-[80vh]"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700 shrink-0">
          <h2 className="flex items-center gap-2 text-sm font-bold text-gray-900 dark:text-white">
            <History size={16} className="text-blue-500" />
            Version History
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-md transition-colors"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Create snapshot */}
        <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-700/50 flex items-center gap-2 shrink-0">
          <input
            value={snapshotLabel}
            onChange={(e) => setSnapshotLabel(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSnapshot()}
            placeholder="Optional label (e.g. 'before restructure')"
            maxLength={100}
            className="flex-1 text-xs bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 text-gray-800 dark:text-gray-100"
          />
          <button
            onClick={handleSnapshot}
            disabled={snapshotting}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg shadow-sm transition-all active:scale-[0.98]"
          >
            {snapshotting ? <Loader2 size={13} className="animate-spin" /> : <Camera size={13} />}
            Snapshot now
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {loading ? (
            <div className="py-10 flex justify-center">
              <Loader2 size={20} className="animate-spin text-blue-500" />
            </div>
          ) : versions.length === 0 ? (
            <div className="py-10 text-center text-xs text-gray-400 px-6">
              No versions yet. Click "Snapshot now" to save the current server state — auto-save keeps working on top.
              <br />
              <span className="text-[10px]">Up to 20 snapshots are kept per document.</span>
            </div>
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-gray-700/50">
              {versions.map((v) => (
                <li key={v.seq} className="px-5 py-3 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-slate-700/30 transition-colors">
                  <span className="w-9 h-9 rounded-lg bg-gray-100 dark:bg-slate-700 flex items-center justify-center text-[11px] font-bold text-gray-500 dark:text-gray-300 shrink-0">
                    #{v.seq}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-gray-800 dark:text-gray-100 truncate">
                      {v.label || v.name || 'Untitled'}
                    </p>
                    <p className="text-[10px] text-gray-400">
                      {formatWhen(v.createdAt)} · {formatSize(v.size)}
                    </p>
                  </div>
                  <button
                    onClick={() => handleRestore(v)}
                    disabled={busySeq !== null}
                    title="Restore this version"
                    className="p-2 rounded-lg text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 disabled:opacity-40 transition-colors"
                  >
                    {busySeq === v.seq ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}
                  </button>
                  <button
                    onClick={() => handleDelete(v)}
                    disabled={busySeq !== null}
                    title="Delete this version"
                    className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-40 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
