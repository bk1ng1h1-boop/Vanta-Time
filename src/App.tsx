/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Clock as ClockIcon, Timer as TimerIcon, Play, Pause, RotateCcw, Bell, Monitor, Volume2, VolumeX } from 'lucide-react';

// Bell Schedule Data
const BELL_SCHEDULE = [
  { name: '1st Period', start: '07:35', end: '09:05' },
  { name: '2nd Period', start: '09:10', end: '10:40' },
  { name: '3rd Period', start: '10:45', end: '12:40', subPeriods: [
    { name: '1st Lunch', start: '10:45', end: '11:10' },
    { name: '2nd Lunch', start: '11:15', end: '11:40' },
    { name: '3rd Lunch', start: '11:45', end: '12:10' },
    { name: '4th Lunch', start: '12:15', end: '12:40' },
  ]},
  { name: '4th Period', start: '12:45', end: '14:15' }, // 2:15pm is 14:15
  { name: 'Announcements', start: '14:15', end: '14:20' },
];

function getESTTime() {
  const now = new Date();
  // We use Intl.DateTimeFormat to reliably get the time in America/New_York
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false
  });
  
  const parts = formatter.formatToParts(now);
  const v: Record<string, number> = {};
  parts.forEach(p => { if (p.type !== 'literal') v[p.type] = parseInt(p.value, 10); });

  // Create a date object based on the formatted parts
  const estDate = new Date(v.year, v.month - 1, v.day, v.hour, v.minute, v.second);
  
  // The user reported the clock is 3 hours ahead, so we subtract 3 hours (10,800,000 ms)
  return new Date(estDate.getTime() - (3 * 3600 * 1000));
}

function formatTime(date: Date) {
  return date.toLocaleTimeString('en-US', { hour12: true, hour: 'numeric', minute: '2-digit', second: '2-digit' });
}

