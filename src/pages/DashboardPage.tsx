import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api, type ProjectMeta } from '../utils/api';
import {
  LayoutGrid,
  Plus,
  Search,
  LogOut,
  FolderKanban,
  Trash2,
  Edit2,
  ExternalLink,
  Sparkles,
  GitBranch,
  Network,
  Database,
  Clock,
  Check,
  X,
  FileText
} from 'lucide-react';

export const DashboardPage: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [projects, setProjects] = useState<ProjectMeta[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState<string>('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [creating, setCreating] = useState<boolean>(false);

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      setLoading(true);
      const data = await api.get('/projects');
      setProjects(data.projects || []);
    } catch (err) {
      console.error('Failed to fetch projects:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProject = async (template?: string) => {
    try {
      setCreating(true);
      const templateName = template ? `${template.charAt(0).toUpperCase() + template.slice(1)} Diagram` : 'Untitled Diagram';
      const res = await api.post('/projects', {
        name: templateName,
        template,
      });

      if (res.project && res.project.id) {
        navigate(`/project/${res.project.id}`);
      }
    } catch (err) {
      console.error('Failed to create project:', err);
    } finally {
      setCreating(false);
    }
  };

  const handleStartRename = (e: React.MouseEvent, proj: ProjectMeta) => {
    e.stopPropagation();
    setEditingId(proj.id);
    setEditingName(proj.name);
  };

  const handleSaveRename = async (e: React.FormEvent | React.MouseEvent, id: string) => {
    e.stopPropagation();
    e.preventDefault();
    if (!editingName.trim()) return;

    try {
      await api.put(`/projects/${id}/rename`, { name: editingName.trim() });
      setProjects((prev) =>
        prev.map((p) => (p.id === id ? { ...p, name: editingName.trim() } : p))
      );
      setEditingId(null);
    } catch (err) {
      console.error('Failed to rename project:', err);
    }
  };

  const handleDeleteProject = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      await api.delete(`/projects/${id}`);
      setProjects((prev) => prev.filter((p) => p.id !== id));
      setDeleteConfirmId(null);
    } catch (err) {
      console.error('Failed to delete project:', err);
    }
  };

  const filteredProjects = projects.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-blue-500 selection:text-white">
      {/* Top Navigation Bar */}
      <header className="h-16 border-b border-slate-800 bg-slate-900/80 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-md shadow-blue-500/20">
            <LayoutGrid className="w-6 h-6 text-white" />
          </div>
          <div>
            <span className="font-bold text-lg text-white tracking-tight">NodeCraft</span>
            <span className="ml-2 text-[10px] font-semibold uppercase tracking-wider text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/20">
              Cloud Workspace
            </span>
          </div>
        </div>

        {/* Search Bar */}
        <div className="w-72 relative hidden md:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
          <input
            type="text"
            placeholder="Search documents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-950/60 border border-slate-800 rounded-xl pl-9 pr-4 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-all"
          />
        </div>

        {/* User Profile & Actions */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-slate-800/60 border border-slate-700/60 rounded-xl px-3 py-1.5">
            <div className="w-6 h-6 rounded-full bg-indigo-600 flex items-center justify-center font-bold text-xs text-white uppercase">
              {user?.username?.[0] || 'U'}
            </div>
            <span className="text-xs font-semibold text-slate-200">{user?.username}</span>
          </div>

          <button
            onClick={logout}
            className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition-colors"
            title="Sign Out"
          >
            <LogOut size={18} />
          </button>
        </div>
      </header>

      {/* Main Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 md:p-8 space-y-8">
        {/* Create / Templates Section */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <Sparkles size={16} className="text-blue-400" />
              <span>Create New Document</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Blank Canvas Card */}
            <button
              onClick={() => handleCreateProject()}
              disabled={creating}
              className="h-36 bg-gradient-to-br from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 rounded-2xl p-5 text-left flex flex-col justify-between shadow-lg shadow-blue-600/20 group transition-all transform hover:-translate-y-0.5 active:scale-[0.98] border border-blue-400/20 relative overflow-hidden"
            >
              <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-md flex items-center justify-center text-white group-hover:scale-110 transition-transform">
                <Plus size={24} />
              </div>
              <div>
                <h3 className="font-bold text-white text-base">Blank Diagram</h3>
                <p className="text-xs text-blue-100/80">Start with a clean canvas</p>
              </div>
            </button>

            {/* Mind Map Template */}
            <button
              onClick={() => handleCreateProject('mindmap')}
              disabled={creating}
              className="h-36 bg-slate-900/80 hover:bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-5 text-left flex flex-col justify-between group transition-all transform hover:-translate-y-0.5 active:scale-[0.98]"
            >
              <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 group-hover:scale-110 transition-transform">
                <GitBranch size={20} />
              </div>
              <div>
                <h3 className="font-semibold text-slate-200 text-sm">Mind Map</h3>
                <p className="text-xs text-slate-400">Brainstorm ideas & concepts</p>
              </div>
            </button>

            {/* Flowchart Template */}
            <button
              onClick={() => handleCreateProject('flowchart')}
              disabled={creating}
              className="h-36 bg-slate-900/80 hover:bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-5 text-left flex flex-col justify-between group transition-all transform hover:-translate-y-0.5 active:scale-[0.98]"
            >
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 group-hover:scale-110 transition-transform">
                <Network size={20} />
              </div>
              <div>
                <h3 className="font-semibold text-slate-200 text-sm">Flowchart</h3>
                <p className="text-xs text-slate-400">Process & decision mapping</p>
              </div>
            </button>

            {/* Database Schema Template */}
            <button
              onClick={() => handleCreateProject('database')}
              disabled={creating}
              className="h-36 bg-slate-900/80 hover:bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-5 text-left flex flex-col justify-between group transition-all transform hover:-translate-y-0.5 active:scale-[0.98]"
            >
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 group-hover:scale-110 transition-transform">
                <Database size={20} />
              </div>
              <div>
                <h3 className="font-semibold text-slate-200 text-sm">Database Schema</h3>
                <p className="text-xs text-slate-400">ER diagrams & tables</p>
              </div>
            </button>
          </div>
        </section>

        {/* Projects / Files Section */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <FolderKanban size={16} className="text-indigo-400" />
              <span>My Documents</span>
              <span className="text-xs font-normal text-slate-500">({filteredProjects.length})</span>
            </h2>
          </div>

          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center text-slate-500">
              <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-3" />
              <p className="text-xs">Loading your documents...</p>
            </div>
          ) : filteredProjects.length === 0 ? (
            <div className="py-16 bg-slate-900/40 border border-dashed border-slate-800 rounded-2xl flex flex-col items-center justify-center text-center p-6">
              <div className="w-12 h-12 rounded-2xl bg-slate-800/80 flex items-center justify-center text-slate-500 mb-3">
                <FileText size={24} />
              </div>
              <h3 className="font-bold text-slate-300 text-sm">No documents found</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mb-4">
                {searchQuery ? 'No documents match your search query.' : 'Create your first diagram using the options above.'}
              </p>
              {!searchQuery && (
                <button
                  onClick={() => handleCreateProject()}
                  className="bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs py-2 px-4 rounded-xl shadow-md transition-all flex items-center gap-2"
                >
                  <Plus size={14} />
                  <span>Create Document</span>
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {filteredProjects.map((proj) => (
                <div
                  key={proj.id}
                  onClick={() => navigate(`/project/${proj.id}`)}
                  className="bg-slate-900/80 hover:bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-4 flex flex-col justify-between group transition-all transform hover:-translate-y-1 hover:shadow-xl cursor-pointer relative"
                >
                  {/* Document Card Header / Thumbnail Mock */}
                  <div className="h-28 bg-slate-950/60 rounded-xl border border-slate-800/80 p-3 mb-3 relative overflow-hidden flex items-center justify-center group-hover:border-blue-500/30 transition-colors">
                    <LayoutGrid className="w-10 h-10 text-slate-700 group-hover:text-blue-500/60 transition-colors" />

                    {/* Open badge */}
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-blue-600 text-white p-1 rounded-lg shadow-md">
                      <ExternalLink size={12} />
                    </div>
                  </div>

                  {/* Document Info */}
                  <div>
                    {editingId === proj.id ? (
                      <div className="flex items-center gap-1 mb-1" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="text"
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleSaveRename(e, proj.id)}
                          className="bg-slate-950 border border-blue-500 text-xs text-white rounded px-2 py-1 w-full focus:outline-none"
                          autoFocus
                        />
                        <button
                          onClick={(e) => handleSaveRename(e, proj.id)}
                          className="p-1 text-emerald-400 hover:bg-emerald-500/10 rounded"
                        >
                          <Check size={14} />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingId(null);
                          }}
                          className="p-1 text-slate-400 hover:bg-slate-700 rounded"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between group/title mb-1">
                        <h3 className="font-bold text-slate-200 text-sm truncate pr-2 group-hover/title:text-blue-400 transition-colors">
                          {proj.name}
                        </h3>

                        {/* Inline Actions */}
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => handleStartRename(e, proj)}
                            className="p-1 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors"
                            title="Rename"
                          >
                            <Edit2 size={12} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteConfirmId(proj.id);
                            }}
                            className="p-1 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                            title="Delete"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-medium">
                      <Clock size={12} />
                      <span>Updated {formatDate(proj.updated_at)}</span>
                    </div>
                  </div>

                  {/* Delete Confirmation Modal Overlay for Card */}
                  {deleteConfirmId === proj.id && (
                    <div
                      className="absolute inset-0 bg-slate-950/95 backdrop-blur-sm rounded-2xl p-4 flex flex-col justify-center items-center text-center z-20 animate-fade-in"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Trash2 className="w-8 h-8 text-rose-500 mb-2" />
                      <p className="text-xs font-bold text-slate-200">Delete document?</p>
                      <p className="text-[10px] text-slate-400 mb-3">This action cannot be undone.</p>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => handleDeleteProject(e, proj.id)}
                          className="bg-rose-600 hover:bg-rose-500 text-white font-semibold text-[11px] py-1 px-3 rounded-lg shadow-sm"
                        >
                          Delete
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteConfirmId(null);
                          }}
                          className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-[11px] py-1 px-3 rounded-lg"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
};
