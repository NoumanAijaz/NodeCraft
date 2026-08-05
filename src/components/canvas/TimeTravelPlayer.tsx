import { useState, useEffect, useRef } from 'react';
import { Panel } from '@xyflow/react';
import { useDiagramStore } from '../../store/useDiagramStore';
import { Play, Pause, Rewind, FastForward } from 'lucide-react';
import { useStore } from 'zustand';

export function TimeTravelPlayer() {
  const temporal = useDiagramStore.temporal;
  // Subscribe to each slice separately so the default Object.is equality
  // check actually works (returning a new object {} from the selector would
  // re-render on every store change).
  const pastStates = useStore(temporal, (s) => s.pastStates);
  const futureStates = useStore(temporal, (s) => s.futureStates);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const playIntervalRef = useRef<number | null>(null);

  const totalStates = pastStates.length + futureStates.length;
  const currentIndex = pastStates.length;

  const clearPlayInterval = () => {
    if (playIntervalRef.current !== null) {
      clearInterval(playIntervalRef.current);
      playIntervalRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      clearPlayInterval();
    };
  }, []);

  // Stop playback automatically when we reach the end of history.
  useEffect(() => {
    if (isPlaying && futureStates.length === 0) {
      setIsPlaying(false);
      clearPlayInterval();
    }
  }, [isPlaying, futureStates.length]);

  const handleScrub = (e: React.ChangeEvent<HTMLInputElement>) => {
    const targetIndex = parseInt(e.target.value, 10);
    const delta = targetIndex - currentIndex;
    
    if (delta > 0) {
      for (let i = 0; i < delta; i++) {
        temporal.getState().redo();
      }
    } else if (delta < 0) {
      for (let i = 0; i < Math.abs(delta); i++) {
        temporal.getState().undo();
      }
    }
  };

  const togglePlay = () => {
    if (isPlaying) {
      setIsPlaying(false);
      clearPlayInterval();
    } else {
      // If we're at the end (no future states), jump back to start before playing.
      if (futureStates.length === 0 && pastStates.length > 0) {
        const toUndo = pastStates.length;
        for (let i = 0; i < toUndo; i++) temporal.getState().undo();
      }
      
      setIsPlaying(true);
      playIntervalRef.current = window.setInterval(() => {
        const { futureStates: future } = temporal.getState();
        if (future.length > 0) {
          temporal.getState().redo();
        } else {
          // Reached the end — stop.
          setIsPlaying(false);
          clearPlayInterval();
        }
      }, 500);
    }
  };

  const handleRewind = () => {
    temporal.getState().undo();
  };

  const handleFastForward = () => {
    temporal.getState().redo();
  };

  if (totalStates === 0) return null;

  return (
    <Panel position="bottom-center" className="mb-4 z-50 pointer-events-auto">
      <div className="bg-white/90 dark:bg-slate-800/90 backdrop-blur-md rounded-2xl shadow-xl border border-gray-200/50 dark:border-gray-700/50 p-3 flex flex-col gap-2 w-[400px] transition-all hover:shadow-2xl">
        <div className="flex items-center justify-between px-2">
          <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">Timelapse Player</span>
          <span className="text-xs font-mono text-gray-400 bg-gray-100 dark:bg-slate-700 px-2 py-0.5 rounded-full">
            {currentIndex} / {totalStates}
          </span>
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            onClick={handleRewind}
            disabled={pastStates.length === 0}
            className="p-1.5 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-full disabled:opacity-30 transition-colors"
          >
            <Rewind size={16} />
          </button>
          
          <button 
            onClick={togglePlay}
            className="p-2 bg-blue-500 text-white hover:bg-blue-600 rounded-full transition-colors shadow-md hover:scale-105 active:scale-95"
          >
            {isPlaying ? <Pause size={18} className="fill-white" /> : <Play size={18} className="fill-white" />}
          </button>
          
          <button 
            onClick={handleFastForward}
            disabled={futureStates.length === 0}
            className="p-1.5 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-full disabled:opacity-30 transition-colors"
          >
            <FastForward size={16} />
          </button>

          <input 
            type="range" 
            min="0" 
            max={totalStates} 
            value={currentIndex}
            onChange={handleScrub}
            className="flex-1 ml-2 h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
          />
        </div>
      </div>
    </Panel>
  );
}