function timeToMinutes(timeStr: string) {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'clock' | 'timer' | 'stopwatch'>('clock');
  const [currentTime, setCurrentTime] = useState(getESTTime());
  
  // Timer state
  const [timerDuration, setTimerDuration] = useState(0); // in seconds
  const [timerLeft, setTimerLeft] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const timerIntervalRef = useRef<number | null>(null);

  // Stopwatch state
  const [stopwatchTime, setStopwatchTime] = useState(0); // in ms
  const [isStopwatchRunning, setIsStopwatchRunning] = useState(false);
  const stopwatchIntervalRef = useRef<number | null>(null);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(getESTTime());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Timer logic
  useEffect(() => {
    if (isTimerRunning && timerLeft > 0) {
      timerIntervalRef.current = window.setInterval(() => {
        setTimerLeft((prev) => {
          if (prev <= 1) {
            setIsTimerRunning(false);
            if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    }
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [isTimerRunning, timerLeft]);

  // Stopwatch logic
  useEffect(() => {
    if (isStopwatchRunning) {
      const startTime = Date.now() - stopwatchTime;
      stopwatchIntervalRef.current = window.setInterval(() => {
        setStopwatchTime(Date.now() - startTime);
      }, 10);
    } else {
      if (stopwatchIntervalRef.current) clearInterval(stopwatchIntervalRef.current);
    }
    return () => {
      if (stopwatchIntervalRef.current) clearInterval(stopwatchIntervalRef.current);
    };
  }, [isStopwatchRunning]);

  const currentSeconds = (currentTime.getHours() * 3600) + (currentTime.getMinutes() * 60) + currentTime.getSeconds();
  const currentMinutes = currentTime.getHours() * 60 + currentTime.getMinutes();
  
  const startOfScheduleSeconds = 7 * 3600 + 35 * 60; // 7:35 AM
  const endOfDaySeconds = 14 * 3600 + 20 * 60; // 2:20 PM
  const secondsToStartOfDay = Math.max(0, startOfScheduleSeconds - currentSeconds);
  const secondsToEndOfDay = Math.max(0, endOfDaySeconds - currentSeconds);

  // Separate countdowns for each period/lunch
  const allMilestones = useMemo(() => {
    const milestones = [];
    for (const period of BELL_SCHEDULE) {
      milestones.push({ name: period.name, start: period.start, end: period.end });
      if (period.subPeriods) {
        for (const sub of period.subPeriods) {
          milestones.push({ name: sub.name, start: sub.start, end: sub.end });
        }
      }
    }
    return milestones.map(m => {
      const startSecs = timeToMinutes(m.start) * 60;
      const endSecs = timeToMinutes(m.end) * 60;
      return {
        ...m,
        secondsToStart: Math.max(0, startSecs - currentSeconds),
        secondsToEnd: Math.max(0, endSecs - currentSeconds),
        isActive: currentSeconds >= startSecs && currentSeconds < endSecs
      };
    }).sort((a, b) => a.secondsToStart - b.secondsToStart);
  }, [currentSeconds]);

  const currentPeriod = useMemo(() => {
    for (const period of BELL_SCHEDULE) {
      const start = timeToMinutes(period.start);
      const end = timeToMinutes(period.end);
      if (currentMinutes >= start && currentMinutes < end) {
        // Handle sub-periods (Lunches)
        if (period.subPeriods) {
          const sub = period.subPeriods.find(s => {
            const sStart = timeToMinutes(s.start);
            const sEnd = timeToMinutes(s.end);
            return currentMinutes >= sStart && currentMinutes < sEnd;
          });
          return sub ? { ...sub, parent: period.name } : period;
        }
        return period;
      }
    }
    return null;
  }, [currentMinutes]);

  const nextEvent = useMemo(() => {
    // If in a period, next event is its end
    if (currentPeriod) {
      const endSecs = timeToMinutes(currentPeriod.end) * 60;
      return { name: `End of ${currentPeriod.name}`, time: currentPeriod.end, secondsLeft: endSecs - currentSeconds };
    }
    // If not in a period, next event is the start of the next period
    for (const period of BELL_SCHEDULE) {
      const startSecs = timeToMinutes(period.start) * 60;
      if (startSecs > currentSeconds) {
        return { name: `Start of ${period.name}`, time: period.start, secondsLeft: startSecs - currentSeconds };
      }
    }
    return null;
  }, [currentPeriod, currentSeconds]);

  const nextPeriod = useMemo(() => {
    for (const period of BELL_SCHEDULE) {
      const start = timeToMinutes(period.start);
      if (start > currentMinutes) return period;
    }
    return null;
  }, [currentMinutes]);

  const formatCountdown = (totalSeconds: number) => {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return `${h > 0 ? h + 'h ' : ''}${m}m ${s}s`;
  };

  const formatTimer = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h > 0 ? h + ':' : ''}${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const formatStopwatch = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    const mill = Math.floor((ms % 1000) / 10);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${mill.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans selection:bg-purple-500/30">
      {/* Background Glow */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-purple-900/20 rounded-full blur-[120px]" />
        <div className="absolute -bottom-[10%] -right-[10%] w-[40%] h-[40%] bg-purple-900/20 rounded-full blur-[120px]" />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-6 py-12 flex flex-col min-h-screen">
        {/* Header Navigation */}
        <header className="flex justify-between items-center mb-16">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center shadow-[0_0_20px_rgba(147,51,234,0.3)]">
              <ClockIcon size={18} className="text-white" />
            </div>
            <span className="font-medium tracking-tight text-xl">Vanta Time</span>
          </div>
          
          <nav className="flex gap-1 bg-white/5 p-1 rounded-full border border-white/10 backdrop-blur-md">
            {(['clock', 'timer', 'stopwatch'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all uppercase tracking-wider ${
                  activeTab === tab 
                  ? 'bg-purple-600 text-white shadow-[0_0_15px_rgba(147,51,234,0.4)]' 
                  : 'text-white/50 hover:text-white/80'
                }`}
              >
                {tab}
              </button>
            ))}
          </nav>
        </header>

        {/* Main Display Area */}
        <main className="flex-1 flex flex-col justify-center">
          <AnimatePresence mode="wait">
            {activeTab === 'clock' && (
              <motion.div
                key="clock"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                className="text-center"
              >
                <div className="mb-0">
                  <h1 className="text-8xl md:text-9xl font-light tracking-tighter tabular-nums mb-4 drop-shadow-[0_0_30px_rgba(147,51,234,0.2)]">
                    {currentTime.toLocaleTimeString('en-US', { hour12: true, hour: '2-digit', minute: '2-digit' }).replace(/\s?[AP]M/, '')}
                    <span className="text-4xl md:text-5xl opacity-30 font-extralight ml-2">
                      {currentTime.toLocaleTimeString('en-US', { second: '2-digit' })}
                    </span>
                    <span className="text-2xl md:text-3xl opacity-20 font-extralight ml-2 uppercase">
                      {currentTime.getHours() >= 12 ? 'pm' : 'am'}
                    </span>
                  </h1>
                  <p className="text-purple-400/80 font-mono text-sm tracking-[0.2em] uppercase mb-12">
                    EST • {currentTime.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto">
                  <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6 backdrop-blur-sm group hover:border-purple-500/30 transition-colors">
                    <span className="text-[10px] uppercase tracking-widest text-white/40 block mb-2">Current Period</span>
                    <h2 className="text-2xl font-medium text-purple-200">
                      {currentPeriod ? currentPeriod.name : 'Out of School'}
                    </h2>
                    {currentPeriod?.parent && (
                      <p className="text-xs text-white/40 mt-1">Part of {currentPeriod.parent}</p>
                    )}
                    {currentPeriod && (
                      <div className="mt-4 flex items-center justify-between text-xs font-mono">
                        <span className="text-white/60">{currentPeriod.start}</span>
                        <div className="flex-1 mx-3 h-1 bg-white/5 rounded-full overflow-hidden">
                           <motion.div 
                             className="h-full bg-purple-600"
                             initial={{ width: 0 }}
                             animate={{ width: `${((currentMinutes - timeToMinutes(currentPeriod.start)) / (timeToMinutes(currentPeriod.end) - timeToMinutes(currentPeriod.start))) * 100}%` }}
                           />
                        </div>
                        <span className="text-white/60">{currentPeriod.end}</span>
                      </div>
                    )}
                  </div>

                  <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6 backdrop-blur-sm group hover:border-purple-500/30 transition-colors">
                    <span className="text-[10px] uppercase tracking-widest text-white/40 block mb-2">Next Watch</span>
                    {nextEvent ? (
                      <>
                        <h2 className="text-2xl font-medium text-white/80 line-clamp-1">{nextEvent.name}</h2>
                        <div className="mt-4 flex flex-col">
                          <span className="text-4xl font-light tracking-tighter tabular-nums text-purple-400">
                            {formatCountdown(nextEvent.secondsLeft)}
                          </span>
                          <span className="text-[10px] text-white/20 uppercase tracking-widest mt-1">Countdown to {nextEvent.time}</span>
                        </div>
                      </>
                    ) : (
                      <h2 className="text-2xl font-medium text-white/40 italic">Schedule Complete</h2>
                    )}
                  </div>

                  <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6 backdrop-blur-sm group hover:border-purple-500/30 transition-colors">
                    <span className="text-[10px] uppercase tracking-widest text-white/40 block mb-2">Grand Dismissal</span>
                    <div className="mt-0 space-y-4">
                      {secondsToStartOfDay > 0 ? (
                        <div className="flex flex-col">
                          <h2 className="text-xl font-medium text-white/50">Schedule Starts In</h2>
                          <span className="text-3xl font-light tracking-tighter tabular-nums text-purple-400">
                            {formatCountdown(secondsToStartOfDay)}
                          </span>
                          <span className="text-[10px] text-white/20 uppercase tracking-widest mt-1">Target: 7:35 AM EST</span>
                        </div>
                      ) : null}
                      
                      {secondsToEndOfDay > 0 ? (
                        <div className="flex flex-col pt-2 border-t border-white/5">
                          <h2 className="text-xl font-medium text-white/50">{secondsToStartOfDay > 0 ? 'Schedule Ends In' : 'End of Day'}</h2>
                          <span className="text-3xl font-light tracking-tighter tabular-nums text-white/80">
                            {formatCountdown(secondsToEndOfDay)}
                          </span>
                          <span className="text-[10px] text-white/20 uppercase tracking-widest mt-1">Target: 2:20 PM EST</span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center pt-2">
                          <Bell className="text-purple-500 mb-2 animate-bounce" size={24} />
                          <h2 className="text-xl font-medium text-purple-400">Day Dismissed</h2>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Period Detailed Countdowns */}
                <div className="mt-12 max-w-4xl mx-auto w-full">
                  <div className="flex items-center gap-4 mb-6">
                    <h3 className="text-xs uppercase tracking-[0.3em] font-semibold text-white/30">Milestone Trackers</h3>
                    <div className="h-px flex-1 bg-white/5" />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {allMilestones.filter(m => m.secondsToEnd > 0).map((m, idx) => (
                      <motion.div 
                        key={m.name}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: idx * 0.05 }}
                        className={`p-4 rounded-xl border backdrop-blur-sm transition-all ${
                          m.isActive 
                          ? 'bg-purple-600/10 border-purple-500/50 shadow-[0_4px_20px_rgba(147,51,234,0.1)]' 
                          : 'bg-white/[0.02] border-white/10'
                        }`}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <span className={`text-[10px] font-bold uppercase tracking-tighter ${m.isActive ? 'text-purple-400' : 'text-white/20'}`}>
                            {m.isActive ? 'IN SESSION' : 'COMING UP'}
                          </span>
                          <span className="text-[10px] text-white/40 font-mono">{m.start} - {m.end}</span>
                        </div>
                        <h4 className={`text-lg font-medium mb-2 ${m.isActive ? 'text-white' : 'text-white/60'}`}>{m.name}</h4>
                        <div className="flex flex-col">
                          <span className={`text-xl font-light tabular-nums ${m.isActive ? 'text-purple-400' : 'text-white/40'}`}>
                            {m.isActive 
                              ? formatCountdown(m.secondsToEnd) 
                              : formatCountdown(m.secondsToStart)}
                          </span>
                          <span className="text-[9px] uppercase tracking-widest text-white/20 mt-0.5">
                            {m.isActive ? 'Time Remaining' : 'Starts In'}
                          </span>
                        </div>
                        {m.isActive && (
                          <div className="mt-3 h-1 bg-white/5 rounded-full overflow-hidden">
                            <motion.div 
                              className="h-full bg-purple-600"
                              initial={{ width: 0 }}
                              animate={{ width: `${((currentSeconds - timeToMinutes(m.start)*60) / (timeToMinutes(m.end)*60 - timeToMinutes(m.start)*60)) * 100}%` }}
                            />
                          </div>
                        )}
                      </motion.div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'timer' && (
              <motion.div
                key="timer"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                className="flex flex-col items-center"
              >
                {!isTimerRunning && timerLeft === 0 ? (
                  <div className="grid grid-cols-3 gap-6 mb-12">
                     {[5, 15, 25, 45, 60, 90].map(mins => (
                       <button
                         key={mins}
                         onClick={() => {
                           setTimerDuration(mins * 60);
                           setTimerLeft(mins * 60);
                           setIsTimerRunning(true);
                         }}
                         className="w-20 h-20 rounded-full border border-white/10 flex flex-col items-center justify-center hover:bg-purple-600 hover:border-purple-600 transition-all text-white/60 hover:text-white"
                       >
                         <span className="text-lg font-medium">{mins}</span>
                         <span className="text-[8px] uppercase tracking-tighter">min</span>
                       </button>
                     ))}
                  </div>
                ) : (
                  <div className="text-center mb-12">
                    <h1 className="text-9xl font-light tracking-tighter tabular-nums mb-4 drop-shadow-[0_0_30px_rgba(147,51,234,0.2)]">
                      {formatTimer(timerLeft)}
                    </h1>
                    <div className="w-64 h-1.5 bg-white/5 rounded-full mx-auto overflow-hidden">
                       <motion.div 
                         className="h-full bg-purple-600"
                         animate={{ width: `${(timerLeft / timerDuration) * 100}%` }}
                         transition={{ duration: 1, ease: 'linear' }}
                       />
                    </div>
                  </div>
                )}

                <div className="flex gap-4">
                  {(isTimerRunning || timerLeft > 0) && (
                    <>
                      <button
                        onClick={() => setIsTimerRunning(!isTimerRunning)}
                        className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-colors"
                      >
                        {isTimerRunning ? <Pause size={24} /> : <Play size={24} />}
                      </button>
                      <button
                        onClick={() => {
                          setIsTimerRunning(false);
                          setTimerLeft(0);
                        }}
                        className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-colors"
                      >
                        <RotateCcw size={24} />
                      </button>
                    </>
                  )}
                </div>
              </motion.div>
            )}

            {activeTab === 'stopwatch' && (
              <motion.div
                key="stopwatch"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                className="flex flex-col items-center"
              >
                <div className="text-center mb-12">
                  <h1 className="text-9xl font-light tracking-tighter tabular-nums mb-8 drop-shadow-[0_0_30px_rgba(147,51,234,0.2)]">
                    {formatStopwatch(stopwatchTime)}
                  </h1>
                </div>

                <div className="flex gap-4">
                  <button
                    onClick={() => setIsStopwatchRunning(!isStopwatchRunning)}
                    className="w-16 h-16 rounded-full bg-purple-600 border border-purple-500 shadow-[0_0_20px_rgba(147,51,234,0.4)] flex items-center justify-center hover:bg-purple-500 transition-colors"
                  >
                    {isStopwatchRunning ? <Pause size={24} /> : <Play size={24} />}
                  </button>
                  <button
                    onClick={() => {
                      setIsStopwatchRunning(false);
                      setStopwatchTime(0);
                    }}
                    className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-colors"
                  >
                    <RotateCcw size={24} />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        {/* Footer info/controls */}
        <footer className="mt-auto pt-12 flex justify-between items-end">
          <div>
            <span className="text-[10px] uppercase tracking-widest text-white/20 block mb-1">Status</span>
            <div className="flex items-center gap-2 text-xs text-white/40">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]" />
              Live Sync Active
            </div>
          </div>
          
          <div className="text-right">
             <p className="text-[10px] uppercase tracking-widest text-white/20 mb-1">Institution</p>
             <p className="text-xl font-bold tracking-tighter text-purple-400 mb-2">LIGON MS</p>
             <p className="text-[10px] uppercase tracking-widest text-white/20 mb-1">Bell Schedule Provider</p>
             <p className="text-sm font-medium text-white/60">Regular Bell Schedule</p>
          </div>
        </footer>
      </div>

      {/* Detail Overlay Grid */}
      <div className="fixed inset-0 pointer-events-none opacity-[0.03] overflow-hidden">
        <div className="w-full h-full bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:24px_24px]" />
      </div>
    </div>
  );
}
