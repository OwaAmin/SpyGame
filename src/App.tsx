/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI } from "@google/genai";
import { 
  User, 
  Users, 
  Shield, 
  Eye, 
  EyeOff, 
  Settings, 
  History, 
  Trophy, 
  Info, 
  Plus, 
  Minus, 
  Play, 
  RotateCcw, 
  CheckCircle2, 
  XCircle,
  Volume2,
  VolumeX,
  Lock,
  Trash2,
  ChevronLeft,
  Sparkles,
  ListPlus,
  Search,
  Zap,
  Medal,
  Star,
  Target,
  Dna
} from 'lucide-react';
import { CATEGORIES } from './words';

const EMOJIS = ['🕵️', '👤', '🕶️', '🤫', '📱', '💻', '🔍', '💼', '🔫', '💣', '🎭', '🔦'];

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// --- Types ---
type Difficulty = 'EASY' | 'HARD';
type Role = 'CITIZEN' | 'SPY' | 'DETECTIVE' | 'INSIDER';
type GameState = 'MENU' | 'SETUP' | 'REVEAL' | 'WHEEL' | 'PLAYING' | 'VOTING' | 'END' | 'HISTORY' | 'SCOREBOARD' | 'HOW_TO_PLAY' | 'ADMIN_LOGIN' | 'CUSTOM_CATEGORIES' | 'ACHIEVEMENTS' | 'STATS';

interface Player {
  id: number;
  name: string;
  role: Role;
  score: number;
  avatar: string;
}

interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
}

const ACHIEVEMENTS_LIST: Achievement[] = [
  { id: 'FIRST_WIN', title: 'اولین ماموریت', description: 'اولین پیروزی خود را ثبت کنید', icon: <Star className="text-amber-400" /> },
  { id: 'SPY_MASTER', title: 'شبح متحرک', description: 'پیروزی به عنوان جاسوس بدون جلب توجه', icon: <Shield className="text-rose-500" /> },
  { id: 'SHARP_EYE', title: 'شکارچی جاسوس', description: 'شناسایی موفق جاسوس در ۳ بازی', icon: <Search className="text-emerald-500" /> },
  { id: 'SILVER_TONGUE', title: 'زبان‌باز', description: 'متقاعد کردن جمع به بی‌گناهی خود در نقش جاسوس', icon: <Zap className="text-yellow-400" /> },
  { id: 'DETECTIVE_PRO', title: 'شرلوک هولمز', description: 'پیروزی در نقش کارآگاه با کمترین سوال', icon: <Target className="text-indigo-500" /> },
  { id: 'INSIDER_HERO', title: 'نفوذی فداکار', description: 'کمک به شهروندان بدون لو رفتن هویت نفوذی', icon: <Eye className="text-amber-500" /> },
];

interface HistoryItem {
  id: number;
  date: string;
  players: string;
  spy_count: number;
  winner: string;
  difficulty: string;
  word: string;
  special_roles: string;
}

interface ScoreItem {
  player_name: string;
  score: number;
}

