import React, { useState, useMemo, useEffect } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  X,
  CheckSquare,
  Gift,
  Heart,
  Sparkles,
  Flag,
  Circle,
  CheckCircle2,
  Trash2,
  Clock,
} from 'lucide-react';
import { TodoItem, Priority, TaskStatus } from '../types';
import { Sound } from '../utils/audio';

export interface CalendarCustomEvent {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  type: 'birthday' | 'anniversary' | 'holiday' | 'event' | 'reminder';
  icon?: string;
  description?: string;
}

// Indian Gazetted and Celebrated Holidays for all months
export interface IndianHoliday {
  name: string;
  month: number; // 0-indexed (0 = Jan, 11 = Dec)
  day: number;
  type: 'national' | 'gazetted' | 'festival' | 'observance';
  emoji: string;
  description?: string;
}

export const INDIAN_HOLIDAYS_LIST: IndianHoliday[] = [
  // January
  { name: "New Year's Day", month: 0, day: 1, type: 'observance', emoji: '🎉', description: 'Global New Year celebration' },
  { name: 'Guru Gobind Singh Jayanti', month: 0, day: 5, type: 'gazetted', emoji: 'ੴ', description: 'Sikh festival' },
  { name: 'Makar Sankranti / Pongal / Lohri', month: 0, day: 14, type: 'festival', emoji: '🪁', description: 'Harvest festival & Uttarayan' },
  { name: 'Republic Day', month: 0, day: 26, type: 'national', emoji: '🇮🇳', description: 'Constitution of India came into effect' },
  // February
  { name: 'Vasant Panchami / Saraswati Puja', month: 1, day: 2, type: 'festival', emoji: '🌼', description: 'Worship of knowledge and art' },
  { name: 'Maha Shivratri', month: 1, day: 15, type: 'festival', emoji: '🔱', description: 'Great Night of Shiva' },
  // March
  { name: 'Holi (Dhulandi)', month: 2, day: 4, type: 'festival', emoji: '🎨', description: 'Festival of colors and spring' },
  { name: 'Eid-ul-Fitr', month: 2, day: 20, type: 'gazetted', emoji: '🌙', description: 'Islamic festival of joy and charity' },
  { name: 'Rama Navami', month: 2, day: 27, type: 'festival', emoji: '🏹', description: 'Birth of Lord Rama' },
  { name: 'Mahavir Jayanti', month: 2, day: 31, type: 'gazetted', emoji: '🌸', description: 'Jain festival' },
  // April
  { name: 'Good Friday', month: 3, day: 3, type: 'gazetted', emoji: '✝️', description: 'Christian remembrance' },
  { name: 'Easter Sunday', month: 3, day: 5, type: 'observance', emoji: '🐣', description: 'Resurrection Sunday' },
  { name: 'B.R. Ambedkar Jayanti', month: 3, day: 14, type: 'national', emoji: '⚖️', description: 'Architect of Indian Constitution' },
  { name: 'Baisakhi / Tamil New Year / Vishu', month: 3, day: 14, type: 'festival', emoji: '🌾', description: 'Solar New Year across India' },
  // May
  { name: 'Maharashtra Day / Gujarat Day', month: 4, day: 1, type: 'observance', emoji: '🚩', description: 'State formation day' },
  { name: 'Buddha Purnima', month: 4, day: 1, type: 'gazetted', emoji: '☸️', description: 'Birth of Gautama Buddha' },
  { name: 'Eid-ul-Adha (Bakrid)', month: 4, day: 27, type: 'gazetted', emoji: '🕌', description: 'Feast of the Sacrifice' },
  // June
  { name: 'Kabir Jayanti', month: 5, day: 20, type: 'observance', emoji: '📜', description: 'Sant Kabir Jayanti' },
  { name: 'International Yoga Day', month: 5, day: 21, type: 'observance', emoji: '🧘', description: 'Celebration of holistic wellness' },
  { name: 'Muharram / Ashura', month: 5, day: 26, type: 'gazetted', emoji: '🤲', description: 'Islamic New Year observance' },
  // July
  { name: 'Rath Yatra (Puri)', month: 6, day: 16, type: 'festival', emoji: '🛕', description: 'Chariot Festival of Jagannath' },
  { name: 'Guru Purnima', month: 6, day: 29, type: 'observance', emoji: '🌕', description: 'Honoring spiritual teachers' },
  // August
  { name: 'Independence Day', month: 7, day: 15, type: 'national', emoji: '🇮🇳', description: '79th Indian Independence Day' },
  { name: 'Raksha Bandhan', month: 7, day: 28, type: 'festival', emoji: '🧵', description: 'Celebration of sibling bonds' },
  // September
  { name: 'Krishna Janmashtami', month: 8, day: 4, type: 'festival', emoji: '🦚', description: 'Birth of Lord Krishna' },
  { name: 'Milad-un-Nabi (Id-e-Milad)', month: 8, day: 5, type: 'gazetted', emoji: '✨', description: 'Prophet Muhammad birthday' },
  { name: 'Ganesh Chaturthi', month: 8, day: 14, type: 'festival', emoji: '🐘', description: 'Vinayaka Chavithi' },
  // October
  { name: 'Mahatma Gandhi Jayanti', month: 9, day: 2, type: 'national', emoji: '👓', description: 'Father of the Nation birthday' },
  { name: 'Maha Navami / Durga Puja', month: 9, day: 19, type: 'festival', emoji: '🔱', description: 'Durga Puja festivities' },
  { name: 'Dussehra / Vijayadashami', month: 9, day: 20, type: 'gazetted', emoji: '🏹', description: 'Triumph of Good over Evil' },
  { name: 'Valmiki Jayanti', month: 9, day: 25, type: 'observance', emoji: '📖', description: 'Maharishi Valmiki Jayanti' },
  // November
  { name: 'Karwa Chauth', month: 10, day: 1, type: 'festival', emoji: '🌙', description: 'Fast for marital harmony' },
  { name: 'Diwali / Deepavali', month: 10, day: 8, type: 'festival', emoji: '🪔', description: 'Grand Festival of Lights' },
  { name: 'Govardhan Puja', month: 10, day: 9, type: 'festival', emoji: '🌄', description: 'Annakut festival' },
  { name: 'Bhai Dooj', month: 10, day: 10, type: 'festival', emoji: '🎁', description: 'Brother-Sister auspicious day' },
  { name: 'Chhath Puja', month: 10, day: 15, type: 'festival', emoji: '☀️', description: 'Sun God worship' },
  { name: 'Guru Nanak Jayanti (Gurpurab)', month: 10, day: 24, type: 'gazetted', emoji: 'ੴ', description: 'First Sikh Guru birthday' },
  // December
  { name: 'Christmas Eve', month: 11, day: 24, type: 'observance', emoji: '🌟', description: 'Christmas Eve celebration' },
  { name: 'Christmas Day', month: 11, day: 25, type: 'gazetted', emoji: '🎄', description: 'Birth of Jesus Christ' },
  { name: "New Year's Eve", month: 11, day: 31, type: 'observance', emoji: '🎆', description: 'Welcoming the new year' },
];

