import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getDiagramData, useDiagramStore } from '../store/useDiagramStore';
import { api } from '../utils/api';
import { TopNav } from './layout/TopNav';
import { Sidebar } from './layout/Sidebar';
import { Canvas } from './canvas/Canvas';

export const ProjectEditor: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const presentationMode = useDiagramStore((state) => state.presentationMode);
  const setProjectDetails = useDiagramStore((state) => state.setProjectDetails);
  const loadProject = useDiagramStore((state) => state.loadProject);

  useEffect(() => {
    if (!id) return;
    let current = true;

    const fetchProject = async () => {
      try {
        setLoading(true);
        setError(null);

        const res = await api.get(`/projects/${id}`);
        if (!current) return;
        if (res.project) {
          loadProject(res.project.data);
          setProjectDetails(res.project.id, res.project.name);
        }
      } catch (err: any) {
        if (!current) return;
        console.error('Failed to load project:', err);
        setError(err.message || 'Failed to load project from server');
      } finally {
        if (current) setLoading(false);
      }
    };

    fetchProject();
    return () => { current = false; };
  }, [id, loadProject, setProjectDetails]);

  // Warn user before closing tab if there are unsaved changes (Chrome requires returnValue)
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!id) return;
      const state = useDiagramStore.getState();
      // If we have a saved snapshot, compare directly; otherwise fall back to default-node check
      if (state.lastSavedSnapshot) {
        const current = JSON.stringify(getDiagramData(state));
        if (current === state.lastSavedSnapshot) return;
      } else {
        const isDefaultSingleNode =
          state.nodes.length === 0 ||
          (state.nodes.length === 1 &&
            (state.nodes[0].data as { label?: string })?.label === 'Start Here' &&
            state.edges.length === 0);
        if (isDefaultSingleNode) return;
      }
      e.preventDefault();
      e.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center font-sans">
        <div className="w-10 h-10 border-3 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm font-semibold text-slate-300">Loading document...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center font-sans p-6">
        <div className="max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 text-center shadow-xl">
          <h2 className="text-lg font-bold text-rose-400 mb-2">Error Loading Document</h2>
          <p className="text-xs text-slate-400 mb-6">{error}</p>
          <button
            onClick={() => navigate('/dashboard')}
            className="bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs py-2 px-5 rounded-xl shadow-md transition-all"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-gray-50 dark:bg-slate-950 text-gray-900 dark:text-gray-100 overflow-hidden">
      <TopNav />
      <div className="flex-1 flex min-h-0 relative">
        {!presentationMode && <Sidebar />}
        <main className="flex-1 relative h-full">
          <Canvas />
        </main>
      </div>
    </div>
  );
};
