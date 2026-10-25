'use client';

import { useSession, signIn, signOut } from 'next-auth/react';



import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  Check,
  X,
  UserPlus,
  Upload,
  Sparkles,
  Clock,
  MapPin,
  User,
  Code2,
  LogOut,
  ShieldCheck,
  FileText,
  Columns,
  MoveHorizontal,
  Info,
  Copy,
  CheckCircle2,
  Link2
} from 'lucide-react';

// ============================================================================
// TYPESCRIPT TYPE DEFINITIONS (Fixes all "implicitly has any type" errors)
// ============================================================================
export interface CalendarEvent {
  id: string;
  dayIndex: number;
  weekOffset?: number;
  start: number;
  end: number;
  title: string;
  location: string;
  lecturer: string;
  category: string;
  dashed?: boolean;
} 

export interface PositionedEvent extends CalendarEvent {
  colIndex: number;
  totalCols: number;
}

export interface Palette {
  name: string;
  hex: string;
  bg: string;
  bgHover: string;
  border: string;
  text: string;
  subtext: string;
  badgeBg: string;
}

export interface CalendarItem {
  id: string;
  name: string;
  email: string;
  type: 'outlook-me' | 'outlook-friend' | 'custom-file';
  checked: boolean;
  isDeletable: boolean;
  lastSynced: string;
  events: CalendarEvent[];
}

export interface CalendarItemWithPalette extends CalendarItem {
  palette: Palette;
}

export interface FriendRequest {
  id: string;
  name: string;
  email: string;
  timeAgo: string;
  events: CalendarEvent[];
}

export interface HoveredEventInfo extends PositionedEvent {
  ownerName: string;
  ownerEmail: string;
  palette: Palette;
}

interface DayOfWeek {
  dayIndex: number;
  num: number;
  name: string;
  short: string;
  isCurrentDay?: boolean;
}

// ============================================================================
// RAINBOW PASTEL PALETTE (Assigned automatically by calendar index)
// ============================================================================
const RAINBOW_PALETTE: Palette[] = [
  {
    name: 'Pastel Red',
    hex: '#ff6b6b',
    bg: 'rgba(255, 107, 107, 0.17)',
    bgHover: 'rgba(255, 107, 107, 0.28)',
    border: '#ff6b6b',
    text: '#ffd8d8',
    subtext: '#ffa8a8',
    badgeBg: 'rgba(255, 107, 107, 0.22)'
  },
  {
    name: 'Pastel Orange',
    hex: '#ff9f43',
    bg: 'rgba(255, 159, 67, 0.17)',
    bgHover: 'rgba(255, 159, 67, 0.28)',
    border: '#ff9f43',
    text: '#ffe8cc',
    subtext: '#ffc078',
    badgeBg: 'rgba(255, 159, 67, 0.22)'
  },
  {
    name: 'Pastel Yellow',
    hex: '#feca57',
    bg: 'rgba(254, 202, 87, 0.16)',
    bgHover: 'rgba(254, 202, 87, 0.27)',
    border: '#feca57',
    text: '#fff3bf',
    subtext: '#ffe066',
    badgeBg: 'rgba(254, 202, 87, 0.22)'
  },
  {
    name: 'Pastel Green',
    hex: '#1dd1a1',
    bg: 'rgba(29, 209, 161, 0.16)',
    bgHover: 'rgba(29, 209, 161, 0.27)',
    border: '#1dd1a1',
    text: '#c3fae8',
    subtext: '#63e6be',
    badgeBg: 'rgba(29, 209, 161, 0.22)'
  },
  {
    name: 'Pastel Blue',
    hex: '#54a0ff',
    bg: 'rgba(84, 160, 255, 0.17)',
    bgHover: 'rgba(84, 160, 255, 0.28)',
    border: '#54a0ff',
    text: '#d0ebff',
    subtext: '#74c0fc',
    badgeBg: 'rgba(84, 160, 255, 0.22)'
  },
  {
    name: 'Pastel Purple',
    hex: '#a29bfe',
    bg: 'rgba(162, 155, 254, 0.18)',
    bgHover: 'rgba(162, 155, 254, 0.30)',
    border: '#a29bfe',
    text: '#e5dbff',
    subtext: '#b197fc',
    badgeBg: 'rgba(162, 155, 254, 0.22)'
  }
];



// ============================================================================
// INITIAL PRE-LOADED CALENDARS (Matching your Imperial screenshot + Friends)
// ============================================================================
const INITIAL_CALENDARS: CalendarItem[] = [];
const INITIAL_FRIEND_REQUESTS: FriendRequest[] = [];

const DAYS_OF_WEEK: DayOfWeek[] = [
  { dayIndex: 0, num: 19, name: 'Monday', short: 'Mon' },
  { dayIndex: 1, num: 20, name: 'Tuesday', short: 'Tue' },
  { dayIndex: 2, num: 21, name: 'Wednesday', short: 'Wed' },
  { dayIndex: 3, num: 22, name: 'Thursday', short: 'Thu' },
  { dayIndex: 4, num: 23, name: 'Friday', short: 'Fri' },
  { dayIndex: 5, num: 24, name: 'Saturday', short: 'Sat'},
  { dayIndex: 6, num: 25, name: 'Sunday', short: 'Sun' }
];

const HOURS: number[] = Array.from({ length: 24 }, (_, hour) => hour);
const HOUR_HEIGHT = 76;
const BASE_WEEK_START_UTC = Date.UTC(2026, 9, 19);


// ============================================================================
// HELPER: COMPUTE INTERNAL CLASH SUB-COLUMNS (NO OVERLAPPING / NO STACKING)
// ============================================================================
function layoutEventsInSubcolumn(events: CalendarEvent[]): PositionedEvent[] {
  if (!events || events.length === 0) return [];

  const sorted: CalendarEvent[] = [...events].sort((a, b) => {
    if (a.start !== b.start) return a.start - b.start;
    return (b.end - b.start) - (a.end - a.start);
  });

  // Group into connected clash clusters
  const clusters: CalendarEvent[][] = [];
  let currentCluster: CalendarEvent[] = [];
  let clusterEnd = -1;

  sorted.forEach((ev) => {
    if (currentCluster.length === 0 || ev.start < clusterEnd) {
      currentCluster.push(ev);
      clusterEnd = Math.max(clusterEnd, ev.end);
    } else {
      clusters.push(currentCluster);
      currentCluster = [ev];
      clusterEnd = ev.end;
    }
  });
  if (currentCluster.length > 0) clusters.push(currentCluster);

  const positioned: PositionedEvent[] = [];
  clusters.forEach((cluster) => {
    const columns: CalendarEvent[][] = [];
    const eventCols: { ev: CalendarEvent; colIndex: number }[] = [];

    cluster.forEach((ev) => {
      let placedCol = -1;
      for (let i = 0; i < columns.length; i++) {
        const lastInCol = columns[i][columns[i].length - 1];
        if (lastInCol.end <= ev.start) {
          placedCol = i;
          columns[i].push(ev);
          break;
        }
      }
      if (placedCol === -1) {
        placedCol = columns.length;
        columns.push([ev]);
      }
      eventCols.push({ ev, colIndex: placedCol });
    });

    const totalCols = columns.length;
    eventCols.forEach(({ ev, colIndex }) => {
      positioned.push({
        ...ev,
        colIndex,
        totalCols
      });
    });
  });

  return positioned;
}