interface IndianCalendarWidgetProps {
  todos: TodoItem[];
  onAddTodo?: (title: string, priority: Priority, category: string, dueDate?: string, status?: TaskStatus) => void;
  onToggleTodo?: (id: string) => void;
  onNavigate?: (view: any, filter?: string) => void;
  soundEnabled: boolean;
}

export const IndianCalendarWidget: React.FC<IndianCalendarWidgetProps> = ({
  todos = [],
  onAddTodo,
  onToggleTodo,
  onNavigate,
  soundEnabled,
}) => {
  const today = useMemo(() => new Date(), []);
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  
  // Format today's YYYY-MM-DD
  const todayStr = useMemo(() => {
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }, [today]);

  const [selectedDateStr, setSelectedDateStr] = useState<string>(todayStr);

  // Custom user events (Birthdays, Anniversaries, custom events) stored in localStorage
  const [customEvents, setCustomEvents] = useState<CalendarCustomEvent[]>(() => {
    try {
      const saved = localStorage.getItem('personal_os_calendar_events');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const saveCustomEvents = (updated: CalendarCustomEvent[]) => {
    setCustomEvents(updated);
    localStorage.setItem('personal_os_calendar_events', JSON.stringify(updated));
  };

  // Add Item Modal states
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [itemType, setItemType] = useState<'task' | 'birthday' | 'anniversary' | 'event'>('task');
  const [itemTitle, setItemTitle] = useState('');
  const [itemPriority, setItemPriority] = useState<Priority>('medium');
  const [itemCategory, setItemCategory] = useState('Personal');
  const [activeTab, setActiveTab] = useState<'calendar' | 'holidays'>('calendar');

  // Month navigation
  const handlePrevMonth = () => {
    Sound.click(soundEnabled);
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((prev) => prev - 1);
    } else {
      setCurrentMonth((prev) => prev - 1);
    }
  };

  const handleNextMonth = () => {
    Sound.click(soundEnabled);
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((prev) => prev + 1);
    } else {
      setCurrentMonth((prev) => prev + 1);
    }
  };

  const handleJumpToToday = () => {
    Sound.click(soundEnabled);
    setCurrentYear(today.getFullYear());
    setCurrentMonth(today.getMonth());
    setSelectedDateStr(todayStr);
  };

  // Month Name
  const monthName = useMemo(() => {
    return new Date(currentYear, currentMonth, 1).toLocaleString('default', { month: 'long' });
  }, [currentYear, currentMonth]);

  // Generate Calendar Grid Days (Starts on Monday, Ends on Sunday)
  const calendarDays = useMemo(() => {
    // In JS getDay(): 0 = Sun, 1 = Mon, ..., 6 = Sat
    // To start on Monday: 0 = Mon, 1 = Tue, ..., 5 = Sat, 6 = Sun
    const rawFirstDay = new Date(currentYear, currentMonth, 1).getDay();
    const firstDayIndex = (rawFirstDay + 6) % 7;
    const totalDaysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const prevMonthDaysCount = new Date(currentYear, currentMonth, 0).getDate();

    const days: Array<{
      dayNum: number;
      isCurrentMonth: boolean;
      dateStr: string;
      isToday: boolean;
      isWeekend: boolean;
      holidays: IndianHoliday[];
      tasks: TodoItem[];
      events: CalendarCustomEvent[];
    }> = [];

    // Previous month padding
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const dayNum = prevMonthDaysCount - i;
      const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
      const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;
      const dateStr = `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
      
      const dObj = new Date(prevYear, prevMonth, dayNum);
      const isWeekend = dObj.getDay() === 0 || dObj.getDay() === 6;

      const holidays = INDIAN_HOLIDAYS_LIST.filter(h => h.month === prevMonth && h.day === dayNum);
      const tasks = todos.filter(t => t.dueDate === dateStr);
      const events = customEvents.filter(e => e.date === dateStr);

      days.push({
        dayNum,
        isCurrentMonth: false,
        dateStr,
        isToday: dateStr === todayStr,
        isWeekend,
        holidays,
        tasks,
        events,
      });
    }

    // Current month days
    for (let dayNum = 1; dayNum <= totalDaysInMonth; dayNum++) {
      const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
      const dObj = new Date(currentYear, currentMonth, dayNum);
      const isWeekend = dObj.getDay() === 0 || dObj.getDay() === 6;

      const holidays = INDIAN_HOLIDAYS_LIST.filter(h => h.month === currentMonth && h.day === dayNum);
      const tasks = todos.filter(t => t.dueDate === dateStr);
      const events = customEvents.filter(e => e.date === dateStr);

      days.push({
        dayNum,
        isCurrentMonth: true,
        dateStr,
        isToday: dateStr === todayStr,
        isWeekend,
        holidays,
        tasks,
        events,
      });
    }

    // Next month padding to fill complete rows (up to 35 or 42 cells)
    const remainingCells = (7 - (days.length % 7)) % 7;
    for (let dayNum = 1; dayNum <= remainingCells; dayNum++) {
      const nextMonth = currentMonth === 11 ? 0 : currentMonth + 1;
      const nextYear = currentMonth === 11 ? currentYear + 1 : currentYear;
      const dateStr = `${nextYear}-${String(nextMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
      
      const dObj = new Date(nextYear, nextMonth, dayNum);
      const isWeekend = dObj.getDay() === 0 || dObj.getDay() === 6;

      const holidays = INDIAN_HOLIDAYS_LIST.filter(h => h.month === nextMonth && h.day === dayNum);
      const tasks = todos.filter(t => t.dueDate === dateStr);
      const events = customEvents.filter(e => e.date === dateStr);

      days.push({
        dayNum,
        isCurrentMonth: false,
        dateStr,
        isToday: dateStr === todayStr,
        isWeekend,
        holidays,
        tasks,
        events,
      });
    }

    return days;
  }, [currentYear, currentMonth, todos, customEvents, todayStr]);

  // Selected Date Info
  const selectedDateInfo = useMemo(() => {
    if (!selectedDateStr) return null;
    const parts = selectedDateStr.split('-');
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    const d = parseInt(parts[2], 10);
    
    const dateObj = new Date(y, m, d);
    const dayOfWeek = dateObj.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const formattedTitle = dateObj.toLocaleDateString('en-IN', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });

    const holidays = INDIAN_HOLIDAYS_LIST.filter(h => h.month === m && h.day === d);
    const tasks = todos.filter(t => t.dueDate === selectedDateStr);
    const events = customEvents.filter(e => e.date === selectedDateStr);

    return {
      dateStr: selectedDateStr,
      formattedTitle,
      isWeekend,
      holidays,
      tasks,
      events,
    };
  }, [selectedDateStr, todos, customEvents]);

  // Upcoming Holidays & Events across current month and next month
  const upcomingHolidaysAndEvents = useMemo(() => {
    const list: Array<{
      id: string;
      title: string;
      dateStr: string;
      formattedDate: string;
      emoji: string;
      type: 'holiday' | 'birthday' | 'anniversary' | 'event';
      isNational?: boolean;
    }> = [];

    // Add Indian Holidays in current & next month
    INDIAN_HOLIDAYS_LIST.forEach((h) => {
      if (h.month === currentMonth || h.month === (currentMonth + 1) % 12) {
        const y = h.month < currentMonth ? currentYear + 1 : currentYear;
        const dateStr = `${y}-${String(h.month + 1).padStart(2, '0')}-${String(h.day).padStart(2, '0')}`;
        const dObj = new Date(y, h.month, h.day);
        list.push({
          id: `hol-${h.month}-${h.day}`,
          title: h.name,
          dateStr,
          formattedDate: dObj.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
          emoji: h.emoji,
          type: 'holiday',
          isNational: h.type === 'national',
        });
      }
    });

    // Add custom events
    customEvents.forEach((e) => {
      const parts = e.date.split('-');
      const m = parseInt(parts[1], 10) - 1;
      if (m === currentMonth || m === (currentMonth + 1) % 12) {
        const dObj = new Date(parseInt(parts[0]), m, parseInt(parts[2]));
        list.push({
          id: e.id,
          title: e.title,
          dateStr: e.date,
          formattedDate: dObj.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
          emoji: e.type === 'birthday' ? '🎂' : e.type === 'anniversary' ? '💍' : '📅',
          type: e.type === 'reminder' ? 'event' : e.type,
        });
      }
    });

    // Sort chronologically
    return list.sort((a, b) => a.dateStr.localeCompare(b.dateStr)).slice(0, 5);
  }, [currentMonth, currentYear, customEvents]);

  // Handle Add Item (Task or Custom Event)
  const handleSaveItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemTitle.trim()) return;

    if (itemType === 'task') {
      if (onAddTodo) {
        onAddTodo(
          itemTitle.trim(),
          itemPriority,
          itemCategory,
          selectedDateStr,
          'todo'
        );
      }
    } else {
      const newEvent: CalendarCustomEvent = {
        id: `evt-${Date.now()}`,
        title: itemTitle.trim(),
        date: selectedDateStr,
        type: itemType,
        icon: itemType === 'birthday' ? '🎂' : itemType === 'anniversary' ? '💍' : '📅',
      };
      saveCustomEvents([...customEvents, newEvent]);
    }

    setItemTitle('');
    setIsAddingItem(false);
    Sound.success(soundEnabled);
  };

  const handleDeleteEvent = (id: string) => {
    Sound.click(soundEnabled);
    saveCustomEvents(customEvents.filter(e => e.id !== id));
  };

  return (
    <div className="p-5 rounded-2xl bg-white dark:bg-[#1E293B] border border-[#EDECE9] dark:border-[#334155] shadow-2xs space-y-4">
      {/* Header with Title, Month Nav, View Tabs */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-xl bg-orange-50 dark:bg-orange-950/60 border border-orange-200/60 dark:border-orange-900/40 flex items-center justify-center text-orange-600 dark:text-orange-400 shrink-0">
            <CalendarIcon className="w-3.5 h-3.5" />
          </div>
          <div>
            <h2 className="text-xs uppercase font-bold text-[#37352F] dark:text-white tracking-wider">
              Calendar
            </h2>
          </div>
        </div>

        {/* Tab switch: Calendar vs Holiday List */}
        <div className="flex items-center gap-1 bg-[#F1F5F9] dark:bg-[#0F172A] p-0.5 rounded-lg border border-[#E2E8F0] dark:border-[#334155]">
          <button
            type="button"
            onClick={() => setActiveTab('calendar')}
            className={`px-2 py-0.5 text-[11px] font-semibold rounded-md transition-all cursor-pointer ${
              activeTab === 'calendar'
                ? 'bg-white dark:bg-[#1E293B] text-[#6366F1] shadow-2xs'
                : 'text-[#64748B] hover:text-[#334155]'
            }`}
          >
            Grid
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('holidays')}
            className={`px-2 py-0.5 text-[11px] font-semibold rounded-md transition-all cursor-pointer ${
              activeTab === 'holidays'
                ? 'bg-white dark:bg-[#1E293B] text-[#6366F1] shadow-2xs'
                : 'text-[#64748B] hover:text-[#334155]'
            }`}
          >
            Festivals
          </button>
        </div>
      </div>

      {activeTab === 'calendar' ? (
        <>
          {/* Month Header & Controls */}
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-[#37352F] dark:text-white">
                {monthName} {currentYear}
              </span>
              {(currentMonth !== today.getMonth() || currentYear !== today.getFullYear()) && (
                <button
                  type="button"
                  onClick={handleJumpToToday}
                  className="text-[10px] px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-[#6366F1] dark:text-[#818CF8] font-bold hover:bg-indigo-100 cursor-pointer"
                >
                  Today
                </button>
              )}
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handlePrevMonth}
                title="Previous Month"
                className="p-1 rounded-lg hover:bg-[#F1F5F9] dark:hover:bg-[#0F172A] text-[#64748B] cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleNextMonth}
                title="Next Month"
                className="p-1 rounded-lg hover:bg-[#F1F5F9] dark:hover:bg-[#0F172A] text-[#64748B] cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Calendar Day-of-Week Headers (Monday to Sunday) */}
          <div className="grid grid-cols-7 text-center text-[10px] font-bold text-[#94A3B8] dark:text-[#64748B] tracking-wider py-1.5 border-b border-[#EDECE9]/70 dark:border-[#334155]/60">
            <span>Mo</span>
            <span>Tu</span>
            <span>We</span>
            <span>Th</span>
            <span>Fr</span>
            <span className="text-red-500 font-extrabold" title="Saturday (Weekend Holiday)">Sa</span>
            <span className="text-red-500 font-extrabold" title="Sunday (Weekend Holiday)">Su</span>
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-1 pt-1.5">
            {calendarDays.map((cell, idx) => {
              const isSelected = cell.dateStr === selectedDateStr;
              const hasHoliday = cell.holidays.length > 0;
              const hasTasks = cell.tasks.length > 0;
              const hasEvents = cell.events.length > 0;

              return (
                <button
                  key={`${cell.dateStr}-${idx}`}
                  type="button"
                  onClick={() => {
                    Sound.click(soundEnabled);
                    setSelectedDateStr(cell.dateStr);
                  }}
                  className={`relative flex flex-col items-center justify-center h-8 sm:h-9 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-[#6366F1] text-white shadow-xs font-bold ring-2 ring-indigo-300 dark:ring-indigo-700'
                      : cell.isToday
                      ? 'bg-amber-100/90 dark:bg-amber-950/90 text-amber-900 dark:text-amber-200 border-2 border-amber-400 dark:border-amber-600 font-extrabold shadow-2xs'
                      : cell.isWeekend
                      ? cell.isCurrentMonth
                        ? 'bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 border border-red-200/80 dark:border-red-900/50 hover:bg-red-100/80 dark:hover:bg-red-900/60 font-semibold'
                        : 'bg-red-50/30 dark:bg-red-950/20 text-red-400/60 dark:text-red-500/40 border border-transparent opacity-60 hover:opacity-90'
                      : cell.isCurrentMonth
                      ? 'text-[#37352F] dark:text-[#E2E8F0] hover:bg-[#F1F5F9] dark:hover:bg-[#0F172A]'
                      : 'text-[#94A3B8] dark:text-[#64748B] opacity-40 hover:opacity-80'
                  }`}
                  title={
                    cell.isWeekend
                      ? `${cell.dateStr} (Weekend Holiday)`
                      : cell.dateStr
                  }
                >
                  <span>{cell.dayNum}</span>

                  {/* Indicators dot row */}
                  <div className="flex items-center gap-0.5 absolute bottom-1">
                    {hasHoliday && (
                      <span
                        className={`w-1 h-1 rounded-full ${
                          isSelected ? 'bg-amber-300' : 'bg-orange-500'
                        }`}
                        title={cell.holidays.map((h) => h.name).join(', ')}
                      />
                    )}
                    {hasEvents && (
                      <span
                        className={`w-1 h-1 rounded-full ${
                          isSelected ? 'bg-pink-200' : 'bg-pink-500'
                        }`}
                        title="Birthday / Event"
                      />
                    )}
                    {hasTasks && (
                      <span
                        className={`w-1 h-1 rounded-full ${
                          isSelected ? 'bg-emerald-200' : 'bg-emerald-500'
                        }`}
                        title={`${cell.tasks.length} task(s)`}
                      />
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Selected Date Inspector Card */}
          {selectedDateInfo && (
            <div className="p-3 rounded-xl bg-[#F8FAFC] dark:bg-[#0F172A] border border-[#E2E8F0] dark:border-[#334155] space-y-2 text-xs">
              <div className="flex items-center justify-between border-b border-[#E2E8F0] dark:border-[#334155] pb-1.5 flex-wrap gap-1">
                <span className="font-bold text-[#37352F] dark:text-white flex items-center gap-1.5 flex-wrap">
                  <Clock className="w-3.5 h-3.5 text-[#6366F1]" />
                  <span>{selectedDateInfo.formattedTitle}</span>
                  {selectedDateInfo.dateStr === todayStr && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 font-bold border border-emerald-200 dark:border-emerald-800">
                      Today
                    </span>
                  )}
                  {selectedDateInfo.isWeekend && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-red-100 dark:bg-red-950/80 text-red-700 dark:text-red-300 font-bold border border-red-200 dark:border-red-800 flex items-center gap-1">
                      <span>🌴</span>
                      <span>Weekend Holiday</span>
                    </span>
                  )}
                </span>
                <button
                  type="button"
                  onClick={() => setIsAddingItem(true)}
                  className="flex items-center gap-1 text-[11px] font-bold text-[#6366F1] dark:text-[#818CF8] hover:underline cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                  <span>Add Task / Event</span>
                </button>
              </div>

              {/* Holidays on this day */}
              {selectedDateInfo.holidays.map((h, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-2 rounded-lg bg-orange-50 dark:bg-orange-950/40 border border-orange-200 dark:border-orange-900/30 text-orange-900 dark:text-orange-200"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{h.emoji}</span>
                    <div>
                      <p className="font-bold text-[11px]">{h.name}</p>
                      {h.description && (
                        <p className="text-[10px] text-orange-700/80 dark:text-orange-300/80">{h.description}</p>
                      )}
                    </div>
                  </div>
                  <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-orange-200/60 dark:bg-orange-900/60 text-orange-800 dark:text-orange-200">
                    {h.type}
                  </span>
                </div>
              ))}

              {/* Custom Events / Birthdays on this day */}
              {selectedDateInfo.events.map((evt) => (
                <div
                  key={evt.id}
                  className="flex items-center justify-between p-2 rounded-lg bg-pink-50 dark:bg-pink-950/40 border border-pink-200 dark:border-pink-900/30 text-pink-900 dark:text-pink-200"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{evt.icon || '🎂'}</span>
                    <div>
                      <p className="font-bold text-[11px]">{evt.title}</p>
                      {evt.description && (
                        <p className="text-[10px] text-pink-700/80 dark:text-pink-300/80">{evt.description}</p>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeleteEvent(evt.id)}
                    className="text-pink-400 hover:text-red-500 cursor-pointer p-0.5"
                    title="Remove event"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}

              {/* Tasks due on this day */}
              {selectedDateInfo.tasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center justify-between p-2 rounded-lg bg-white dark:bg-[#1E293B] border border-[#E2E8F0] dark:border-[#334155]"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <button
                      type="button"
                      onClick={() => onToggleTodo && onToggleTodo(task.id)}
                      className="cursor-pointer text-[#94A3B8] hover:text-emerald-500"
                    >
                      {task.completed ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                      ) : (
                        <Circle className="w-3.5 h-3.5" />
                      )}
                    </button>
                    <span className={`text-[11px] truncate font-medium ${task.completed ? 'line-through text-gray-400' : 'text-[#37352F] dark:text-white'}`}>
                      {task.title}
                    </span>
                  </div>
                  <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950 text-[#6366F1]">
                    {task.priority}
                  </span>
                </div>
              ))}

              {selectedDateInfo.holidays.length === 0 &&
                selectedDateInfo.events.length === 0 &&
                selectedDateInfo.tasks.length === 0 && (
                  <p className="text-[11px] text-[#94A3B8] italic py-1 text-center">
                    No scheduled items or holidays for this day. Click &ldquo;Add Task / Event&rdquo; to schedule something.
                  </p>
                )}
            </div>
          )}
        </>
      ) : (
        /* Upcoming Indian Festivals & Events View */
        <div className="space-y-2 pt-1">
          <div className="flex items-center justify-between text-xs text-[#787774] dark:text-[#9CA3AF] pb-1">
            <span className="font-semibold">Upcoming in {monthName} &amp; Next</span>
            <span className="text-[10px] font-mono">2026 Calendar</span>
          </div>

          <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
            {upcomingHolidaysAndEvents.map((item) => (
              <div
                key={item.id}
                onClick={() => {
                  setSelectedDateStr(item.dateStr);
                  setActiveTab('calendar');
                }}
                className="flex items-center justify-between p-2.5 rounded-xl bg-[#F8FAFC] dark:bg-[#0F172A] border border-[#E2E8F0] dark:border-[#334155] hover:border-[#6366F1] cursor-pointer transition-all"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="text-base shrink-0">{item.emoji}</span>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-[#37352F] dark:text-white truncate">
                      {item.title}
                    </p>
                    <p className="text-[10px] text-[#787774] dark:text-[#9CA3AF]">
                      {item.type === 'birthday' ? 'Birthday 🎂' : item.isNational ? '🇮🇳 National Holiday' : 'Festival'}
                    </p>
                  </div>
                </div>
                <span className="text-[11px] font-mono font-bold text-[#6366F1] dark:text-[#818CF8] shrink-0 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded-md">
                  {item.formattedDate}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Add Modal */}
      {isAddingItem && (
        <div className="pt-2 border-t border-[#EDECE9]/70 dark:border-[#334155]/60 animate-in fade-in">
          <form onSubmit={handleSaveItem} className="p-3 rounded-xl bg-[#F8FAFC] dark:bg-[#0F172A] border border-[#E2E8F0] dark:border-[#334155] space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#37352F] dark:text-white">
                Add to {selectedDateStr}
              </span>
              <button
                type="button"
                onClick={() => setIsAddingItem(false)}
                className="text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Type selector pills */}
            <div className="flex gap-1">
              {(['task', 'birthday', 'anniversary', 'event'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setItemType(t)}
                  className={`px-2 py-1 rounded-lg text-[10px] font-bold capitalize transition-all cursor-pointer ${
                    itemType === t
                      ? 'bg-[#6366F1] text-white'
                      : 'bg-white dark:bg-[#1E293B] text-[#64748B] border border-[#E2E8F0] dark:border-[#334155]'
                  }`}
                >
                  {t === 'task' ? '✓ Task' : t === 'birthday' ? '🎂 Birthday' : t === 'anniversary' ? '💍 Anniversary' : '📅 Event'}
                </button>
              ))}
            </div>

            <input
              type="text"
              required
              placeholder={
                itemType === 'task'
                  ? 'Task title...'
                  : itemType === 'birthday'
                  ? "Person's name..."
                  : 'Event title...'
              }
              value={itemTitle}
              onChange={(e) => setItemTitle(e.target.value)}
              className="w-full px-3 py-1.5 rounded-xl border border-[#E2E8F0] dark:border-[#334155] bg-white dark:bg-[#1E293B] text-xs text-[#37352F] dark:text-white focus:outline-hidden focus:border-[#6366F1]"
              autoFocus
            />

            {itemType === 'task' && (
              <div className="flex items-center gap-2">
                <select
                  value={itemPriority}
                  onChange={(e) => setItemPriority(e.target.value as Priority)}
                  className="flex-1 px-2 py-1 rounded-lg border border-[#E2E8F0] dark:border-[#334155] bg-white dark:bg-[#1E293B] text-[11px] text-[#37352F] dark:text-white"
                >
                  <option value="low">Low Priority</option>
                  <option value="medium">Medium Priority</option>
                  <option value="high">High Priority</option>
                  <option value="urgent">Urgent</option>
                </select>
                <select
                  value={itemCategory}
                  onChange={(e) => setItemCategory(e.target.value)}
                  className="flex-1 px-2 py-1 rounded-lg border border-[#E2E8F0] dark:border-[#334155] bg-white dark:bg-[#1E293B] text-[11px] text-[#37352F] dark:text-white"
                >
                  <option value="Personal">Personal</option>
                  <option value="Work">Work</option>
                  <option value="Studies">Studies</option>
                  <option value="Health">Health</option>
                </select>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setIsAddingItem(false)}
                className="px-2.5 py-1 text-[11px] font-semibold text-gray-500 hover:text-gray-700 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-3 py-1 bg-[#6366F1] hover:bg-[#4F46E5] text-white text-[11px] font-bold rounded-lg cursor-pointer"
              >
                Save
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