// --- Sound Effects Helper ---
const playSound = (type: 'click' | 'reveal' | 'win' | 'spy' | 'error') => {
  const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();

  osc.connect(gain);
  gain.connect(audioCtx.destination);

  const now = audioCtx.currentTime;

  switch (type) {
    case 'click':
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(110, now + 0.1);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
      osc.start(now);
      osc.stop(now + 0.1);
      break;
    case 'reveal':
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.linearRampToValueAtTime(880, now + 0.3);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
      osc.start(now);
      osc.stop(now + 0.3);
      break;
    case 'win':
      osc.type = 'square';
      osc.frequency.setValueAtTime(523.25, now); // C5
      osc.frequency.setValueAtTime(659.25, now + 0.1); // E5
      osc.frequency.setValueAtTime(783.99, now + 0.2); // G5
      gain.gain.setValueAtTime(0.05, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
      osc.start(now);
      osc.stop(now + 0.5);
      break;
    case 'spy':
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(110, now);
      osc.frequency.linearRampToValueAtTime(55, now + 0.5);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
      osc.start(now);
      osc.stop(now + 0.5);
      break;
    case 'error':
      osc.type = 'sine';
      osc.frequency.setValueAtTime(150, now);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
      osc.start(now);
      osc.stop(now + 0.2);
      break;
  }
};

interface MapZone {
  id: string;
  name: string;
  description: string;
  x: number;
  y: number;
}

const InteractiveMap = ({ isSpy, mapZones }: { isSpy: boolean, mapZones: MapZone[] }) => {
  const [selectedZone, setSelectedZone] = useState<MapZone | null>(null);

  return (
    <div className="w-full space-y-2">
      <div className="relative w-full aspect-[16/10] bg-slate-900/50 rounded-2xl border border-white/10 overflow-hidden group shadow-inner">
        <div className="absolute inset-0 opacity-10 pointer-events-none" 
             style={{ backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
        
        <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-20">
          {mapZones.map((zone, i) => (
            mapZones[i+1] && (
              <line 
                key={i}
                x1={`${zone.x}%`} y1={`${zone.y}%`}
                x2={`${mapZones[i+1].x}%`} y2={`${mapZones[i+1].y}%`}
                stroke="#00f2ff" strokeWidth="1" strokeDasharray="4"
              />
            )
          ))}
        </svg>

        {mapZones.map((zone) => (
          <motion.button
            key={zone.id}
            whileHover={{ scale: 1.4 }}
            onClick={() => setSelectedZone(zone)}
            className="absolute w-4 h-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-primary shadow-[0_0_10px_#00f2ff] z-10 border-2 border-white/50"
            style={{ left: `${zone.x}%`, top: `${zone.y}%` }}
          />
        ))}

        {isSpy && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80 backdrop-blur-md z-20 p-4">
            <div className="text-center">
              <Shield className="w-10 h-10 text-rose-500 mx-auto mb-2 animate-pulse" />
              <p className="text-rose-500 font-black text-sm mb-1">دسترسی غیرمجاز</p>
              <p className="text-[10px] text-slate-400">سیستم امنیتی نقشه را مسدود کرده است.</p>
            </div>
          </div>
        )}
      </div>

      <AnimatePresence mode="wait">
        {selectedZone && !isSpy && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-brand-primary/10 border border-brand-primary/30 p-2 rounded-xl backdrop-blur-md"
          >
            <div className="flex items-center gap-2 mb-1">
              <div className="w-1.5 h-1.5 rounded-full bg-brand-primary animate-ping" />
              <h4 className="font-black text-brand-primary text-[10px] uppercase tracking-widest">{selectedZone.name}</h4>
            </div>
            <p className="text-[10px] text-slate-400 leading-tight">{selectedZone.description}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const VotingScreen = ({ 
  players, 
  votingIndex, 
  spyCount, 
  submitVote, 
  handleAction 
}: { 
  players: Player[], 
  votingIndex: number, 
  spyCount: number, 
  submitVote: (ids: number[]) => void,
  handleAction: (type: any) => void
}) => {
  const currentPlayer = players[votingIndex];
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  // Reset selection when voting index changes
  useEffect(() => {
    setSelectedIds([]);
  }, [votingIndex]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 space-y-8">
      <div className="text-center space-y-2">
        <div className="text-4xl mb-2">{currentPlayer.avatar}</div>
        <h2 className="text-2xl font-bold text-white">{currentPlayer.name}</h2>
        <p className="text-slate-400">
          {spyCount > 1 ? `${spyCount} نفر را به عنوان جاسوس انتخاب کنید:` : 'به چه کسی مشکوک هستید؟'}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 w-full max-w-sm">
        {players.map((p) => (
          p.id !== currentPlayer.id && (
            <button
              key={p.id}
              onClick={() => {
                if (selectedIds.includes(p.id)) {
                  setSelectedIds(selectedIds.filter(id => id !== p.id));
                } else if (selectedIds.length < spyCount) {
                  setSelectedIds([...selectedIds, p.id]);
                }
                handleAction('click');
              }}
              className={`glass p-4 rounded-2xl flex flex-col items-center gap-2 transition-all border-2 ${
                selectedIds.includes(p.id) ? 'border-rose-500 bg-rose-500/10' : 'border-transparent hover:border-indigo-500/50'
              }`}
            >
              <span className="text-2xl">{p.avatar}</span>
              <span className="font-bold text-sm">{p.name}</span>
            </button>
          )
        ))}
      </div>

      <button 
        disabled={selectedIds.length !== spyCount}
        onClick={() => submitVote(selectedIds)}
        className={`btn-primary w-full max-w-xs ${selectedIds.length !== spyCount ? 'opacity-50 grayscale cursor-not-allowed' : ''}`}
      >
        ثبت رای ({selectedIds.length}/{spyCount})
      </button>
    </div>
  );
};

export default function App() {
  const [gameState, setGameState] = useState<GameState>('MENU');
  const [difficulty, setDifficulty] = useState<Difficulty>('EASY');
  const [players, setPlayers] = useState<Player[]>([]);
  const [playerNames, setPlayerNames] = useState<string[]>(['امین', 'امیرعباس', 'پژمان', 'محمد', 'امیرعلی']);
  const [spyCount, setSpyCount] = useState(1);
  const [currentWord, setCurrentWord] = useState('');
  const [mapZones, setMapZones] = useState<MapZone[]>([]);
  const [isGeneratingMap, setIsGeneratingMap] = useState(false);
  const [revealIndex, setRevealIndex] = useState(0);
  const [isRoleVisible, setIsRoleVisible] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [adminPassword, setAdminPassword] = useState('');
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [scores, setScores] = useState<ScoreItem[]>([]);
  const [newPlayerName, setNewPlayerName] = useState('');
  const [customCategories, setCustomCategories] = useState<{name: string, words: string[]}[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  // Load custom categories from local storage
  useEffect(() => {
    const saved = localStorage.getItem('spy_custom_categories');
    if (saved) setCustomCategories(JSON.parse(saved));
  }, []);

  const saveCustomCategories = (newCats: {name: string, words: string[]}[]) => {
    setCustomCategories(newCats);
    localStorage.setItem('spy_custom_categories', JSON.stringify(newCats));
  };

  const generateWordsWithAI = async (diff: Difficulty) => {
    setIsGenerating(true);
    handleAction('click');
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Generate a list of 50 unique, realistic, and relevant locations/words for a Spy game (like Spyfall) in Persian. 
        The difficulty level is ${diff === 'EASY' ? 'Easy (common places)' : 'Hard (specific or technical places)'}.
        Return ONLY a JSON array of strings. No other text.`,
      });
      
      const text = response.text;
      const match = text.match(/\[.*\]/s);
      if (match) {
        const newWords = JSON.parse(match[0]);
        const newCat = { name: `هوش مصنوعی - ${diff === 'EASY' ? 'آسان' : 'سخت'} (${new Date().toLocaleTimeString('fa-IR')})`, words: newWords };
        saveCustomCategories([...customCategories, newCat]);
        handleAction('win');
      }
    } catch (e) {
      console.error(e);
      handleAction('error');
    } finally {
      setIsGenerating(false);
    }
  };

  const renderCustomCategories = () => (
    <div className="flex flex-col min-h-screen p-6 space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={() => setGameState('MENU')} className="p-2 rounded-xl bg-slate-800"><ChevronLeft /></button>
        <h2 className="text-2xl font-bold">دسته‌بندی‌های دلخواه</h2>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2">
          <button 
            disabled={isGenerating}
            onClick={() => generateWordsWithAI('EASY')}
            className="btn-secondary flex items-center justify-center gap-2 text-sm py-4"
          >
            <Sparkles className="w-4 h-4 text-amber-400" /> تولید ۵۰ کلمه آسان
          </button>
          <button 
            disabled={isGenerating}
            onClick={() => generateWordsWithAI('HARD')}
            className="btn-secondary flex items-center justify-center gap-2 text-sm py-4"
          >
            <Sparkles className="w-4 h-4 text-indigo-400" /> تولید ۵۰ کلمه سخت
          </button>
        </div>

        {isGenerating && (
          <div className="text-center p-4 glass rounded-2xl animate-pulse text-indigo-400">
            در حال تولید کلمات توسط هوش مصنوعی...
          </div>
        )}

        <div className="space-y-4">
          {customCategories.map((cat, i) => (
            <div key={i} className="glass p-4 rounded-2xl space-y-2">
              <div className="flex justify-between items-center">
                <span className="font-bold">{cat.name}</span>
                <button onClick={() => {
                  const newCats = customCategories.filter((_, idx) => idx !== i);
                  saveCustomCategories(newCats);
                }} className="text-rose-500"><Trash2 className="w-4 h-4" /></button>
              </div>
              <div className="text-xs text-slate-500 truncate">
                {cat.words.join('، ')}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  // LocalStorage Helpers
  const getLocalData = (key: string, defaultValue: any) => {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : defaultValue;
  };

  const setLocalData = (key: string, data: any) => {
    localStorage.setItem(key, JSON.stringify(data));
  };

  const fetchScores = () => {
    const data = getLocalData('spygame_scores', []);
    setScores(data.sort((a: any, b: any) => b.score - a.score));
  };

  const fetchHistory = () => {
    const data = getLocalData('spygame_history', []);
    setHistory(data.sort((a: any, b: any) => b.id - a.id));
  };

  const fetchPlayerAchievements = (name: string) => {
    const allAchievements = getLocalData('spygame_achievements', []);
    const playerAch = allAchievements
      .filter((a: any) => a.player_name === name)
      .map((a: any) => a.achievement_id);
    setPlayerAchievements(playerAch);
  };

  const updateScore = (playerName: string, increment: number) => {
    const currentScores = getLocalData('spygame_scores', []);
    const existingIdx = currentScores.findIndex((s: any) => s.player_name === playerName);
    
    if (existingIdx !== -1) {
      currentScores[existingIdx].score += increment;
    } else {
      currentScores.push({ player_name: playerName, score: increment });
    }
    
    setLocalData('spygame_scores', currentScores);
  };

  const addAchievement = (playerName: string, achievementId: string) => {
    const allAchievements = getLocalData('spygame_achievements', []);
    const exists = allAchievements.some((a: any) => a.player_name === playerName && a.achievement_id === achievementId);
    
    if (!exists) {
      allAchievements.push({
        player_name: playerName,
        achievement_id: achievementId,
        date: new Date().toLocaleString('fa-IR')
      });
      setLocalData('spygame_achievements', allAchievements);
    }
  };

  const addToHistory = (item: any) => {
    const currentHistory = getLocalData('spygame_history', []);
    const newItem = {
      ...item,
      id: Date.now(),
      players: JSON.stringify(item.players),
      special_roles: JSON.stringify(item.special_roles)
    };
    currentHistory.push(newItem);
    setLocalData('spygame_history', currentHistory);
  };

  // Fetch initial data
  useEffect(() => {
    fetchScores();
    fetchHistory();
  }, []);

  const handleAction = (type: 'click' | 'reveal' | 'win' | 'spy' | 'error') => {
    if (soundEnabled) playSound(type);
    if ('vibrate' in navigator) {
      if (type === 'error') navigator.vibrate([100, 50, 100]);
      else if (type === 'reveal') navigator.vibrate(50);
      else if (type === 'win' || type === 'spy') navigator.vibrate(200);
      else navigator.vibrate(10);
    }
  };

  const [selectedCategory, setSelectedCategory] = useState<string>('DEFAULT_EASY');
  const [detectiveEnabled, setDetectiveEnabled] = useState(false);
  const [insiderEnabled, setInsiderEnabled] = useState(false);
  const [starterPlayer, setStarterPlayer] = useState<Player | null>(null);
  const [isWheelSpinning, setIsWheelSpinning] = useState(false);
  const [themeColor, setThemeColor] = useState('indigo');
  const [gameTimer, setGameTimer] = useState(300); // 5 minutes default
  const [timeLeft, setTimeLeft] = useState(300);
  const [isTimerActive, setIsTimerActive] = useState(false);
  const [votingIndex, setVotingIndex] = useState(0);
  const [votes, setVotes] = useState<Record<number, number[]>>({});
  const [votingPlayer, setVotingPlayer] = useState<Player | null>(null);
  const [playerAvatars, setPlayerAvatars] = useState<Record<string, string>>({});

  // Soundtrack logic
  useEffect(() => {
    if (!isTimerActive || !soundEnabled) return;

    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    let nextNoteTime = audioCtx.currentTime;

    const scheduler = () => {
      while (nextNoteTime < audioCtx.currentTime + 0.1) {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        
        // Tense low beat
        osc.type = 'sine';
        osc.frequency.setValueAtTime(timeLeft < 30 ? 80 : 60, nextNoteTime);
        
        gain.gain.setValueAtTime(0.1, nextNoteTime);
        gain.gain.exponentialRampToValueAtTime(0.001, nextNoteTime + 0.1);
        
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        
        osc.start(nextNoteTime);
        osc.stop(nextNoteTime + 0.1);
        
        // Speed up as time runs out
        const tempo = timeLeft < 60 ? 0.4 : 0.8;
        nextNoteTime += tempo;
      }
    };

    const timer = setInterval(scheduler, 50);
    return () => {
      clearInterval(timer);
      audioCtx.close();
    };
  }, [isTimerActive, timeLeft, soundEnabled]);

  // Timer effect
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isTimerActive && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft(prev => prev - 1);
      }, 1000);
    } else if (timeLeft === 0 && isTimerActive) {
      setIsTimerActive(false);
      handleAction('error');
    }
    return () => clearInterval(interval);
  }, [isTimerActive, timeLeft]);

  const generateMapData = async (word: string) => {
    setIsGeneratingMap(true);
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `برای مکان "${word}" در بازی جاسوس، ۵ بخش یا اتاق مختلف طراحی کن.
        خروجی فقط یک JSON Array شامل اشیایی با فیلدهای زیر باشد:
        - id: رشته یکتا
        - name: نام بخش (فارسی)
        - description: توصیف کوتاه (فارسی)
        - x: عدد بین 10 تا 90 (موقعیت افقی)
        - y: عدد بین 10 تا 90 (موقعیت عمودی)
        فقط JSON برگردان.`,
      });
      const text = response.text;
      const match = text.match(/\[.*\]/s);
      if (match) {
        setMapZones(JSON.parse(match[0]));
      }
    } catch (e) {
      console.error("Map generation failed:", e);
      setMapZones([
        { id: '1', name: 'ورودی امنیتی', description: 'بخش کنترل ورود و خروج', x: 20, y: 20 },
        { id: '2', name: 'سالن مرکزی', description: 'محل تجمع اصلی', x: 50, y: 50 },
        { id: '3', name: 'اتاق سرور', description: 'مرکز داده‌های حساس', x: 80, y: 30 },
        { id: '4', name: 'انبار تجهیزات', description: 'محل نگهداری ابزارها', x: 30, y: 70 },
        { id: '5', name: 'خروجی اضطراری', description: 'مسیر فرار سریع', x: 70, y: 80 },
      ]);
    } finally {
      setIsGeneratingMap(false);
    }
  };

  const startGame = async () => {
    handleAction('click');
    setTimeLeft(gameTimer);
    setIsTimerActive(false);
    let wordList: string[] = [];
    let theme = 'indigo';

    if (selectedCategory === 'DEFAULT_EASY') {
      wordList = CATEGORIES.EASY.words;
      theme = CATEGORIES.EASY.theme;
    } else if (selectedCategory === 'DEFAULT_HARD') {
      wordList = CATEGORIES.HARD.words;
      theme = CATEGORIES.HARD.theme;
    } else if (selectedCategory.startsWith('CUSTOM_')) {
      const idx = parseInt(selectedCategory.split('_')[1]);
      wordList = customCategories[idx].words;
      theme = 'amber';
    }

    setThemeColor(theme);
    const randomWord = wordList[Math.floor(Math.random() * wordList.length)];
    setCurrentWord(randomWord);
    
    // Generate Map
    generateMapData(randomWord);

    let newPlayers: Player[] = playerNames.map((name, index) => ({
      id: index,
      name,
      role: 'CITIZEN',
      score: 0,
      avatar: playerAvatars[name] || EMOJIS[index % EMOJIS.length]
    }));

    // Assign Spies
    let assignedSpies = 0;
    while (assignedSpies < spyCount) {
      const randomIndex = Math.floor(Math.random() * newPlayers.length);
      if (newPlayers[randomIndex].role === 'CITIZEN') {
        newPlayers[randomIndex].role = 'SPY';
        assignedSpies++;
      }
    }

    // Assign Special Roles if enabled
    const citizenIndices = newPlayers.map((p, i) => p.role === 'CITIZEN' ? i : -1).filter(i => i !== -1);
    
    if (detectiveEnabled && citizenIndices.length > 0) {
      const detIdx = citizenIndices.splice(Math.floor(Math.random() * citizenIndices.length), 1)[0];
      newPlayers[detIdx].role = 'DETECTIVE';
    }
    
    if (insiderEnabled && citizenIndices.length > 0) {
      const insIdx = citizenIndices.splice(Math.floor(Math.random() * citizenIndices.length), 1)[0];
      newPlayers[insIdx].role = 'INSIDER';
    }

    setPlayers(newPlayers);
    setRevealIndex(0);
    setIsRoleVisible(false);
    setGameState('REVEAL');
  };

  const startWheel = () => {
    handleAction('click');
    setGameState('WHEEL');
    setIsWheelSpinning(true);
    setTimeout(() => {
      const winner = players[Math.floor(Math.random() * players.length)];
      setStarterPlayer(winner);
      setIsWheelSpinning(false);
      setIsTimerActive(true);
      handleAction('win');
    }, 3000);
  };

  const finishGame = async (winner: 'CITIZENS' | 'SPIES') => {
    setIsTimerActive(false);
    handleAction(winner === 'SPIES' ? 'spy' : 'win');
    
    const winners = players.filter(p => (winner === 'CITIZENS' ? (p.role !== 'SPY') : p.role === 'SPY'));
    for (const p of winners) {
      updateScore(p.name, 1);

      // Check for achievements
      const achievementsToGrant = ['FIRST_WIN'];
      
      if (winner === 'CITIZENS') {
        if (p.role === 'DETECTIVE') achievementsToGrant.push('DETECTIVE_PRO');
        if (p.role === 'CITIZEN') achievementsToGrant.push('SHARP_EYE');
      } else {
        achievementsToGrant.push('SPY_MASTER');
        achievementsToGrant.push('SILVER_TONGUE');
      }

      if (p.role === 'INSIDER' && winner === 'CITIZENS') {
        achievementsToGrant.push('INSIDER_HERO');
      }

      for (const achId of achievementsToGrant) {
        addAchievement(p.name, achId);
      }
    }

    // Add to history
    addToHistory({
      date: new Date().toLocaleString('fa-IR'),
      players: players,
      spy_count: spyCount,
      winner: winner === 'CITIZENS' ? 'شهروندان' : 'جاسوس‌ها',
      difficulty: difficulty === 'EASY' ? 'آسان' : 'سخت',
      word: currentWord,
      special_roles: (detectiveEnabled || insiderEnabled) ? 'فعال' : 'غیرفعال'
    });

    fetchScores();
    fetchHistory();
    setGameState('END');
  };

  const resetScores = () => {
    handleAction('click');
    setLocalData('spygame_scores', []);
    fetchScores();
  };

  const resetHistory = () => {
    handleAction('click');
    setLocalData('spygame_history', []);
    fetchHistory();
  };

  const addPlayer = () => {
    if (newPlayerName.trim()) {
      setPlayerNames([...playerNames, newPlayerName.trim()]);
      setNewPlayerName('');
      handleAction('click');
    }
  };

  const removePlayer = (index: number) => {
    if (playerNames.length > 3) {
      setPlayerNames(playerNames.filter((_, i) => i !== index));
      handleAction('click');
    } else {
      handleAction('error');
    }
  };

  const renderWheel = () => (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 space-y-8">
      <h2 className="text-3xl font-bold text-white">کی شروع کنه؟</h2>
      
      <div className="relative w-64 h-64">
        <motion.div 
          animate={isWheelSpinning ? { rotate: 3600 } : { rotate: 0 }}
          transition={isWheelSpinning ? { duration: 3, ease: "easeOut" } : { duration: 0 }}
          className="w-full h-full rounded-full border-8 border-indigo-500/30 relative flex items-center justify-center overflow-hidden"
          style={{ background: 'conic-gradient(from 0deg, #4f46e5, #1e1b4b, #4f46e5)' }}
        >
          <Zap className="w-12 h-12 text-amber-400 animate-pulse" />
        </motion.div>
        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-2 w-4 h-8 bg-rose-500 rounded-full z-20" />
      </div>

      <AnimatePresence>
        {!isWheelSpinning && starterPlayer && (
          <motion.div 
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-center space-y-4"
          >
            <div className="text-2xl font-bold text-indigo-400">{starterPlayer.name}</div>
            <p className="text-slate-400">اولین سوال رو بپرس!</p>
            <button onClick={() => setGameState('PLAYING')} className="btn-primary">بزن بریم</button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

  const [selectedPlayerForAch, setSelectedPlayerForAch] = useState<string | null>(null);
  const [playerAchievements, setPlayerAchievements] = useState<string[]>([]);

  const renderAchievements = () => (
    <div className="flex flex-col min-h-screen p-6 space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={() => { setGameState('MENU'); setSelectedPlayerForAch(null); }} className="p-2 rounded-xl bg-slate-800"><ChevronLeft /></button>
        <h2 className="text-2xl font-bold">دستاوردها و مدال‌ها</h2>
      </div>

      {!selectedPlayerForAch ? (
        <div className="space-y-4">
          <p className="text-slate-400 text-sm">یک بازیکن را انتخاب کنید:</p>
          <div className="grid grid-cols-1 gap-2">
            {playerNames.map((name, i) => (
              <button 
                key={i} 
                onClick={() => {
                  setSelectedPlayerForAch(name);
                  fetchPlayerAchievements(name);
                  handleAction('click');
                }}
                className="glass p-4 rounded-2xl flex items-center justify-between hover:bg-white/5 transition-all"
              >
                <div className="flex items-center gap-3">
                  <User className="text-indigo-400" />
                  <span className="font-bold">{name}</span>
                </div>
                <Medal className="w-5 h-5 text-slate-600" />
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex items-center justify-between bg-indigo-600/20 p-4 rounded-2xl border border-indigo-500/30">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-indigo-600 rounded-full flex items-center justify-center font-bold text-xl">
                {selectedPlayerForAch[0]}
              </div>
              <div>
                <div className="font-bold text-lg">{selectedPlayerForAch}</div>
                <div className="text-xs text-indigo-300">{playerAchievements.length} دستاورد کسب شده</div>
              </div>
            </div>
            <button onClick={() => setSelectedPlayerForAch(null)} className="text-xs bg-slate-800 px-3 py-1 rounded-lg">تغییر بازیکن</button>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {ACHIEVEMENTS_LIST.map((ach) => {
              const isEarned = playerAchievements.includes(ach.id);
              return (
                <div key={ach.id} className={`glass p-4 rounded-2xl flex items-center gap-4 transition-all ${isEarned ? 'border-indigo-500/50 bg-indigo-500/5' : 'opacity-50 grayscale'}`}>
                  <div className={`p-3 rounded-xl ${isEarned ? 'bg-indigo-600/20' : 'bg-slate-800'}`}>
                    {ach.icon}
                  </div>
                  <div className="flex-1">
                    <div className="font-bold text-white">{ach.title}</div>
                    <div className="text-xs text-slate-400">{ach.description}</div>
                  </div>
                  {isEarned ? (
                    <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                  ) : (
                    <Lock className="w-5 h-5 text-slate-700" />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );

  const startVoting = () => {
    setIsTimerActive(false);
    setVotingIndex(0);
    setVotes({});
    setGameState('VOTING');
    handleAction('click');
  };

  const submitVote = (targetIds: number[]) => {
    const newVotes = { ...votes, [players[votingIndex].id]: targetIds };
    setVotes(newVotes);
    handleAction('click');
    
    if (votingIndex < players.length - 1) {
      setVotingIndex(votingIndex + 1);
    } else {
      // Voting finished
      setGameState('END');
    }
  };

  const renderVoting = () => (
    <VotingScreen 
      players={players}
      votingIndex={votingIndex}
      spyCount={spyCount}
      submitVote={submitVote}
      handleAction={handleAction}
    />
  );

  const renderStats = () => {
    // Calculate stats from history
    const stats: Record<string, { wins: number, total: number, roles: Record<string, number> }> = {};
    
    history.forEach(item => {
      const gamePlayers = JSON.parse(item.players);
      gamePlayers.forEach((p: any) => {
        if (!stats[p.name]) stats[p.name] = { wins: 0, total: 0, roles: {} };
        stats[p.name].total++;
        stats[p.name].roles[p.role] = (stats[p.name].roles[p.role] || 0) + 1;
        
        const isWinner = (item.winner === 'شهروندان' && p.role !== 'SPY') || (item.winner === 'جاسوس‌ها' && p.role === 'SPY');
        if (isWinner) stats[p.name].wins++;
      });
    });

    return (
      <div className="flex flex-col min-h-screen p-6 space-y-6">
        <div className="flex items-center gap-4">
          <button onClick={() => setGameState('MENU')} className="p-2 rounded-xl bg-slate-800"><ChevronLeft /></button>
          <h2 className="text-2xl font-bold">نمودار پیشرفت</h2>
        </div>

        <div className="space-y-4">
          {Object.entries(stats).map(([name, data]) => {
            const winRate = Math.round((data.wins / data.total) * 100);
            return (
              <div key={name} className="glass p-4 rounded-2xl space-y-3">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-lg">{name}</span>
                  <span className="text-indigo-400 font-mono">{winRate}% پیروزی</span>
                </div>
                <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${winRate}%` }}
                    className="h-full bg-indigo-500"
                  />
                </div>
                <div className="flex gap-4 text-[10px] text-slate-500 uppercase tracking-wider">
                  <span>بازی‌ها: {data.total}</span>
                  <span>بردها: {data.wins}</span>
                </div>
              </div>
            );
          })}
          {Object.keys(stats).length === 0 && (
            <div className="text-center text-slate-500 py-10">هنوز دیتایی ثبت نشده است.</div>
          )}
        </div>
      </div>
    );
  };

  const renderMenu = () => (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 pb-32 space-y-12 transition-colors duration-500 bg-[#050505] relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-full opacity-20 pointer-events-none" 
           style={{ backgroundImage: 'radial-gradient(circle at 50% 50%, #7000ff 0%, transparent 50%)' }} />
      
      <motion.div 
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="text-center relative z-10"
      >
        <div className="relative inline-block mb-6">
          <div className="absolute inset-0 bg-brand-primary blur-3xl opacity-20 animate-pulse" />
          <Shield className="w-32 h-32 text-brand-primary relative z-10" />
          <div className="scanner-line" />
        </div>
        <h1 className="text-4xl font-black tracking-tighter text-white mb-2 italic">بازی حرفه ای جاسوس</h1>
        <div className="h-1 w-24 bg-brand-primary mx-auto rounded-full mb-4" />
        <p className="text-slate-500 uppercase tracking-[0.3em] text-xs font-bold">Tactical Intelligence Game</p>
      </motion.div>

      <div className="grid grid-cols-1 gap-3 w-full max-w-xs relative z-10">
        <button onClick={() => setGameState('SETUP')} className="btn-primary group">
          <span className="flex items-center justify-center gap-2">
            <Play className="w-5 h-5 fill-current" /> شروع عملیات
          </span>
        </button>
        
        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => setGameState('SCOREBOARD')} className="btn-secondary flex flex-col items-center gap-1 py-4">
            <Trophy className="w-5 h-5 text-amber-400" />
            <span className="text-[10px] uppercase font-bold">امتیازات</span>
          </button>
          <button onClick={() => setGameState('ACHIEVEMENTS')} className="btn-secondary flex flex-col items-center gap-1 py-4">
            <Medal className="w-5 h-5 text-brand-primary" />
            <span className="text-[10px] uppercase font-bold">دستاوردها</span>
          </button>
        </div>

        <button onClick={() => setGameState('STATS')} className="btn-secondary flex items-center justify-center gap-2 py-4">
          <Zap className="w-4 h-4 text-yellow-400" />
          <span className="text-xs font-bold">آنالیز پیشرفت</span>
        </button>

        <div className="flex gap-2">
          <button onClick={() => setGameState('CUSTOM_CATEGORIES')} className="flex-1 btn-secondary py-3">
            <ListPlus className="w-4 h-4 mx-auto" />
          </button>
          <button onClick={() => setGameState('HOW_TO_PLAY')} className="flex-1 btn-secondary py-3">
            <Info className="w-4 h-4 mx-auto" />
          </button>
          <button onClick={() => setGameState('ADMIN_LOGIN')} className="flex-1 btn-secondary py-3">
            <History className="w-4 h-4 mx-auto" />
          </button>
        </div>
      </div>

      <button onClick={() => setSoundEnabled(!soundEnabled)} className="p-4 rounded-full glass text-slate-400 hover:text-brand-primary transition-colors">
        {soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
      </button>
    </div>
  );

  const renderSetup = () => (
    <div className="flex flex-col min-h-screen p-6 space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={() => setGameState('MENU')} className="p-2 rounded-xl bg-slate-800"><ChevronLeft /></button>
        <h2 className="text-2xl font-bold">تنظیمات بازی</h2>
      </div>

      <div className="glass p-6 rounded-3xl space-y-6">
        <div>
          <label className="block text-sm text-slate-400 mb-2">منبع کلمات</label>
          <div className="grid grid-cols-1 gap-2">
            <select 
              className="input-field w-full"
              value={selectedCategory}
              onChange={(e) => {
                setSelectedCategory(e.target.value);
                handleAction('click');
              }}
            >
              <option value="DEFAULT_EASY">پیش‌فرض - آسان</option>
              <option value="DEFAULT_HARD">پیش‌فرض - سخت</option>
              {customCategories.map((cat, i) => (
                <option key={i} value={`CUSTOM_${i}`}>{cat.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4">
          <div>
            <label className="block text-sm text-slate-400 mb-2">زمان بازی (دقیقه)</label>
            <div className="flex items-center justify-between bg-slate-800 p-2 rounded-xl">
              <button onClick={() => { setGameTimer(Math.max(60, gameTimer - 60)); handleAction('click'); }} className="p-2"><Minus /></button>
              <span className="font-bold text-xl">{gameTimer / 60}</span>
              <button onClick={() => { setGameTimer(Math.min(600, gameTimer + 60)); handleAction('click'); }} className="p-2"><Plus /></button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-slate-400 mb-2">نقش کارآگاه</label>
            <button 
              onClick={() => { setDetectiveEnabled(!detectiveEnabled); handleAction('click'); }}
              className={`w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${detectiveEnabled ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'bg-slate-800 text-slate-400'}`}
            >
              <Target className="w-4 h-4" /> {detectiveEnabled ? 'فعال' : 'غیرفعال'}
            </button>
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-2">نقش نفوذی</label>
            <button 
              onClick={() => { setInsiderEnabled(!insiderEnabled); handleAction('click'); }}
              className={`w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${insiderEnabled ? 'bg-amber-600 text-white shadow-lg shadow-amber-500/20' : 'bg-slate-800 text-slate-400'}`}
            >
              <Eye className="w-4 h-4" /> {insiderEnabled ? 'فعال' : 'غیرفعال'}
            </button>
          </div>
        </div>

        <div>
          <label className="block text-sm text-slate-400 mb-2">تعداد جاسوس‌ها</label>
          <div className="flex items-center justify-between bg-slate-800 p-2 rounded-xl">
            <button onClick={() => { setSpyCount(Math.max(1, spyCount - 1)); handleAction('click'); }} className="p-2"><Minus /></button>
            <span className="text-xl font-bold">{spyCount}</span>
            <button onClick={() => { setSpyCount(Math.min(playerNames.length - 2, spyCount + 1)); handleAction('click'); }} className="p-2"><Plus /></button>
          </div>
        </div>

        <div>
          <label className="block text-sm text-slate-400 mb-2">بازیکنان و آواتارها ({playerNames.length})</label>
          <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
            {playerNames.map((name, i) => (
              <div key={i} className="flex items-center gap-2 bg-slate-800/50 p-2 rounded-2xl border border-slate-700/50">
                <button 
                  onClick={() => {
                    const currentEmoji = playerAvatars[name] || EMOJIS[i % EMOJIS.length];
                    const nextIdx = (EMOJIS.indexOf(currentEmoji) + 1) % EMOJIS.length;
                    setPlayerAvatars({ ...playerAvatars, [name]: EMOJIS[nextIdx] });
                    handleAction('click');
                  }}
                  className="w-10 h-10 bg-slate-700 rounded-xl flex items-center justify-center text-xl hover:bg-slate-600 transition-all"
                >
                  {playerAvatars[name] || EMOJIS[i % EMOJIS.length]}
                </button>
                <span className="flex-1 font-bold px-2">{name}</span>
                <button onClick={() => removePlayer(i)} className="p-2 text-rose-500 hover:bg-rose-500/10 rounded-xl transition-all"><Trash2 className="w-4 h-4" /></button>
              </div>
            ))}
          </div>
          <div className="flex gap-2 mt-4">
            <input 
              type="text" 
              value={newPlayerName}
              onChange={(e) => setNewPlayerName(e.target.value)}
              placeholder="نام بازیکن جدید..."
              className="input-field flex-1"
            />
            <button onClick={addPlayer} className="p-3 bg-indigo-600 rounded-xl"><Plus /></button>
          </div>
        </div>
      </div>

      <button onClick={startGame} className="btn-primary w-full py-4 text-xl">
        شروع ماموریت
      </button>
    </div>
  );

  const nextReveal = () => {
    handleAction('click');
    if (revealIndex < players.length - 1) {
      setRevealIndex(revealIndex + 1);
      setIsRoleVisible(false);
    } else {
      startWheel();
    }
  };

  const renderReveal = () => {
    const currentPlayer = players[revealIndex];
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 space-y-6">
        <div className="text-center space-y-2">
          <h2 className="text-3xl font-black text-white uppercase tracking-tighter italic">نوبت بازیکن</h2>
          <div className="flex items-center justify-center gap-3">
            <span className="text-4xl">{currentPlayer.avatar}</span>
            <span className="text-2xl font-bold text-brand-primary">{currentPlayer.name}</span>
          </div>
        </div>

        <motion.div 
          layout
          className="w-full max-w-sm glass rounded-[2.5rem] flex flex-col items-center p-6 text-center relative overflow-y-auto max-h-[70vh]"
        >
          <AnimatePresence mode="wait">
            {!isRoleVisible ? (
              <motion.div 
                key="hidden"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center gap-6 py-12"
              >
                <div className="relative">
                  <Lock className="w-24 h-24 text-slate-700" />
                  <div className="scanner-line" />
                </div>
                <button 
                  onClick={() => { setIsRoleVisible(true); handleAction('reveal'); }}
                  className="btn-primary"
                >
                  مشاهده نقش امنیتی
                </button>
              </motion.div>
            ) : (
              <motion.div 
                key="visible"
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="flex flex-col items-center gap-4 w-full"
              >
                {currentPlayer.role === 'SPY' ? (
                  <>
                    <Shield className="w-16 h-16 text-rose-500" />
                    <h3 className="text-xl font-bold text-slate-400">نقش شما:</h3>
                    <h3 className="text-4xl font-black text-rose-500">جاسوس</h3>
                    <InteractiveMap isSpy={true} mapZones={mapZones} />
                    <p className="text-slate-400 text-xs">هویت خود را مخفی نگه دارید و مکان را حدس بزنید.</p>
                  </>
                ) : currentPlayer.role === 'DETECTIVE' ? (
                  <>
                    <Target className="w-16 h-16 text-indigo-500" />
                    <h3 className="text-xl font-bold text-slate-400">مکان عملیات:</h3>
                    <h3 className="text-4xl font-black text-indigo-500">{currentWord}</h3>
                    <InteractiveMap isSpy={false} mapZones={mapZones} />
                    <p className="text-indigo-400 font-bold text-xs">شما کارآگاه هستید!</p>
                  </>
                ) : currentPlayer.role === 'INSIDER' ? (
                  <>
                    <Eye className="w-16 h-16 text-amber-500" />
                    <h3 className="text-xl font-bold text-slate-400">نقش شما:</h3>
                    <h3 className="text-4xl font-black text-amber-500">نفوذی</h3>
                    <InteractiveMap isSpy={true} mapZones={mapZones} />
                    <p className="text-slate-400 text-xs">شما مکان را نمی‌دانید اما جاسوس‌ها را می‌شناسید!</p>
                    <div className="bg-amber-500/10 p-3 rounded-xl border border-amber-500/20 w-full">
                      <p className="text-amber-400 font-bold text-xs mb-1">لیست جاسوس‌ها:</p>
                      <div className="flex flex-wrap justify-center gap-2">
                        {players.filter(p => p.role === 'SPY').map(p => (
                          <span key={p.id} className="bg-slate-800 px-2 py-1 rounded text-[10px]">{p.name}</span>
                        ))}
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <Users className="w-16 h-16 text-emerald-500" />
                    <h3 className="text-xl font-bold text-slate-400">مکان عملیات:</h3>
                    <h3 className="text-4xl font-black text-emerald-500">{currentWord}</h3>
                    <InteractiveMap isSpy={false} mapZones={mapZones} />
                    <p className="text-slate-400 text-xs">جاسوس را شناسایی کنید!</p>
                  </>
                )}
                
                <button 
                  onClick={nextReveal}
                  className="btn-secondary w-full mt-2"
                >
                  تایید و نفر بعدی
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        <div className="flex gap-2">
          {players.map((_, i) => (
            <div key={i} className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${i === revealIndex ? 'bg-brand-primary w-6' : i < revealIndex ? 'bg-emerald-500' : 'bg-slate-800'}`} />
          ))}
        </div>
      </div>
    );
  };

  const renderPlaying = () => (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 space-y-8">
      <div className="text-center space-y-4">
        <div className={`w-24 h-24 rounded-full flex items-center justify-center mx-auto border-4 ${timeLeft < 30 ? 'border-rose-500 animate-pulse' : 'border-indigo-500'}`}>
          <span className={`text-2xl font-mono font-bold ${timeLeft < 30 ? 'text-rose-500' : 'text-white'}`}>
            {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
          </span>
        </div>
        <h2 className="text-2xl font-bold">زمان باقی‌مانده</h2>
      </div>

      <div className="glass p-6 rounded-3xl w-full max-w-xs space-y-4">
        <div className="flex justify-between items-center text-sm">
          <span className="text-slate-400">شروع‌کننده:</span>
          <span className="font-bold text-indigo-400">{starterPlayer?.name}</span>
        </div>
        <div className="flex justify-between items-center text-sm">
          <span className="text-slate-400">تعداد جاسوس‌ها:</span>
          <span className="font-bold text-rose-500">{spyCount}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 w-full max-w-xs">
        <p className="text-center text-slate-400 text-xs">بعد از پایان بحث، وارد مرحله رای‌گیری شوید:</p>
        <button onClick={startVoting} className="btn-primary flex items-center justify-center gap-2">
          <CheckCircle2 /> شروع رای‌گیری
        </button>
        <div className="flex gap-4">
          <button onClick={() => finishGame('CITIZENS')} className="flex-1 btn-secondary bg-emerald-600/20 text-emerald-400 border-emerald-500/30 py-4">
            برد شهروند
          </button>
          <button onClick={() => finishGame('SPIES')} className="flex-1 btn-secondary bg-rose-600/20 text-rose-400 border-rose-500/30 py-4">
            برد جاسوس
          </button>
        </div>
      </div>
    </div>
  );

  const recordResult = async (winner: 'شهروندان' | 'جاسوس‌ها') => {
    handleAction('win');
    const date = new Date().toLocaleString('fa-IR');
    
    try {
      // Update scores
      for (const p of players) {
        let increment = 0;
        if (winner === 'شهروندان' && p.role !== 'SPY') {
          increment = 10;
          if (p.role === 'DETECTIVE') increment = 15;
        } else if (winner === 'جاسوس‌ها' && p.role === 'SPY') {
          increment = 20;
        }
        
        if (increment > 0) {
          updateScore(p.name, increment);
        }
      }

      // Add to history
      addToHistory({
        date,
        players,
        spy_count: spyCount,
        winner,
        difficulty: selectedCategory,
        word: currentWord,
        special_roles: { detective: detectiveEnabled, insider: insiderEnabled }
      });

      fetchHistory();
      fetchScores();
      setGameState('MENU');
    } catch (e) {
      console.error(e);
      setGameState('MENU');
    }
  };

  const renderEnd = () => {
    // Calculate vote counts
    const voteCounts: Record<number, number> = {};
    Object.values(votes).forEach(vList => {
      (vList as unknown as number[]).forEach(v => {
        voteCounts[v] = (voteCounts[v] || 0) + 1;
      });
    });

    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 pb-32 space-y-8">
        <h2 className="text-4xl font-black text-white">پایان بازی</h2>
        
        {Object.keys(votes).length > 0 && (
          <div className="glass p-6 rounded-3xl w-full max-w-xs space-y-4">
            <h3 className="text-center font-bold text-indigo-400 border-b border-slate-700 pb-2">نتایج رای‌گیری</h3>
            <div className="space-y-2">
              {players.map(p => (
                <div key={p.id} className="flex justify-between items-center text-sm">
                  <div className="flex items-center gap-2">
                    <span>{p.avatar}</span>
                    <span>{p.name}</span>
                  </div>
                  <span className="font-mono bg-slate-800 px-2 py-1 rounded">{voteCounts[p.id] || 0} رای</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="glass p-6 rounded-3xl w-full max-w-xs space-y-4">
        <div className="text-center mb-4">
          <p className="text-slate-400 text-sm">مکان این دور:</p>
          <p className="text-2xl font-bold text-indigo-400">{currentWord}</p>
        </div>
        <div className="space-y-2">
          {players.map((p, i) => (
            <div key={i} className="flex justify-between items-center p-2 rounded-lg bg-slate-800/50">
              <span>{p.name}</span>
              <span className={`text-xs font-bold px-2 py-1 rounded ${
                p.role === 'SPY' ? 'bg-rose-500/20 text-rose-500' : 
                p.role === 'DETECTIVE' ? 'bg-indigo-500/20 text-indigo-500' :
                p.role === 'INSIDER' ? 'bg-amber-500/20 text-amber-500' :
                'bg-emerald-500/20 text-emerald-500'
              }`}>
                {p.role === 'SPY' ? 'جاسوس' : p.role === 'DETECTIVE' ? 'کارآگاه' : p.role === 'INSIDER' ? 'نفوذی' : 'شهروند'}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 w-full max-w-xs">
        <button onClick={() => recordResult('شهروندان')} className="btn-secondary border-emerald-500/30 text-emerald-400 flex flex-col items-center gap-2 py-6">
          <Users className="w-8 h-8" />
          <span className="font-bold">برد شهروندان</span>
        </button>
        <button onClick={() => recordResult('جاسوس‌ها')} className="btn-secondary border-rose-500/30 text-rose-400 flex flex-col items-center gap-2 py-6">
          <Shield className="w-8 h-8" />
          <span className="font-bold">برد جاسوس‌ها</span>
        </button>
      </div>

      <button onClick={() => setGameState('MENU')} className="text-slate-500 text-sm hover:text-white transition-colors">
        انصراف و بازگشت به منو
      </button>
    </div>
    );
  };

  const renderScoreboard = () => (
    <div className="flex flex-col min-h-screen p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => setGameState('MENU')} className="p-2 rounded-xl bg-slate-800"><ChevronLeft /></button>
          <h2 className="text-2xl font-bold">جدول امتیازات</h2>
        </div>
        <button onClick={resetScores} className="text-rose-500 p-2"><RotateCcw className="w-5 h-5" /></button>
      </div>

      <div className="glass rounded-3xl overflow-hidden">
        {scores.length > 0 ? (
          <table className="w-full text-right">
            <thead className="bg-slate-800/50 text-slate-400 text-sm">
              <tr>
                <th className="p-4">رتبه</th>
                <th className="p-4">نام بازیکن</th>
                <th className="p-4">امتیاز</th>
              </tr>
            </thead>
            <tbody>
              {scores.map((s, i) => (
                <tr key={i} className="border-t border-slate-700/50">
                  <td className="p-4 font-mono">{i + 1}</td>
                  <td className="p-4 font-bold">{s.player_name}</td>
                  <td className="p-4 text-indigo-400 font-bold">{s.score}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="p-12 text-center text-slate-500">هنوز امتیازی ثبت نشده است.</div>
        )}
      </div>
    </div>
  );

  const renderAdminLogin = () => (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 space-y-6">
      <div className="text-center space-y-2">
        <Lock className="w-16 h-16 text-indigo-500 mx-auto mb-4" />
        <h2 className="text-2xl font-bold">ورود مدیر</h2>
        <p className="text-slate-400">برای مشاهده تاریخچه رمز عبور را وارد کنید</p>
      </div>
      
      <div className="w-full max-w-xs space-y-4">
        <input 
          type="password" 
          value={adminPassword}
          onChange={(e) => setAdminPassword(e.target.value)}
          placeholder="رمز عبور..."
          className="input-field w-full"
        />
        <button 
          onClick={() => {
            if (adminPassword === 'owa12345') {
              setGameState('HISTORY');
              handleAction('click');
            } else {
              handleAction('error');
              alert('رمز عبور اشتباه است');
            }
          }}
          className="btn-primary w-full"
        >
          ورود
        </button>
        <button onClick={() => setGameState('MENU')} className="btn-secondary w-full">انصراف</button>
      </div>
    </div>
  );

  const renderHistory = () => (
    <div className="flex flex-col min-h-screen p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => setGameState('MENU')} className="p-2 rounded-xl bg-slate-800"><ChevronLeft /></button>
          <h2 className="text-2xl font-bold">تاریخچه بازی‌ها</h2>
        </div>
        <button onClick={resetHistory} className="text-rose-500 p-2"><Trash2 className="w-5 h-5" /></button>
      </div>

      <div className="space-y-4 overflow-y-auto max-h-[80vh]">
        {history.length > 0 ? (
          history.map((item) => (
            <div key={item.id} className="glass p-4 rounded-2xl space-y-2 text-sm">
              <div className="flex justify-between text-slate-400">
                <span>{item.date}</span>
                <span className="bg-indigo-500/20 text-indigo-400 px-2 py-0.5 rounded">{item.difficulty}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-bold text-lg">{item.word}</span>
                <span className={`font-bold ${item.winner === 'جاسوس‌ها' ? 'text-rose-500' : 'text-emerald-500'}`}>برنده: {item.winner}</span>
              </div>
              <div className="text-slate-500 text-xs mt-2 border-t border-slate-700/30 pt-2">
                <div className="grid grid-cols-2 gap-1">
                  {JSON.parse(item.players).map((p: any, idx: number) => (
                    <div key={idx} className="flex justify-between">
                      <span>{p.name}</span>
                      <span className={
                        p.role === 'SPY' ? 'text-rose-400' : 
                        p.role === 'DETECTIVE' ? 'text-indigo-400' :
                        p.role === 'INSIDER' ? 'text-amber-400' :
                        'text-emerald-400'
                      }>
                        {p.role === 'SPY' ? '(جاسوس)' : p.role === 'DETECTIVE' ? '(کارآگاه)' : p.role === 'INSIDER' ? '(نفوذی)' : '(شهروند)'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="p-12 text-center text-slate-500">تاریخچه‌ای یافت نشد.</div>
        )}
      </div>
    </div>
  );

  const renderHowToPlay = () => (
    <div className="flex flex-col min-h-screen p-6 space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={() => setGameState('MENU')} className="p-2 rounded-xl bg-slate-800"><ChevronLeft /></button>
        <h2 className="text-2xl font-bold">راهنمای بازی</h2>
      </div>

      <div className="glass p-6 rounded-3xl space-y-6 text-slate-300 leading-relaxed">
        <section>
          <h3 className="text-indigo-400 font-bold mb-2">هدف بازی</h3>
          <p>شهروندان باید با پرسیدن سوالات هوشمندانه، جاسوس را پیدا کنند. جاسوس باید سعی کند لو نرود و مکان بازی را حدس بزند.</p>
        </section>
        
        <section>
          <h3 className="text-indigo-400 font-bold mb-2">روند بازی</h3>
          <ul className="list-disc list-inside space-y-2">
            <li>در ابتدا به هر بازیکن نامی داده می‌شود.</li>
            <li>هر بازیکن به نوبت نقش خود را می‌بیند و تایید می‌کند که دیده است.</li>
            <li>شهروندان مکان را می‌بینند اما جاسوس فقط کلمه "جاسوس" را می‌بیند.</li>
            <li>بازیکنان از هم سوال می‌پرسند. سوالات نباید خیلی مستقیم باشند که جاسوس مکان را بفهمد.</li>
          </ul>
        </section>

        <section>
          <h3 className="text-indigo-400 font-bold mb-2">قوانین</h3>
          <p>اگر شهروندان جاسوس را درست حدس بزنند، برنده می‌شوند. اگر جاسوس مکان را درست حدس بزند یا شهروندان اشتباه حدس بزنند، جاسوس برنده می‌شود.</p>
        </section>

        <section className="bg-slate-800/50 p-4 rounded-2xl">
          <h3 className="text-emerald-400 font-bold mb-2 flex items-center gap-2">
            <Target className="w-4 h-4" /> نکات بازی حضوری (Pro Tips)
          </h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            ۱. همیشه به زبان بدن بازیکنان دقت کنید؛ جاسوس‌ها معمولاً سوالات کلی می‌پرسند.<br/>
            ۲. اگر کارآگاه هستید، سوالاتی بپرسید که فقط کسی که مکان را می‌داند متوجه شود.<br/>
            ۳. نفوذی باید خیلی ظریف به شهروندان علامت بدهد تا جاسوس او را شناسایی نکند.
          </p>
        </section>
      </div>
    </div>
  );

  return (
    <div className="max-w-md mx-auto bg-slate-950 min-h-screen shadow-2xl relative overflow-hidden pb-24">
      <AnimatePresence mode="wait">
        <motion.div
          key={gameState}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2 }}
        >
          {gameState === 'MENU' && renderMenu()}
          {gameState === 'SETUP' && renderSetup()}
          {gameState === 'REVEAL' && renderReveal()}
          {gameState === 'PLAYING' && renderPlaying()}
          {gameState === 'END' && renderEnd()}
          {gameState === 'SCOREBOARD' && renderScoreboard()}
          {gameState === 'ADMIN_LOGIN' && renderAdminLogin()}
          {gameState === 'HISTORY' && renderHistory()}
          {gameState === 'HOW_TO_PLAY' && renderHowToPlay()}
          {gameState === 'CUSTOM_CATEGORIES' && renderCustomCategories()}
          {gameState === 'WHEEL' && renderWheel()}
          {gameState === 'ACHIEVEMENTS' && renderAchievements()}
          {gameState === 'VOTING' && renderVoting()}
          {gameState === 'STATS' && renderStats()}
        </motion.div>
      </AnimatePresence>
      
      <div className="absolute bottom-4 left-0 w-full text-center pointer-events-none z-50">
        <p className="text-[10px] font-bold tracking-[0.2em] text-brand-primary/60 uppercase animate-blink">
          طراحی شده توسط OwaAmin
        </p>
      </div>
    </div>
  );
}