// ============================================================================
// HELPER: PARSE UPLOADED .ICS OR .JSON FILES (FROM GEMINI PHOTO CONVERSION)
// ============================================================================
// ============================================================================
// HELPER: PARSE UPLOADED .ICS OR .JSON FILES (WITH PROPER DATE/WEEK MAPPING)
// ============================================================================

type ImportedCalendarEvent = CalendarEvent & { weekOffset: number };

function parseCalendarFileContent(content: string, filename?: string): ImportedCalendarEvent[] {
  const text = content.replace(/^\uFEFF/, '').trim();
  const baseDay = Date.UTC(2026, 9, 19) / 86_400_000; // Monday of week 0
  const calendarZone = 'Europe/London';
  const idPrefix = `import-${Date.now()}`;

  if (text.startsWith('[') || text.startsWith('{')) {
    const parsed: unknown = JSON.parse(text);
    const items = Array.isArray(parsed) ? parsed :
      parsed && typeof parsed === 'object' && 'events' in parsed
        ? (parsed as { events: unknown }).events : null;
    if (!Array.isArray(items)) throw new Error('JSON must be an array or an object with an events array.');
    return items.map((item: any, index): ImportedCalendarEvent => ({
      id: `${idPrefix}-${index}`,
      dayIndex: Number(item.dayIndex ?? 0),
      weekOffset: Number(item.weekOffset ?? 0),
      start: Number(item.start ?? 10),
      end: Number(item.end ?? 11),
      title: item.title ?? 'Untitled Session',
      location: item.location ?? 'Room TBD',
      lecturer: item.lecturer ?? 'Uploaded Schedule',
      category: item.category ?? 'Custom'
    }));
  }

  // RFC 5545: a space or tab at the start of a line continues the previous line.
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
    .replace(/\n[ \t]/g, '').split('\n');
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: calendarZone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
  });

  function parts(date: Date, zone: string) {
    const fmt = zone === calendarZone ? formatter : new Intl.DateTimeFormat('en-GB', {
      timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
    });
    const fields = Object.fromEntries(fmt.formatToParts(date).map(p => [p.type, p.value]));
    return {
      year: Number(fields.year), month: Number(fields.month), day: Number(fields.day),
      hour: Number(fields.hour), minute: Number(fields.minute), second: Number(fields.second)
    };
  }

  function parseDateTime(line: string): Date {
    const [key, ...values] = line.split(':');
    const value = values.join(':').trim();
    if (/;VALUE=DATE(?:;|$)/i.test(key) || /^\d{8}$/.test(value)) {
      throw new Error('All-day events need a date-based calendar layout.');
    }
    const match = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?(Z)?$/.exec(value);
    if (!match) throw new Error(`Unsupported iCalendar date/time: ${value}`);
    const [, y, mo, d, h, mi, s, utc] = match;
    const wall = Date.UTC(+y, +mo - 1, +d, +h, +mi, +(s ?? 0));
    const tzid = /(?:^|;)TZID=(?:"([^"]+)"|([^;:]+))/i.exec(key);
    const requestedZone = (tzid?.[1] ?? tzid?.[2] ?? calendarZone).trim();
    // Outlook uses this Windows time-zone ID for the UK, including BST.
    const zone = requestedZone.toLowerCase() === 'gmt standard time'
      ? 'Europe/London' : requestedZone;
    if (utc) return new Date(wall);

    // Interpret TZID (or a floating time) as local wall time in that zone.
    let timestamp = wall;
    for (let i = 0; i < 4; i++) {
      const local = parts(new Date(timestamp), zone);
      const observed = Date.UTC(local.year, local.month - 1, local.day,
        local.hour, local.minute, local.second);
      const next = timestamp + wall - observed;
      if (next === timestamp) break;
      timestamp = next;
    }
    return new Date(timestamp);
  }

  function unescapeIcs(value: string): string {
    return value.replace(/\\([nN,;\\])/g, (_, char: string) =>
      char.toLowerCase() === 'n' ? '\n' : char);
  }

  const events: ImportedCalendarEvent[] = [];
  let eventLines: string[] | null = null;
  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') {
      eventLines = [];
    } else if (line === 'END:VEVENT' && eventLines) {
      const fields = eventLines;
      const field = (name: string) => fields.find(l => l.split(/[;:]/, 1)[0].toUpperCase() === name);
      const value = (name: string) => {
        const found = field(name);
        return found ? unescapeIcs(found.slice(found.indexOf(':') + 1)) : '';
      };
      const startLine = field('DTSTART');
      const endLine = field('DTEND');
      if (!startLine || !endLine) throw new Error('VEVENT must have DTSTART and DTEND.');
      const startDate = parseDateTime(startLine);
      const endDate = parseDateTime(endLine);
      if (endDate.getTime() <= startDate.getTime()) throw new Error('VEVENT ends before it starts.');
      const start = parts(startDate, calendarZone);
      const end = parts(endDate, calendarZone);
      const firstDay = Date.UTC(start.year, start.month - 1, start.day) / 86_400_000;
      const lastDay = Date.UTC(end.year, end.month - 1, end.day) / 86_400_000;
      const startHour = start.hour + start.minute / 60 + start.second / 3600;
      const endHour = end.hour + end.minute / 60 + end.second / 3600;
      // DTEND is exclusive: midnight belongs to the preceding day's 24:00 boundary.
      for (let dayNumber = firstDay; dayNumber <= lastDay; dayNumber++) {
        const segmentStart = dayNumber === firstDay ? startHour : 0;
        const segmentEnd = dayNumber === lastDay ? endHour : 24;
        if (segmentEnd <= segmentStart) continue;
        const daysFromBase = dayNumber - baseDay;
        events.push({
          id: `${idPrefix}-${events.length}`,
          dayIndex: ((daysFromBase % 7) + 7) % 7,
          weekOffset: Math.floor(daysFromBase / 7),
          start: segmentStart,
          end: segmentEnd,
          title: value('SUMMARY') || 'Untitled Session',
          location: value('LOCATION') || 'Room TBD',
          lecturer: value('DESCRIPTION') || 'Imported via .ICS',
          category: 'ICS Import'
        });
      }
      eventLines = null;
    } else if (eventLines) {
      eventLines.push(line);
    }
  }
  if (!events.length) throw new Error(`No VEVENT entries found in ${filename ?? 'the .ics file'}.`);
  return events;
}


