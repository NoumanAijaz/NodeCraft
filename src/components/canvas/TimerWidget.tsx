import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Timer, Play, Pause, Square, ChevronUp, ChevronDown, X } from 'lucide-react';
import { Panel } from '@xyflow/react';

export function TimerWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [minutes, setMinutes] = useState(5);
  const [seconds, setSeconds] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(0); // in seconds
  const [isFinished, setIsFinished] = useState(false);

  const timerRef = useRef<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Tick effect — runs the per-second decrement. Pure state update only:
  // no side effects inside the updater (React may double-invoke updaters in
  // StrictMode, which would cause audio glitches / double audio construction).
  useEffect(() => {
    if (!isRunning) return;
    timerRef.current = window.setInterval(() => {
      setTimeRemaining((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isRunning]);

  // Completion effect — when the countdown reaches 0 while running, fire the
  // alarm once. Side effects live here (not in the updater).
  useEffect(() => {
    if (!isRunning) return;
    if (timeRemaining !== 0) return;
    setIsRunning(false);
    setIsFinished(true);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    // Lazily construct the audio element so we don't pay the network cost
    // until the timer actually fires. The play() Promise is caught because
    // browsers reject it when autoplay is blocked (no user gesture yet).
    try {
      if (!audioRef.current) {
        audioRef.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
      }
      audioRef.current.currentTime = 0;
      const p = audioRef.current.play();
      if (p && typeof p.catch === 'function') {
        p.catch(() => { /* autoplay blocked — ignore */ });
      }
    } catch {
      // ignore audio construction errors
    }
  }, [timeRemaining, isRunning]);

  // Cleanup audio on unmount so it doesn't keep playing after navigating away.
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, []);

  const handleStart = () => {
    if (timeRemaining === 0) {
      const totalSec = minutes * 60 + seconds;
      if (totalSec === 0) return;
      setTimeRemaining(totalSec);
    }
    setIsRunning(true);
    setIsFinished(false);
  };

  const handlePause = () => {
    setIsRunning(false);
  };

  const handleStop = () => {
    setIsRunning(false);
    setTimeRemaining(0);
    setIsFinished(false);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  };

  const formatTime = (totalSeconds: number) => {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const currentDisplayTime = isFinished
    ? '00:00'
    : (isRunning || timeRemaining > 0 ? formatTime(timeRemaining) : formatTime(minutes * 60 + seconds));

  return (
    <Panel position="top-right" className="mt-4 mr-4 pointer-events-auto z-50">
      {!isOpen && !isRunning && timeRemaining === 0 ? (
        <button
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-4 py-2 rounded-full shadow-lucid-lg text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all font-medium text-sm group"
        >
          <Timer size={16} className="text-blue-500 group-hover:scale-110 transition-transform" />
          <span>Timer</span>
        </button>
      ) : (
        <div className={`bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lucid-lg shadow-lucid-xl overflow-hidden transition-all duration-300 w-64 ${isFinished ? 'ring-2 ring-red-500 animate-pulse' : ''}`}>
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 dark:border-gray-700/50 bg-gray-50/50 dark:bg-gray-800/50">
            <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-300 font-medium text-xs">
              <Timer size={14} className={isRunning ? "text-blue-500 animate-pulse" : "text-gray-400"} />
              Brainstorm Timer
            </div>
            {!isRunning && timeRemaining === 0 && (
              <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                <X size={14} />
              </button>
            )}
          </div>

          {/* Body */}
          <div className="p-4 flex flex-col items-center">
            {/* Time Display / Edit */}
            {!isRunning && timeRemaining === 0 && !isFinished ? (
              <div className="flex items-center justify-center gap-4 mb-4">
                <div className="flex flex-col items-center">
                  <button onClick={() => setMinutes(m => Math.min(60, m + 1))} className="p-1 text-gray-400 hover:text-blue-500"><ChevronUp size={16} /></button>
                  <span className="text-3xl font-mono font-bold text-gray-800 dark:text-white leading-none my-1">{minutes.toString().padStart(2, '0')}</span>
                  <button onClick={() => setMinutes(m => Math.max(0, m - 1))} className="p-1 text-gray-400 hover:text-blue-500"><ChevronDown size={16} /></button>
                </div>
                <span className="text-3xl font-mono font-bold text-gray-300 dark:text-gray-600 mb-1">:</span>
                <div className="flex flex-col items-center">
                  <button onClick={() => setSeconds(s => s >= 55 ? 0 : s + 5)} className="p-1 text-gray-400 hover:text-blue-500"><ChevronUp size={16} /></button>
                  <span className="text-3xl font-mono font-bold text-gray-800 dark:text-white leading-none my-1">{seconds.toString().padStart(2, '0')}</span>
                  <button onClick={() => setSeconds(s => s <= 0 ? 55 : s - 5)} className="p-1 text-gray-400 hover:text-blue-500"><ChevronDown size={16} /></button>
                </div>
              </div>
            ) : (
              <div className="text-4xl font-mono font-bold text-gray-800 dark:text-white mb-4 tracking-tight">
                {currentDisplayTime}
              </div>
            )}

            {/* Controls */}
            <div className="flex items-center gap-2 w-full">
              {!isRunning && timeRemaining === 0 ? (
                <>
                  <button onClick={() => { setMinutes(1); setSeconds(0); }} className="flex-1 py-1.5 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600 font-medium">1m</button>
                  <button onClick={() => { setMinutes(3); setSeconds(0); }} className="flex-1 py-1.5 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600 font-medium">3m</button>
                  <button onClick={() => { setMinutes(5); setSeconds(0); }} className="flex-1 py-1.5 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600 font-medium">5m</button>
                  <button 
                    onClick={handleStart} 
                    disabled={minutes === 0 && seconds === 0}
                    className="flex-1 py-1.5 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed font-medium flex justify-center"
                    title={minutes === 0 && seconds === 0 ? "Set a time first" : "Start timer"}
                  >
                    <Play size={14} className="fill-white" />
                  </button>
                </>
              ) : (
                <>
                  {isRunning ? (
                    <button onClick={handlePause} className="flex-1 py-2 bg-amber-500 text-white rounded hover:bg-amber-600 font-medium flex justify-center items-center gap-1.5 text-sm">
                      <Pause size={16} className="fill-white" /> Pause
                    </button>
                  ) : (
                    <button onClick={handleStart} className="flex-1 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 font-medium flex justify-center items-center gap-1.5 text-sm">
                      <Play size={16} className="fill-white" /> Resume
                    </button>
                  )}
                  <button onClick={handleStop} className="py-2 px-3 bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-gray-600 font-medium flex justify-center items-center">
                    <Square size={16} className="fill-current" />
                  </button>
                </>
              )}
            </div>
            
            {isFinished && (
              <p className="text-xs text-red-500 font-bold mt-3 uppercase tracking-wider">Time&apos;s up!</p>
            )}
          </div>
        </div>
      )}

      {isFinished && createPortal(
        <div className="fixed inset-0 pointer-events-none z-[9999] border-[12px] border-red-500/85 bg-red-500/5 animate-pulse flex items-center justify-center">
          <div className="bg-red-600 dark:bg-red-700 text-white font-extrabold text-sm sm:text-base px-6 py-3.5 rounded-xl shadow-2xl animate-bounce pointer-events-auto flex flex-col items-center gap-1 border border-red-500">
            <span className="text-2xl">⏰</span>
            <span>Brainstorm Session Time&apos;s Up!</span>
            <button 
              onClick={handleStop}
              className="mt-2.5 text-xs bg-white text-red-600 hover:bg-gray-100 active:scale-95 px-4 py-1.5 rounded-md font-bold transition-all shadow-md"
            >
              Dismiss Alarm
            </button>
          </div>
        </div>,
        document.body
      )}
    </Panel>
  );
}