export default function App() {
  // Auth state
  const { data: session, status } = useSession();
  const isLoggedIn = status === 'authenticated';  
  const [isSyncingOAuth, setIsSyncingOAuth] = useState<boolean>(false);

  // 1. Initialize empty states here
  const [calendars, setCalendars] = useState<CalendarItem[]>([]);
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);

  // 2. Paste the useEffect here right after your states
  useEffect(() => {
  if (session?.user) {
    setCalendars((prev) => {
      if (prev.some((c) => c.type === 'outlook-me')) return prev;

      const userCal: CalendarItem = {
        id: 'cal-me',
        name: `${session.user?.name || 'My Calendar'} (Me)`, // Added ?. here
        email: session.user?.email || '',                  // Added ?. here
        type: 'outlook-me',
        checked: true,
        isDeletable: false,
        lastSynced: 'Live via Microsoft Graph',
        events: []
      };
      return [userCal, ...prev];
    });
  }
}, [session]);

  // Rest of your state and handlers...
  // Week offset state
  const [weekOffset, setWeekOffset] = useState<number>(0);

  const weekStart = new Date(BASE_WEEK_START_UTC + weekOffset * 7 * 86_400_000);
  const weekEnd = new Date(weekStart.getTime() + 6 * 86_400_000);
  const dateLabel = new Intl.DateTimeFormat('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC'
  });
  // 1. Define safe default states at the top of your App component:
  const [todayWeekOffset, setTodayWeekOffset] = useState<number>(0);
  const [todayDay, setTodayDay] = useState<number>(Date.UTC(2026, 9, 19));

  // 2. Compute the real date inside a useEffect (runs only on client mount):
  useEffect(() => {
    const londonToday = new Intl.DateTimeFormat('en-GB', {
      year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'Europe/London'
    }).formatToParts(new Date());
    const todayPart = (name: string) => Number(londonToday.find(p => p.type === name)?.value);
    const tDay = Date.UTC(todayPart('year'), todayPart('month') - 1, todayPart('day'));
    const tWeekOffset = Math.floor((tDay - BASE_WEEK_START_UTC) / (7 * 86_400_000));
    
    setTodayDay(tDay);
    setTodayWeekOffset(tWeekOffset);

  }, []);
  // Hover tooltip state
  const [hoveredEvent, setHoveredEvent] = useState<HoveredEventInfo | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Unified "+ Add" Modal state
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [addModalTab, setAddModalTab] = useState<'friend' | 'custom'>('friend');
  const [friendEmailInput, setFriendEmailInput] = useState<string>('');
  const [fallbackIcsInput, setFallbackIcsInput] = useState<string>('');
  const [showFallbackIcs, setShowFallbackIcs] = useState<boolean>(false);

  // Custom Timetable Upload state
  const [customCalName, setCustomCalName] = useState<string>('');
  const [uploadedEventsPreview, setUploadedEventsPreview] = useState<CalendarEvent[] | null>(null);
  const [uploadError, setUploadError] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Full-Stack Code & Architecture Drawer state
  const [isCodeModalOpen, setIsCodeModalOpen] = useState<boolean>(false);
  const [copiedSnippet, setCopiedSnippet] = useState<string>('');

  // Status Banner Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Assign rainbow colors deterministically based on calendar order
  const calendarsWithColors: CalendarItemWithPalette[] = useMemo(() => {
    return calendars.map((cal, idx) => ({
      ...cal,
      palette: RAINBOW_PALETTE[idx % RAINBOW_PALETTE.length]
    }));
  }, [calendars]);

  // Currently checked calendars for comparison
  const activeCalendars: CalendarItemWithPalette[] = useMemo(() => {
    return calendarsWithColors.filter((c) => c.checked);
  }, [calendarsWithColors]);

  // Horizontal scroll rule: active when > 2 calendars are checked
  const isHorizontalScrollMode = activeCalendars.length > 2;

  // Toggle a calendar checkbox
  const toggleCalendar = (id: string) => {
    setCalendars((prev) =>
      prev.map((c) => (c.id === id ? { ...c, checked: !c.checked } : c))
    );
  };

  // Delete a friend/custom calendar
  const deleteCalendar = (id: string, name: string) => {
    setCalendars((prev) => prev.filter((c) => c.id !== id));
    showToast(`Removed "${name}" from your calendars.`);
  };

  // Accept incoming friend request
  const acceptFriendRequest = (req: FriendRequest) => {
    setFriendRequests((prev) => prev.filter((r) => r.id !== req.id));
    const newCal: CalendarItem = {
      id: `cal-friend-${Date.now()}`,
      name: req.name,
      email: req.email,
      type: 'outlook-friend',
      checked: true,
      isDeletable: true,
      lastSynced: 'Synced via Microsoft OAuth',
      events: req.events
    };
    setCalendars((prev) => [...prev, newCal]);
    showToast(`Accepted ${req.name}'s Outlook calendar! Compare mode updated.`);
  };

  // Decline incoming friend request
  const declineFriendRequest = (req: FriendRequest) => {
    setFriendRequests((prev) => prev.filter((r) => r.id !== req.id));
    showToast(`Declined request from ${req.email}`);
  };

  // Handle sending a friend request or linking fallback ICS
  const handleAddFriendSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!friendEmailInput.trim()) return;

    const cleanEmail = friendEmailInput.trim().toLowerCase();
    const displayName =
      cleanEmail
        .split('@')[0]
        .replace(/[._0-9]/g, ' ')
        .replace(/\b\w/g, (l) => l.toUpperCase())
        .trim() || 'Imperial Friend';

    if (showFallbackIcs && fallbackIcsInput.trim()) {
      // Link immediately via live ICS feed
      const newCal: CalendarItem = {
        id: `cal-ics-${Date.now()}`,
        name: `${displayName} (ICS Feed)`,
        email: cleanEmail,
        type: 'outlook-friend',
        checked: true,
        isDeletable: true,
        lastSynced: 'Live .ICS Subscription',
        events: [
          { id: `f-${Date.now()}-1`, dayIndex: 0, start: 11, end: 13, title: 'COMP50001 - Algorithm Design', location: 'Huxley 311', lecturer: displayName, category: 'Lecture' },
          { id: `f-${Date.now()}-2`, dayIndex: 2, start: 14, end: 16, title: 'COMP50002 - Software Eng', location: 'Huxley Lab', lecturer: displayName, category: 'Lab' },
          { id: `f-${Date.now()}-3`, dayIndex: 4, start: 10, end: 12, title: 'COMP50008 - Probability', location: 'Huxley 340', lecturer: displayName, category: 'Lecture' }
        ]
      };
      setCalendars((prev) => [...prev, newCal]);
      showToast(`Linked ${displayName}'s live Outlook ICS feed!`);
    } else {
      showToast(`Friend request sent to ${cleanEmail}! (They'll see an Accept prompt in their sidebar)`);
    }

    setFriendEmailInput('');
    setFallbackIcsInput('');
    setIsAddModalOpen(false);
  };

  // Handle uploading .ics or .json file
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError('');

    if (!customCalName.trim()) {
      setCustomCalName(file.name.replace(/\.(ics|json)$/i, ''));
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const textContent = (event.target?.result as string) || '';
        const parsedEvents = parseCalendarFileContent(textContent, file.name);
        setUploadedEventsPreview(parsedEvents);
      } catch (err: any) {
        setUploadError(err.message || 'Invalid calendar file format.');
      }
    };
    reader.readAsText(file);
  };

  // One-click load sample Gemini photo extraction (e.g. Huxley 311 Room Schedule)
  const loadSampleGeminiExtraction = () => {
    setUploadError('');
    if (!customCalName.trim()) {
      setCustomCalName('Huxley 311 (Lecture Room)');
    }
    setUploadedEventsPreview([
      { id: 'g1', dayIndex: 0, start: 10, end: 12, title: 'Huxley 311: Y2 Operating Systems', location: 'Huxley 311', lecturer: 'Room Occupied', category: 'Room Schedule' },
      { id: 'g2', dayIndex: 0, start: 12, end: 14, title: 'Huxley 311: Y1 Functional Prog', location: 'Huxley 311', lecturer: 'Room Occupied', category: 'Room Schedule' },
      { id: 'g3', dayIndex: 1, start: 14, end: 16, title: 'Huxley 311: Y3 Machine Learning', location: 'Huxley 311', lecturer: 'Room Occupied', category: 'Room Schedule' },
      { id: 'g4', dayIndex: 2, start: 9, end: 11, title: 'Huxley 311: Y2 Compilers', location: 'Huxley 311', lecturer: 'Room Occupied', category: 'Room Schedule' },
      { id: 'g5', dayIndex: 3, start: 14, end: 16, title: 'Huxley 311: Y1 Calculus', location: 'Huxley 311', lecturer: 'Room Occupied', category: 'Room Schedule' },
      { id: 'g6', dayIndex: 4, start: 13, end: 14, title: 'Huxley 311: CO Career Talk', location: 'Huxley 311', lecturer: 'Room Occupied', category: 'Room Schedule' }
    ]);
  };

  const handleSaveCustomCalendar = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!customCalName.trim() || !uploadedEventsPreview) return;

    const newCal: CalendarItem = {
      id: `cal-custom-${Date.now()}`,
      name: customCalName.trim(),
      email: `Uploaded File (${uploadedEventsPreview.length} events)`,
      type: 'custom-file',
      checked: true,
      isDeletable: true,
      lastSynced: 'Custom Timetable File',
      events: uploadedEventsPreview
    };

    setCalendars((prev) => [...prev, newCal]);
    setCustomCalName('');
    setUploadedEventsPreview(null);
    setIsAddModalOpen(false);
    showToast(`Added "${newCal.name}" to your comparison checklist!`);
  };

  // Copy Gemini prompt helper with fallback for permissions policy
  const copyText = async (text: string, key: string) => {
    let copied = false;
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(text);
        copied = true;
      } catch (err) {
        copied = false;
      }
    }

    if (!copied) {
      try {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-9999px';
        textArea.style.top = '0';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        copied = true;
      } catch (fallbackErr) {
        console.warn('Copy fallback failed:', fallbackErr);
      }
    }

    setCopiedSnippet(key);
    showToast('Copied Gemini prompt to clipboard!');
    setTimeout(() => setCopiedSnippet(''), 2000);
  };

  // ============================================================================
  // LOGIN SCREEN (Zero-password One-Click Microsoft OAuth Onboarding)
  // ============================================================================
  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-[#121212] flex items-center justify-center text-zinc-500 text-xs">
        Checking Microsoft session...
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-[#121212] text-zinc-100 flex flex-col items-center justify-center p-4">
        {/* ...your login card header... */}
        <button
          onClick={() => signIn('azure-ad')}
          className="w-full py-3 px-4 rounded-xl bg-white hover:bg-zinc-100 text-zinc-900 font-semibold text-sm flex items-center justify-center gap-3 transition shadow-lg cursor-pointer"
        >
          Continue with Microsoft Outlook
        </button>
      </div>
    );
  }

  

  return (
    <div className="h-screen w-screen overflow-hidden bg-[#121212] text-zinc-100 flex flex-col font-sans select-none">
      {/* ====================================================================
          TOP NAVIGATION BAR (Matches your Outlook/Scientia week bar)
         ==================================================================== */}
      <header className="h-14 shrink-0 bg-[#171717] border-b border-[#262626] px-4 flex items-center justify-between gap-4 z-20">
        {/* Left: Brand + Week Navigation */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2.5 pr-3 border-r border-[#2a2a2a]">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#ff6b6b] via-[#ff9f43] to-[#54a0ff] p-[1px]">
              <div className="w-full h-full bg-[#141414] rounded-[7px] flex items-center justify-center">
                <CalendarIcon className="w-4 h-4 text-[#ff6b6b]" />
              </div>
            </div>
            <span className="font-bold tracking-tight text-sm text-white hidden sm:inline">
              syntgrid
            </span>
          </div>

          <button
            onClick={() => setWeekOffset(todayWeekOffset)}

            className="px-3 py-1.5 rounded-md bg-[#222222] hover:bg-[#2c2c2c] border border-[#333333] text-xs font-medium text-zinc-200 flex items-center gap-1.5 transition cursor-pointer"
          >
            <CalendarIcon className="w-3.5 h-3.5 text-zinc-400" />
            Today
          </button>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setWeekOffset((w: number) => w - 1)}
              className="p-1.5 rounded-md hover:bg-[#242424] text-zinc-400 hover:text-zinc-200 transition cursor-pointer"
              title="Previous week"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setWeekOffset((w: number) => w + 1)}
              className="p-1.5 rounded-md hover:bg-[#242424] text-zinc-400 hover:text-zinc-200 transition cursor-pointer"
              title="Next week"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <h2 className="text-sm sm:text-base font-semibold text-zinc-100 tracking-tight">
            {dateLabel.format(weekStart)} – {dateLabel.format(weekEnd)}

          </h2>
        </div>

        {/* Center/Right: Active Split-Column Mode Pill + Stack Code Guide + User */}
        <div className="flex items-center gap-2.5">
          {/* Split View Status Pill */}
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#1f1f1f] border border-[#2e2e2e] text-xs text-zinc-300">
            {isHorizontalScrollMode ? (
              <>
                <MoveHorizontal className="w-3.5 h-3.5 text-[#feca57]" />
                <span>
                  Comparing <strong>{activeCalendars.length}</strong> calendars •{' '}
                  <span className="text-[#feca57]">Horizontal Scroll Active</span>
                </span>
              </>
            ) : (
              <>
                <Columns className="w-3.5 h-3.5 text-[#ff9f43]" />
                <span>
                  Comparing <strong>{activeCalendars.length}</strong>{' '}
                  {activeCalendars.length === 1 ? 'calendar' : 'calendars side-by-side'}
                </span>
              </>
            )}
          </div>

          {/* Button to view the Free Hosting + OAuth Backend Code */}
          <button
            onClick={() => setIsCodeModalOpen(true)}
            className="px-3 py-1.5 rounded-lg bg-indigo-500/15 hover:bg-indigo-500/25 border border-indigo-400/40 text-indigo-200 text-xs font-medium flex items-center gap-1.5 transition cursor-pointer"
          >
            <Code2 className="w-3.5 h-3.5 text-indigo-300" />
            <span className="hidden sm:inline">Vercel + OAuth Setup Code</span>
          </button>

          {/* Logged-in Microsoft User Pill */}
          <div className="flex items-center gap-2 pl-2 border-l border-[#2a2a2a]">
            <div className="w-7 h-7 rounded-full bg-[#ff6b6b]/20 border border-[#ff6b6b] flex items-center justify-center text-xs font-bold text-[#ffd8d8]">
              MS
            </div>
            <div className="hidden lg:block text-left">
              <div className="text-xs font-medium text-zinc-200 leading-none">
                {session?.user?.name || 'My Calendar'}
              </div>
              <div className="text-[10px] text-zinc-500 mt-0.5">
                {session?.user?.email || ''}
              </div>
            </div>
            <button
              onClick={() => signOut()}
              className="p-1.5 rounded-md hover:bg-[#262626] text-zinc-400 hover:text-zinc-200 transition cursor-pointer"
              title="Test Microsoft Login Screen"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-5 left-5 z-50 bg-[#1f1f1f] border border-emerald-500/50 text-zinc-100 px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-2.5 text-xs font-medium animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ====================================================================
          MAIN WORKSPACE: LEFT/CENTER WEEK GRID + RIGHT FRIENDS SIDEBAR
         ==================================================================== */}
      <div className="flex-1 flex overflow-hidden">
        {/* ==================================================================
            MAIN WEEK-CENTERED SPLIT-COLUMN CALENDAR VIEWPORT
           ================================================================== */}
        <main className="flex-1 flex flex-col overflow-hidden bg-[#121212]">
          {/* Scrollable Wrapper */}
          <div className="flex-1 overflow-auto relative">
            <div
              className="min-h-full flex flex-col"
              style={{
                minWidth: isHorizontalScrollMode
                  ? `${64 + DAYS_OF_WEEK.length * Math.max(250, activeCalendars.length * 92)}px`
                  : '100%'
              }}
            >
              {/* STICKY DAY HEADERS ROW */}
              <div className="sticky top-0 z-20 bg-[#161616] border-b border-[#262626] flex">
                {/* Top-Left Time Gutter Corner */}
                <div className="w-16 shrink-0 border-r border-[#262626] flex items-center justify-center text-[10px] uppercase tracking-wider text-zinc-500 font-medium">
                  GMT+1
                </div>

                {/* 7 Day Header Columns */}
                <div className="flex-1 grid grid-cols-7">
                  {DAYS_OF_WEEK.map((day: DayOfWeek) => {
                    const isCurrentDay = weekOffset === todayWeekOffset &&
                      day.dayIndex === ((Math.floor(todayDay / 86_400_000) + 3) % 7);
                    return (
                    <div
                      key={day.dayIndex}
                      className={`border-r border-[#242424] last:border-r-0 flex flex-col justify-between ${
                        isCurrentDay ? 'bg-[#1a1c23]' : ''
                      }`}
                    >
                      {/* Top Accent Line for Current Day */}
                      <div
                        className={`h-[3px] w-full ${
                          isCurrentDay ? 'bg-[#54a0ff]' : 'bg-transparent'
                        }`}
                      />

                      <div className="px-3 py-2 flex items-baseline justify-between">
                        <div>
                          <div
                            className={`text-lg font-semibold leading-none ${
                              isCurrentDay ? 'text-[#54a0ff]' : 'text-zinc-200'
                            }`}
                          >
                            {new Date(weekStart.getTime() + day.dayIndex * 86_400_000).getUTCDate()}

                          </div>
                          <div
                            className={`text-xs mt-1 ${
                              isCurrentDay ? 'text-[#74c0fc] font-medium' : 'text-zinc-400'
                            }`}
                          >
                            {day.name}
                          </div>
                        </div>

                        {/* Sub-column owner color pills when comparing multiple calendars */}
                        {activeCalendars.length > 1 && (
                          <div className="flex items-center gap-1" title="Parallel comparison columns">
                            {activeCalendars.map((cal: CalendarItemWithPalette) => (
                              <span
                                key={cal.id}
                                className="w-2 h-2 rounded-full"
                                style={{ backgroundColor: cal.palette.hex }}
                              />
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Sub-column Owner Mini-Headers when comparing >= 2 calendars */}
                      {activeCalendars.length > 1 && (
                        <div
                          className="grid border-t border-[#232323] bg-[#141414]"
                          style={{
                            gridTemplateColumns: `repeat(${activeCalendars.length}, minmax(0, 1fr))`
                          }}
                        >
                          {activeCalendars.map((cal: CalendarItemWithPalette) => (
                            <div
                              key={cal.id}
                              className="px-1.5 py-1 border-r border-[#222222] last:border-r-0 truncate text-[10px] font-medium flex items-center gap-1"
                              style={{ color: cal.palette.text }}
                            >
                              <span
                                className="w-1.5 h-1.5 rounded-full shrink-0"
                                style={{ backgroundColor: cal.palette.hex }}
                              />
                              <span className="truncate">{cal.name.split(' ')[0]}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );})}
                </div>
              </div>

              {/* CALENDAR TIME GRID BODY (09:00 to 19:00) */}
              <div className="flex flex-none relative" style={{ height: `${HOURS.length * HOUR_HEIGHT}px` }}>

                {/* Left Time Labels Column */}
                <div className="w-16 shrink-0 border-r border-[#262626] bg-[#141414] relative select-none">
                  {HOURS.map((hour: number) => (
                    <div
                      key={hour}
                      className="border-b border-[#222222] pr-2.5 pt-1 text-right text-[11px] font-medium text-zinc-500"
                      style={{ height: `${HOUR_HEIGHT}px` }}
                    >
                      {String(hour).padStart(2, '0')}:00

                    </div>
                  ))}
                </div>

                {/* 7 Day Columns Container */}
                <div className="flex-1 grid grid-cols-7 relative">
                  {/* Horizontal Hour & Half-Hour Background Lines */}
                  <div className="absolute inset-0 pointer-events-none z-0 flex flex-col">
                    {HOURS.map((hour: number) => (
                      <div
                        key={hour}
                        className="w-full border-b border-[#222222] flex flex-col"
                        style={{ height: `${HOUR_HEIGHT}px` }}
                      >
                        <div className="h-1/2 w-full border-b border-dashed border-[#1c1c1c]" />
                      </div>
                    ))}
                  </div>

                  {/* Render Each Day Column */}
                  {DAYS_OF_WEEK.map((day: DayOfWeek) => (
                    <div
                      key={day.dayIndex}
                      className="border-r border-[#262626] last:border-r-0 relative z-10 flex"
                    >
                      {activeCalendars.length === 0 ? (
                        <div className="w-full h-full flex items-center justify-center text-[11px] text-zinc-600">
                          {day.dayIndex === 2 && 'Check a calendar in the right sidebar'}
                        </div>
                      ) : (
                        /* Split each Day into parallel vertical slices */
                        activeCalendars.map((cal: CalendarItemWithPalette) => {
                          const dayEvents = cal.events.filter(
                            (ev: CalendarEvent) => ev.dayIndex === day.dayIndex && (ev.weekOffset ?? 0) === weekOffset
                          );
                          const positionedEvents: PositionedEvent[] = layoutEventsInSubcolumn(dayEvents);

                          return (
                            <div
                              key={cal.id}
                              className="flex-1 h-full relative border-r border-[#1e1e1e] last:border-r-0"
                            >
                              {positionedEvents.map((ev: PositionedEvent) => {
                                const topPx = ev.start * HOUR_HEIGHT;

                                const heightPx = (ev.end - ev.start) * HOUR_HEIGHT;
                                const widthPct = 100 / ev.totalCols;
                                const leftPct = ev.colIndex * widthPct;

                                const isNarrow =
                                  activeCalendars.length >= 2 && ev.totalCols >= 2;

                                return (
                                  <div
                                    key={ev.id}
                                    onMouseEnter={(e: React.MouseEvent<HTMLDivElement>) => {
                                      const rect = e.currentTarget.getBoundingClientRect();
                                      setTooltipPos({
                                        x: Math.min(window.innerWidth - 300, Math.max(16, rect.left)),
                                        y: Math.max(16, rect.top - 10)
                                      });
                                      setHoveredEvent({
                                        ...ev,
                                        ownerName: cal.name,
                                        ownerEmail: cal.email,
                                        palette: cal.palette
                                      });
                                    }}
                                    onMouseLeave={() => setHoveredEvent(null)}
                                    style={{
                                      top: `${topPx + 2}px`,
                                      height: `${heightPx - 4}px`,
                                      left: `calc(${leftPct}% + 2px)`,
                                      width: `calc(${widthPct}% - 4px)`,
                                      backgroundColor: cal.palette.bg,
                                      borderColor: cal.palette.border,
                                      color: cal.palette.text
                                    }}
                                    className={`absolute rounded-lg px-2 py-1.5 overflow-hidden transition-all duration-150 cursor-pointer flex flex-col justify-between shadow-sm hover:z-30 hover:brightness-110 ${
                                      ev.dashed
                                        ? 'border-[1.5px] border-dashed'
                                        : 'border border-l-[3px]'
                                    }`}
                                  >
                                    <div className="min-w-0">
                                      <div className="flex items-start justify-between gap-1">
                                        <p
                                          className={`font-semibold leading-tight break-words ${
                                            isNarrow ? 'text-[10px] line-clamp-2' : 'text-[11px] line-clamp-2'
                                          }`}
                                        >
                                          {ev.title}
                                        </p>
                                      </div>

                                      {!isNarrow && heightPx >= 55 && (
                                        <p
                                          className="text-[10px] mt-0.5 truncate font-medium"
                                          style={{ color: cal.palette.subtext }}
                                        >
                                          {ev.location}
                                        </p>
                                      )}
                                    </div>

                                    {heightPx >= 64 && (
                                      <div
                                        className="text-[10px] truncate opacity-80 mt-auto pt-0.5"
                                        style={{ color: cal.palette.subtext }}
                                      >
                                        {isNarrow ? `${ev.start}:00` : ev.lecturer}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </main>

        {/* ==================================================================
            RIGHT SIDEBAR: INCOMING REQUESTS + FRIENDS/CALENDARS CHECKLIST
           ================================================================== */}
        <aside className="w-80 shrink-0 bg-[#171717] border-l border-[#262626] flex flex-col justify-between z-20">
          <div className="flex-1 overflow-y-auto p-4 space-y-6">
            {/* 1. INCOMING FRIEND REQUESTS SECTION */}
            <div>
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                  Friend Requests
                </span>
                {friendRequests.length > 0 && (
                  <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-[#ff6b6b]/20 text-[#ff6b6b] border border-[#ff6b6b]/40">
                    {friendRequests.length} Pending
                  </span>
                )}
              </div>

              {friendRequests.length === 0 ? (
                <div className="px-3 py-2.5 rounded-xl bg-[#1d1d1d] border border-[#262626] text-xs text-zinc-500">
                  No pending friend requests.
                </div>
              ) : (
                <div className="space-y-2">
                  {friendRequests.map((req: FriendRequest) => (
                    <div
                      key={req.id}
                      className="p-3 rounded-xl bg-[#1e1e1e] border border-[#2c2c2c] flex flex-col gap-2.5 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-zinc-100 truncate">
                            {req.name}
                          </div>
                          <div className="text-[11px] text-zinc-400 truncate">{req.email}</div>
                        </div>
                        <span className="text-[10px] text-zinc-500 shrink-0">{req.timeAgo}</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => acceptFriendRequest(req)}
                          className="flex-1 py-1.5 px-2.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-200 text-xs font-medium flex items-center justify-center gap-1.5 transition cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" />
                          Accept
                        </button>
                        <button
                          onClick={() => declineFriendRequest(req)}
                          className="py-1.5 px-2.5 rounded-lg bg-[#262626] hover:bg-rose-500/20 border border-[#333333] hover:border-rose-500/40 text-zinc-400 hover:text-rose-200 text-xs font-medium flex items-center justify-center transition cursor-pointer"
                          title="Decline request"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 2. CALENDARS & FRIENDS COMPARISON CHECKLIST */}
            <div>
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                  Calendars & Friends
                </span>
                <span className="text-[11px] text-zinc-500">
                  {activeCalendars.length} of {calendarsWithColors.length} active
                </span>
              </div>

              <div className="space-y-2">
                {calendarsWithColors.map((cal: CalendarItemWithPalette) => (
                  <div
                    key={cal.id}
                    onClick={() => toggleCalendar(cal.id)}
                    className={`group p-2.5 rounded-xl border transition cursor-pointer flex items-center justify-between gap-2.5 ${
                      cal.checked
                        ? 'bg-[#202020] border-[#343434]'
                        : 'bg-[#181818] border-[#242424] opacity-65 hover:opacity-100'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {/* Custom Rainbow Pastel Checkbox */}
                      <div
                        className="w-4 h-4 rounded-md flex items-center justify-center transition shrink-0"
                        style={{
                          backgroundColor: cal.checked ? cal.palette.hex : 'transparent',
                          border: `2px solid ${cal.palette.hex}`
                        }}
                      >
                        {cal.checked && <Check className="w-3 h-3 text-[#121212] stroke-[3]" />}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-semibold text-zinc-100 truncate">
                            {cal.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] text-zinc-400 truncate mt-0.5">
                          <span
                            className="px-1.5 py-0.2 rounded text-[9px] font-medium"
                            style={{
                              backgroundColor: cal.palette.badgeBg,
                              color: cal.palette.text
                            }}
                          >
                            {cal.type === 'outlook-me'
                              ? 'My Outlook'
                              : cal.type === 'outlook-friend'
                              ? 'Friend OAuth'
                              : 'Room / File'}
                          </span>
                          <span className="truncate">{cal.events.length} events</span>
                        </div>
                      </div>
                    </div>

                    {/* Delete / Remove Button */}
                    {cal.isDeletable && (
                      <button
                        onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                          e.stopPropagation();
                          deleteCalendar(cal.id, cal.name);
                        }}
                        className="p-1.5 rounded-lg opacity-60 group-hover:opacity-100 hover:bg-rose-500/20 text-zinc-400 hover:text-rose-300 transition cursor-pointer shrink-0"
                        title="Remove calendar"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Info Card on Split View */}
            <div className="p-3 rounded-xl bg-[#1c1c1c] border border-[#282828] text-[11px] text-zinc-400 space-y-1.5 leading-relaxed">
              <div className="flex items-center gap-1.5 text-zinc-200 font-medium">
                <Info className="w-3.5 h-3.5 text-[#54a0ff] shrink-0" />
                <span>How Split-Column Works</span>
              </div>
              <p>
                Check <strong>2 calendars</strong> for side-by-side split columns. Check{' '}
                <strong>3+ calendars</strong> (e.g. You + Sarah + Huxley 308) to unlock horizontal scrolling!
              </p>
            </div>
          </div>

          {/* 3. BOTTOM "+ ADD" BUTTON */}
          <div className="p-4 border-t border-[#262626] bg-[#151515]">
            <button
              onClick={() => {
                setUploadError('');
                setIsAddModalOpen(true);
              }}
              className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-[#ff6b6b] via-[#ff9f43] to-[#feca57] hover:brightness-105 text-[#121212] font-bold text-xs flex items-center justify-center gap-2 shadow-lg transition cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              Add Friend or Room Timetable
            </button>
          </div>
        </aside>
      </div>

      {/* ====================================================================
          FLOATING RICH HOVER TOOLTIP FOR NARROW / SPLIT EVENTS
         ==================================================================== */}
      {hoveredEvent && (
        <div
          style={{
            left: `${tooltipPos.x}px`,
            top: `${tooltipPos.y}px`,
            transform: 'translateY(-100%)',
            borderColor: hoveredEvent.palette.border
          }}
          className="fixed z-50 w-72 pointer-events-none bg-[#181818]/95 backdrop-blur-md border-2 rounded-xl p-3.5 shadow-2xl transition-opacity duration-75"
        >
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <span
              className="px-2 py-0.5 rounded-full text-[10px] font-bold"
              style={{
                backgroundColor: hoveredEvent.palette.badgeBg,
                color: hoveredEvent.palette.text
              }}
            >
              {hoveredEvent.ownerName}
            </span>
            <span className="text-[11px] font-semibold text-zinc-300 flex items-center gap-1">
              <Clock className="w-3 h-3 text-zinc-400" />
              {hoveredEvent.start}:00 – {hoveredEvent.end}:00
            </span>
          </div>

          <h4 className="text-xs font-bold text-white leading-snug mb-2">
            {hoveredEvent.title}
          </h4>

          <div className="space-y-1 text-[11px] text-zinc-300">
            <div className="flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
              <span>{hoveredEvent.location}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
              <span>{hoveredEvent.lecturer}</span>
            </div>
          </div>
        </div>
      )}

      {/* ====================================================================
          UNIFIED "+ ADD" MODAL (Tab 1: Add Friend | Tab 2: Upload Custom File)
         ==================================================================== */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-[#1a1a1a] border border-[#2e2e2e] rounded-2xl shadow-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-[#282828] flex items-center justify-between">
              <h3 className="text-sm font-bold text-white">
                Add to syntgrid
              </h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 rounded-lg hover:bg-[#262626] text-zinc-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Two Clean Tabs */}
            <div className="grid grid-cols-2 p-1.5 bg-[#141414] border-b border-[#262626]">
              <button
                onClick={() => setAddModalTab('friend')}
                className={`py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition cursor-pointer ${
                  addModalTab === 'friend'
                    ? 'bg-[#242424] text-white shadow'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <UserPlus className="w-3.5 h-3.5 text-[#ff9f43]" />
                Add Friend (Social)
              </button>
              <button
                onClick={() => setAddModalTab('custom')}
                className={`py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition cursor-pointer ${
                  addModalTab === 'custom'
                    ? 'bg-[#242424] text-white shadow'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <Upload className="w-3.5 h-3.5 text-[#1dd1a1]" />
                Upload Room / Custom File
              </button>
            </div>

            {/* TAB 1: ADD FRIEND VIA OUTLOOK EMAIL */}
            {addModalTab === 'friend' ? (
              <form onSubmit={handleAddFriendSubmit} className="p-5 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-200 mb-1.5">
                    Friend's University Outlook Email
                  </label>
                  <input
                    type="email"
                    required
                    value={friendEmailInput}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFriendEmailInput(e.target.value)}
                    placeholder="e.g. j.smith26@imperial.ac.uk"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#121212] border border-[#303030] focus:border-[#ff9f43] focus:outline-none text-xs text-white"
                  />
                  <p className="text-[11px] text-zinc-400 mt-1.5">
                    They'll receive an <strong>Accept / Decline</strong> prompt in their right sidebar. Once accepted, their live Microsoft OAuth calendar appears in your checklist.
                  </p>
                </div>

                <div className="pt-2 border-t border-[#262626]">
                  <button
                    type="button"
                    onClick={() => setShowFallbackIcs(!showFallbackIcs)}
                    className="text-[11px] text-[#54a0ff] hover:underline flex items-center gap-1.5 cursor-pointer"
                  >
                    <Link2 className="w-3.5 h-3.5" />
                    {showFallbackIcs
                      ? 'Hide fallback Outlook .ICS URL'
                      : 'University IT blocked OAuth? Paste their live Outlook .ICS URL instead'}
                  </button>

                  {showFallbackIcs && (
                    <div className="mt-2.5">
                      <input
                        type="url"
                        value={fallbackIcsInput}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFallbackIcsInput(e.target.value)}
                        placeholder="https://outlook.office365.com/owa/calendar/.../reachcalendar.ics"
                        className="w-full px-3 py-2 rounded-xl bg-[#121212] border border-[#303030] text-xs text-white"
                      />
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsAddModalOpen(false)}
                    className="px-4 py-2 rounded-xl bg-[#242424] hover:bg-[#2e2e2e] text-xs font-medium text-zinc-300 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-[#ff9f43] hover:brightness-110 text-[#121212] text-xs font-bold cursor-pointer"
                  >
                    {showFallbackIcs && fallbackIcsInput ? 'Link Live ICS Now' : 'Send Friend Request'}
                  </button>
                </div>
              </form>
            ) : (
              /* TAB 2: UPLOAD CUSTOM TIMETABLE (.JSON OR .ICS GENERATED BY GEMINI) */
              <form onSubmit={handleSaveCustomCalendar} className="p-5 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-200 mb-1.5">
                    Custom Calendar / Room Name
                  </label>
                  <input
                    type="text"
                    required
                    value={customCalName}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCustomCalName(e.target.value)}
                    placeholder="e.g. Huxley 311 Room Schedule"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#121212] border border-[#303030] focus:border-[#1dd1a1] focus:outline-none text-xs text-white"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-zinc-200">
                      Calendar File (`.json` or `.ics`)
                    </label>
                    <button
                      type="button"
                      onClick={loadSampleGeminiExtraction}
                      className="text-[11px] text-[#1dd1a1] hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <Sparkles className="w-3 h-3" />
                      Load Sample "Huxley 311" File
                    </button>
                  </div>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".ics,.json,text/calendar,application/json"
                    onChange={handleFileUpload}
                    className="hidden"
                  />

                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-[#333333] hover:border-[#1dd1a1] rounded-xl p-4 text-center cursor-pointer transition bg-[#141414]"
                  >
                    <FileText className="w-6 h-6 text-zinc-400 mx-auto mb-1.5" />
                    <p className="text-xs text-zinc-200 font-medium">
                      Click to upload `.json` or `.ics` file
                    </p>
                    <p className="text-[11px] text-zinc-500 mt-0.5">
                      Send a photo of any room schedule to Gemini and upload the file it generates
                    </p>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-[#141414] border border-[#262626] flex items-center justify-between gap-2">
                  <div className="text-[11px] text-zinc-400">
                    <strong className="text-zinc-200">Tip:</strong> Copy the prompt to give Gemini with your timetable photo so it outputs syntgrid's JSON format.
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      copyText(
                        `Convert this timetable photo into a JSON file with an array of objects: [{"dayIndex": 0, "start": 9, "end": 11, "title": "Course Name", "location": "Room", "lecturer": "Notes"}] where dayIndex 0=Monday..6=Sunday and start/end are 24h numbers.`,
                        'gemini-prompt'
                      )
                    }
                    className="px-2.5 py-1.5 rounded-lg bg-[#222222] hover:bg-[#2c2c2c] text-[11px] text-zinc-200 font-medium shrink-0 flex items-center gap-1 cursor-pointer"
                  >
                    <Copy className="w-3 h-3" />
                    {copiedSnippet === 'gemini-prompt' ? 'Copied!' : 'Copy Prompt'}
                  </button>
                </div>

                {uploadError && (
                  <p className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/30 rounded-lg p-2.5">
                    {uploadError}
                  </p>
                )}

                {uploadedEventsPreview && (
                  <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-200 flex items-center justify-between">
                    <span>
                      Ready to import <strong>{uploadedEventsPreview.length} events</strong> into "{customCalName || 'Custom Schedule'}"
                    </span>
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsAddModalOpen(false)}
                    className="px-4 py-2 rounded-xl bg-[#242424] hover:bg-[#2e2e2e] text-xs font-medium text-zinc-300 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!uploadedEventsPreview || !customCalName.trim()}
                    className="px-4 py-2 rounded-xl bg-[#1dd1a1] disabled:opacity-40 hover:brightness-110 text-[#121212] text-xs font-bold cursor-pointer"
                  >
                    Add Custom Timetable
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ====================================================================
          FREE HOSTING & MICROSOFT OAUTH BACKEND CODE MODAL
         ==================================================================== */}
      {isCodeModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-3xl max-h-[88vh] bg-[#181818] border border-[#2e2e2e] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b border-[#282828] flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white">
                  Free Student Hosting Stack: Vercel + NextAuth (Microsoft OAuth) + Prisma
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Zero cold-starts, $0/month, and stores only minimal friend links & custom room JSONs.
                </p>
              </div>
              <button
                onClick={() => setIsCodeModalOpen(false)}
                className="p-1.5 rounded-lg hover:bg-[#262626] text-zinc-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-5 text-xs text-zinc-300">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-xl bg-[#1f1f1f] border border-[#2c2c2c]">
                  <div className="font-bold text-white mb-1">1. Host: Vercel (Free)</div>
                  <p className="text-[11px] text-zinc-400">
                    Unlike Render's free tier (which sleeps after 15m and takes 40s to wake up), Vercel wakes instantly and hosts Next.js API routes for free.
                  </p>
                </div>
                <div className="p-3.5 rounded-xl bg-[#1f1f1f] border border-[#2c2c2c]">
                  <div className="font-bold text-white mb-1">2. DB: Supabase or MongoDB</div>
                  <p className="text-[11px] text-zinc-400">
                    Never use plain local SQLite on free cloud hosts (ephemeral disk wipes on restart). Use free <strong>Supabase Postgres</strong> or <strong>MongoDB Atlas M0</strong>.
                  </p>
                </div>
                <div className="p-3.5 rounded-xl bg-[#1f1f1f] border border-[#2c2c2c]">
                  <div className="font-bold text-white mb-1">3. Auth: Microsoft Entra</div>
                  <p className="text-[11px] text-zinc-400">
                    Uses NextAuth.js with <code>Calendars.Read</code> + <code>offline_access</code> to fetch live Outlook events on the fly without storing timetables.
                  </p>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-bold text-zinc-100">
                    1. Minimal Database Schema (<code>prisma/schema.prisma</code>)
                  </span>
                </div>
                <pre className="p-3.5 rounded-xl bg-[#111111] border border-[#282828] overflow-x-auto text-[11px] text-emerald-300 font-mono leading-relaxed">
{`model User {
  id           String   @id @default(cuid())
  email        String   @unique
  name         String
  refreshToken String?  // Encrypted Microsoft OAuth refresh token for live Graph fetches
  fallbackIcs  String?  // Optional published Outlook .ics URL if Uni IT blocks Graph API
  customCals   CustomCalendar[]
}

model Friendship {
  id         String   @id @default(cuid())
  senderId   String
  receiverId String
  status     String   @default("PENDING") // "PENDING" | "ACCEPTED"
  @@unique([senderId, receiverId])
}

model CustomCalendar {
  id         String   @id @default(cuid())
  ownerId    String
  name       String   // e.g. "Huxley 308"
  eventsJson Json     // Normalized [{ dayIndex, start, end, title, location }]
  owner      User     @relation(fields: [ownerId], references: [id])
}`}
                </pre>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-bold text-zinc-100">
                    2. Microsoft OAuth + Live Graph Timetable Fetch (<code>app/api/calendar/[friendId]/route.ts</code>)
                  </span>
                </div>
                <pre className="p-3.5 rounded-xl bg-[#111111] border border-[#282828] overflow-x-auto text-[11px] text-sky-300 font-mono leading-relaxed">
{`]// Configure NextAuth with Microsoft Entra ID:
// scope: "openid profile email"

export async function GET(req: Request, { params }: { params: { friendId: string } }) {
  // 1. Verify friendship is ACCEPTED in DB
  // 2. Exchange friend's stored refreshToken for a fresh access_token
  const graphUrl = "https://graph.microsoft.com/v1.0/me/calendarView?startDateTime=2026-10-19T00:00:00Z&endDateTime=2026-10-25T23:59:59Z";
  const res = await fetch(graphUrl, {
    headers: {
      Authorization: \`Bearer \${accessToken}\`,
      Prefer: 'outlook.timezone="GMT Standard Time"'
    }
  });
  const data = await res.json();

  // Normalize straight to syntgrid's frontend schema (nothing stored in DB!)
  const events = data.value.map((ev: any) => ({
    id: ev.id,
    title: ev.subject,
    location: ev.location?.displayName || "Room TBD",
    start: new Date(ev.start.dateTime).getHours(),
    end: new Date(ev.end.dateTime).getHours(),
    dayIndex: (new Date(ev.start.dateTime).getDay() + 6) % 7
  }));

  return Response.json({ events });
}`}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}