'use client';

import Image from 'next/image';
import { useSession, signIn, signOut } from 'next-auth/react';
import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import AISchedulerModal, { ImportedScheduleEvent } from './components/AISchedulerModal';
import { serializeSchedule } from '@/lib/serializeSchedule';
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
  Clock,
  MapPin,
  User,
  LogOut,
  FileText,
  Copy,
  CheckCircle2,
  Pencil
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
  color?: string;
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
  ownerName?: string;
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

interface FriendProfile {
  email: string;
  name: string;
  image: string | null;
}

interface FriendGroup {
  id: string;
  name: string;
  friendEmails: string[];
  isActive: boolean;
}

interface SelectionCache {
  calendarChecked: Record<string, boolean>;
  groupActive: Record<string, boolean>;
}

interface CalendarPanState {
  pointerId: number;
  startX: number;
  startY: number;
  startScrollLeft: number;
  startScrollTop: number;
  hasMoved: boolean;
}

interface EventResizeState {
  eventId: string;
  edge: 'start' | 'end';
  pointerY: number;
  originalStart: number;
  originalEnd: number;
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

const AI_CATEGORY_PALETTES: Record<string, Palette> = {
  STUDY: RAINBOW_PALETTE[4],
  SLEEP: RAINBOW_PALETTE[5],
  MEAL: RAINBOW_PALETTE[1],
  GYM: RAINBOW_PALETTE[3],
  PERSONAL: RAINBOW_PALETTE[0]
};

function getEventPalette(event: CalendarEvent, fallback: Palette): Palette {
  return AI_CATEGORY_PALETTES[event.category.trim().toUpperCase()] ?? fallback;
}



// ============================================================================
// INITIAL PRE-LOADED CALENDARS (Matching your Imperial screenshot + Friends)
// ============================================================================
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

const SELECTION_CACHE_PREFIX = 'syntgrid-selection-cache:';

function getSelectionCache(accountEmail: string): SelectionCache | null {
  try {
    const stored = window.localStorage.getItem(
      `${SELECTION_CACHE_PREFIX}${accountEmail.toLowerCase()}`
    );
    if (!stored) return null;
    const parsed: unknown = JSON.parse(stored);
    if (!parsed || typeof parsed !== 'object') return null;
    const cache = parsed as Partial<SelectionCache>;
    if (
      !cache.calendarChecked ||
      typeof cache.calendarChecked !== 'object' ||
      !cache.groupActive ||
      typeof cache.groupActive !== 'object'
    ) {
      return null;
    }
    return {
      calendarChecked: cache.calendarChecked as Record<string, boolean>,
      groupActive: cache.groupActive as Record<string, boolean>
    };
  } catch (error) {
    console.warn('Could not read saved calendar selections.', error);
    return null;
  }
}

function saveSelectionCache(accountEmail: string, calendars: CalendarItem[], groups: FriendGroup[]) {
  try {
    window.localStorage.setItem(
      `${SELECTION_CACHE_PREFIX}${accountEmail.toLowerCase()}`,
      JSON.stringify({
        calendarChecked: Object.fromEntries(
          calendars.map((calendar) => [calendar.id, calendar.checked])
        ),
        groupActive: Object.fromEntries(groups.map((group) => [group.id, group.isActive]))
      } satisfies SelectionCache)
    );
  } catch (error) {
    console.warn('Could not save calendar selections.', error);
  }

}

function uniqueCalendarEvents(events: CalendarEvent[]): CalendarEvent[] {
  const seen = new Set<string>();
  return events.filter((event) => {
    if (seen.has(event.id)) return false;
    seen.add(event.id);
    return true;
  });
}

function calendarEventToScheduleEvent(event: CalendarEvent): { title: string; startTime: string; endTime: string } {
  const day = new Date(BASE_WEEK_START_UTC + ((event.weekOffset ?? 0) * 7 + event.dayIndex) * 86_400_000);
  const start = new Date(day.getTime() + event.start * 3_600_000);
  const end = new Date(day.getTime() + event.end * 3_600_000);
  return { title: event.title, startTime: start.toISOString(), endTime: end.toISOString() };
}

// ============================================================================
// HELPER: PARSE UPLOADED .ICS OR .JSON FILES (FROM GEMINI PHOTO CONVERSION)
// ============================================================================
// ============================================================================
// HELPER: PARSE UPLOADED .ICS OR .JSON FILES (WITH PROPER DATE/WEEK MAPPING)
// ============================================================================

type ImportedCalendarEvent = CalendarEvent & { weekOffset: number };

async function readApiResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  let data: unknown;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    const excerpt = text.slice(0, 200).replace(/\s+/g, ' ').trim();
    throw new Error(
      response.ok
        ? `Server returned a non-JSON response (HTTP ${response.status}). ${excerpt}`
        : `Request failed (HTTP ${response.status}); the server returned an invalid response. ${excerpt}`
    );
  }

  if (!response.ok) {
    const message =
      data && typeof data === 'object' && 'error' in data && typeof data.error === 'string'
        ? data.error
        : `Request failed (HTTP ${response.status}).`;
    throw new Error(message);
  }
  if (data === null) {
    throw new Error(`Server returned an empty response (HTTP ${response.status}).`);
  }
  return data as T;
}

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
    return items.map((item: unknown, index): ImportedCalendarEvent => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        throw new Error('Each JSON event must be an object.');
      }
      const event = item as Record<string, unknown>;
      const numberField = (key: string, fallback: number) => {
        const value = Number(event[key] ?? fallback);
        if (!Number.isFinite(value)) throw new Error(`Event ${key} must be a number.`);
        return value;
      };
      const stringField = (key: string, fallback: string) =>
        typeof event[key] === 'string' ? event[key] : fallback;
      return {
        id: `${idPrefix}-${index}`,
        dayIndex: numberField('dayIndex', 0),
        weekOffset: numberField('weekOffset', 0),
        start: numberField('start', 10),
        end: numberField('end', 11),
        title: stringField('title', 'Untitled Session'),
        location: stringField('location', ''),
        lecturer: stringField('lecturer', 'Uploaded Schedule'),
        category: stringField('category', 'Custom')
      };
    });
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
          location: value('LOCATION'),
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
  const [authProviders, setAuthProviders] = useState<{ id: string; name: string }[] | null>(null);
  const [authProviderError, setAuthProviderError] = useState('');

  // 1. Initialize empty states here
  const [calendars, setCalendars] = useState<CalendarItem[]>([]);
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
  const [loadedAccountEmail, setLoadedAccountEmail] = useState<string | null>(null);
  const [friendGroups, setFriendGroups] = useState<FriendGroup[]>([]);
  const [isCreatingFriendGroup, setIsCreatingFriendGroup] = useState(false);
  const [newFriendGroupName, setNewFriendGroupName] = useState('');
  const [draggingFriendEmail, setDraggingFriendEmail] = useState<string | null>(null);
  const [isPersonalCalendarEditorOpen, setIsPersonalCalendarEditorOpen] = useState(false);
  const [editingPersonalEvents, setEditingPersonalEvents] = useState<CalendarEvent[]>([]);
  const [originalPersonalEvents, setOriginalPersonalEvents] = useState<CalendarEvent[]>([]);
  const [isSavingPersonalCalendar, setIsSavingPersonalCalendar] = useState(false);
  const calendarPanRef = useRef<CalendarPanState | null>(null);
  const calendarScrollRef = useRef<HTMLDivElement | null>(null);
  const calendarsRef = useRef<CalendarItem[]>([]);
  const calendarSaveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const eventDropInProgressRef = useRef(false);
  const hasInitialCalendarFocus = useRef(false);
  const hasInitialTodayFocus = useRef(false);
  const [eventDetails, setEventDetails] = useState<CalendarEvent | null>(null);
  const [isSavingEventDetails, setIsSavingEventDetails] = useState(false);
  const [eventResize, setEventResize] = useState<EventResizeState | null>(null);
  const [isPanningCalendar, setIsPanningCalendar] = useState(false);

  // Rest of your state and handlers...
  // Week offset state
  const [weekOffset, setWeekOffset] = useState<number>(0);

  const weekStart = new Date(BASE_WEEK_START_UTC + weekOffset * 7 * 86_400_000);
  const weekEnd = new Date(weekStart.getTime() + 6 * 86_400_000);
  const dateLabel = new Intl.DateTimeFormat('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC'
  });
  const [currentTime, setCurrentTime] = useState<Date | null>(null);
  const todayDay = currentTime
    ? Date.UTC(currentTime.getFullYear(), currentTime.getMonth(), currentTime.getDate())
    : BASE_WEEK_START_UTC;
  const todayWeekOffset = Math.floor((todayDay - BASE_WEEK_START_UTC) / (7 * 86_400_000));
  const todayDayIndex = (new Date(todayDay).getUTCDay() + 6) % 7;

  useEffect(() => {
    const updateCurrentTime = () => {
      const now = new Date();
      setCurrentTime(now);
      if (!hasInitialTodayFocus.current) {
        const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
        setWeekOffset(Math.floor((today - BASE_WEEK_START_UTC) / (7 * 86_400_000)));
        hasInitialTodayFocus.current = true;
      }
    };
    updateCurrentTime();
    const intervalId = window.setInterval(updateCurrentTime, 30_000);
    return () => window.clearInterval(intervalId);
  }, []);
  const localTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const localTimeZoneAbbreviation = currentTime
    ? new Intl.DateTimeFormat(undefined, { timeZoneName: 'short' })
        .formatToParts(currentTime)
        .find((part) => part.type === 'timeZoneName')?.value ?? 'Local'
    : 'Local';
  const currentTimePosition = currentTime
    ? (currentTime.getHours() + currentTime.getMinutes() / 60 + currentTime.getSeconds() / 3600) *
      HOUR_HEIGHT
    : null;
  const currentTimeLabel = currentTime
    ? `${new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(currentTime)} ${localTimeZoneAbbreviation}`
    : null;
  // Hover tooltip state
  const [hoveredEvent, setHoveredEvent] = useState<HoveredEventInfo | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Unified "+ Add" Modal state
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [addModalTab, setAddModalTab] = useState<'friend' | 'custom'>('friend');
  const [friendEmailInput, setFriendEmailInput] = useState<string>('');
  const [friendProfileSuggestions, setFriendProfileSuggestions] = useState<FriendProfile[]>([]);
  const [isSearchingFriendProfiles, setIsSearchingFriendProfiles] = useState(false);
  const [friendProfileSearchError, setFriendProfileSearchError] = useState('');
  const [isFriendProfileDropdownOpen, setIsFriendProfileDropdownOpen] = useState(false);

  // Custom Timetable Upload state
  const [customCalName, setCustomCalName] = useState<string>('');
  const [uploadedEventsPreview, setUploadedEventsPreview] = useState<CalendarEvent[] | null>(null);
  const [uploadedFileContent, setUploadedFileContent] = useState<string>('');
  const [uploadedFileIsIcs, setUploadedFileIsIcs] = useState(false);
  const [uploadDestination, setUploadDestination] = useState<'personal' | 'extra'>('personal');
  const [uploadError, setUploadError] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [isCodeModalOpen, setIsCodeModalOpen] = useState<boolean>(false);
  const [isTutorialOpen, setIsTutorialOpen] = useState(false);
  const [copiedSnippet, setCopiedSnippet] = useState<string>('');

  // Status Banner Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  useEffect(() => {
    if (status !== 'unauthenticated') return;
    const controller = new AbortController();
    fetch('/api/auth/providers', { signal: controller.signal })
      .then((response) => readApiResponse<Record<string, { id: string; name: string }>>(response))
      .then((providers) => setAuthProviders(Object.values(providers)))
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setAuthProviderError(
            error instanceof Error ? error.message : 'Could not check sign-in provider configuration.'
          );
        }
      });
    return () => controller.abort();
  }, [status]);

  useEffect(() => {
    const query = friendEmailInput.trim();
    if (
      !isAddModalOpen ||
      addModalTab !== 'friend' ||
      !isFriendProfileDropdownOpen ||
      query.length < 2
    ) {
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      setIsSearchingFriendProfiles(true);
      setFriendProfileSearchError('');
      fetch(`/api/friends/search?q=${encodeURIComponent(query)}`, { signal: controller.signal })
        .then((response) => readApiResponse<{ profiles: FriendProfile[] }>(response))
        .then((data) => setFriendProfileSuggestions(data.profiles))
        .catch((error: unknown) => {
          if (!controller.signal.aborted) {
            setFriendProfileSuggestions([]);
            setFriendProfileSearchError(
              error instanceof Error ? error.message : 'Could not search profiles.'
            );
          }
        })
        .finally(() => {
          if (!controller.signal.aborted) setIsSearchingFriendProfiles(false);
        });
    }, 250);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [
    addModalTab,
    friendEmailInput,
    isAddModalOpen,
    isFriendProfileDropdownOpen
  ]);

  useEffect(() => {
    if (status !== 'authenticated' || !session?.user?.email) return;
    const accountEmail = session.user.email;
    const controller = new AbortController();

    const loadAccountCalendars = async () => {
      const ownResponse = await fetch('/api/calendar', { signal: controller.signal });
      const ownData = await readApiResponse<{
        name: string;
        ownerName: string;
        events: CalendarEvent[];
      }>(ownResponse);
      const ownCalendar: CalendarItem = {
        id: 'cal-me',
        name: ownData.name,
        ownerName: ownData.ownerName,
        email: session.user?.email || '',
        type: 'outlook-me',
        checked: true,
        isDeletable: false,
        lastSynced: ownData.events.length ? 'Saved personal .ics calendar' : 'Upload your Imperial .ics file',
        events: uniqueCalendarEvents(ownData.events)
      };
      const friendsResponse = await fetch('/api/friends', { signal: controller.signal });
      const friendsData = await readApiResponse<{
        requests: { id: string; email: string; name: string }[];
        friends: { email: string; name: string }[];
      }>(friendsResponse);
      const groupsResponse = await fetch('/api/friend-groups', { signal: controller.signal });
      const groupsData = await readApiResponse<{ groups: FriendGroup[] }>(groupsResponse);
      const pendingRequests: FriendRequest[] = friendsData.requests.map(
        (request: { id: string; email: string; name: string }) => ({
          ...request,
          timeAgo: 'Pending',
          events: []
        })
      );
      const friendCalendars = await Promise.all(
        friendsData.friends.map(async (friend: { email: string; name: string }) => {
          const response = await fetch(
            `/api/calendar/shared/${encodeURIComponent(friend.email)}`,
            { signal: controller.signal }
          );
          const data = await readApiResponse<{
            name: string;
            ownerName: string;
            email: string;
            events: CalendarEvent[];
          }>(response);
          return {
            id: `cal-friend-${friend.email}`,
            name: data.name,
            ownerName: data.ownerName,
            email: friend.email,
            type: 'outlook-friend' as const,
            checked: true,
            isDeletable: true,
            lastSynced: 'Shared personal calendar',
            events: data.events
          };
        })
      );
      const inactiveFriendEmails = new Set(
        groupsData.groups
          .filter((group) => !group.isActive)
          .flatMap((group) => group.friendEmails)
      );
      friendCalendars.forEach((calendar) => {
        if (inactiveFriendEmails.has(calendar.email.toLowerCase())) calendar.checked = false;
      });
      const extrasResponse = await fetch('/api/calendar/extra', { signal: controller.signal });
      const extrasData = await readApiResponse<{
        calendars: { id: string; name: string; events: CalendarEvent[] }[];
      }>(extrasResponse);
      const extraCalendars: CalendarItem[] = extrasData.calendars.map((calendar) => ({
        id: calendar.id,
        name: calendar.name,
        ownerName: session.user?.name || session.user?.email || undefined,
        email: 'Private extra calendar',
        type: 'custom-file',
        checked: true,
        isDeletable: true,
        lastSynced: 'Private to your account',
        events: calendar.events
      }));
      const savedSelections = getSelectionCache(accountEmail);
      const savedCalendarChecked = savedSelections?.calendarChecked ?? {};
      const savedGroupActive = savedSelections?.groupActive ?? {};
      const savedGroups = groupsData.groups.map((group) => ({
        ...group,
        isActive: typeof savedGroupActive[group.id] === 'boolean'
          ? savedGroupActive[group.id]
          : group.isActive
      }));
      const savedCalendars = [ownCalendar, ...extraCalendars, ...friendCalendars].map((calendar) => ({
        ...calendar,
        checked: typeof savedCalendarChecked[calendar.id] === 'boolean'
          ? savedCalendarChecked[calendar.id]
          : calendar.checked
      }));

      setFriendRequests(pendingRequests);
      setFriendGroups(savedGroups);
      setCalendars((previous) => [
        ...savedCalendars,
        ...previous.filter((calendar) =>
          calendar.type !== 'outlook-me' &&
          calendar.type !== 'outlook-friend' &&
          calendar.type !== 'custom-file'
        ),
      ]);
    };

    loadAccountCalendars().catch((error: unknown) => {
      if (controller.signal.aborted) return;
      showToast(error instanceof Error ? error.message : 'Could not load calendar data.');
    }).finally(() => {
      if (!controller.signal.aborted) setLoadedAccountEmail(accountEmail);
    });
    return () => controller.abort();
  }, [session?.user?.email, session?.user?.name, status]);

  useEffect(() => {
    if (!loadedAccountEmail || calendars.length === 0) return;
    saveSelectionCache(loadedAccountEmail, calendars, friendGroups);
  }, [calendars, friendGroups, loadedAccountEmail]);

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

  const existingScheduleText = serializeSchedule(
    weekStart.toISOString(),
    activeCalendars.flatMap((calendar) => calendar.events).map(calendarEventToScheduleEvent),
    []
  );

  useEffect(() => {
    if (!loadedAccountEmail || !currentTime || calendars.length === 0 || hasInitialCalendarFocus.current) {
      return;
    }

    const todayWeek = todayWeekOffset;
    if (weekOffset !== todayWeek) return;

    const earliestTodayEvent = activeCalendars
      .flatMap((calendar) => calendar.events)
      .filter((event) =>
        event.dayIndex === todayDayIndex && (event.weekOffset ?? 0) === todayWeek
      )
      .reduce<number | null>(
        (earliest, event) => earliest === null ? event.start : Math.min(earliest, event.start),
        null
      );
    const earliestWeekEvent = activeCalendars
      .flatMap((calendar) => calendar.events)
      .filter((event) => (event.weekOffset ?? 0) === todayWeek)
      .reduce<number | null>(
        (earliest, event) => earliest === null ? event.start : Math.min(earliest, event.start),
        null
      );
    const earliestEvent = earliestTodayEvent ?? earliestWeekEvent;
    const scrollTop = (earliestEvent ?? 9) * HOUR_HEIGHT;
    const scrollContainer = calendarScrollRef.current;
    if (!scrollContainer) return;

    scrollContainer.scrollTo({ top: scrollTop, behavior: 'auto' });
    hasInitialCalendarFocus.current = true;
  }, [
    activeCalendars,
    calendars.length,
    currentTime,
    loadedAccountEmail,
    todayDayIndex,
    todayWeekOffset,
    weekOffset
  ]);

  // Horizontal scroll rule: active when > 2 calendars are checked
  const isHorizontalScrollMode = activeCalendars.length > 1;

  // Toggle a calendar checkbox
  const toggleCalendar = (id: string) => {
    setCalendars((prev) =>
      prev.map((c) => (c.id === id ? { ...c, checked: !c.checked } : c))
    );
  };

  const startCalendarPan = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.detail > 1) {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      calendarPanRef.current = null;
      setIsPanningCalendar(false);
      return;
    }
    if (event.button !== 0 || event.target instanceof Element &&
      event.target.closest('button, a, input, select, textarea, [role="button"], [data-calendar-event]')) {
      return;
    }

    const scrollContainer = event.currentTarget;
    calendarPanRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startScrollLeft: scrollContainer.scrollLeft,
      startScrollTop: scrollContainer.scrollTop,
      hasMoved: false
    };
    scrollContainer.setPointerCapture(event.pointerId);
    setIsPanningCalendar(true);
    event.preventDefault();
  };

  const panCalendar = (event: React.PointerEvent<HTMLDivElement>) => {
    const pan = calendarPanRef.current;
    if (!pan || pan.pointerId !== event.pointerId) return;

    const deltaX = event.clientX - pan.startX;
    const deltaY = event.clientY - pan.startY;
    if (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3) pan.hasMoved = true;
    if (!pan.hasMoved) return;

    event.currentTarget.scrollLeft = pan.startScrollLeft - deltaX;
    event.currentTarget.scrollTop = pan.startScrollTop - deltaY;
  };

  const stopCalendarPan = (event: React.PointerEvent<HTMLDivElement>) => {
    if (calendarPanRef.current?.pointerId !== event.pointerId) return;
    calendarPanRef.current = null;
    setIsPanningCalendar(false);
  };

  const createFriendGroup = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = newFriendGroupName.trim();
    if (!name) return;
    try {
      const response = await fetch('/api/friend-groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      });
      const data = await readApiResponse<{ group: FriendGroup }>(response);
      setFriendGroups((groups) => [...groups, data.group].sort((a, b) => a.name.localeCompare(b.name)));
      setNewFriendGroupName('');
      setIsCreatingFriendGroup(false);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not create friend group.');
    }
  };

  const toggleFriendInGroup = async (group: FriendGroup, friendEmail: string) => {
    const normalizedEmail = friendEmail.trim().toLowerCase();
    const isMember = group.friendEmails.includes(normalizedEmail);
    const friendEmails = isMember
      ? group.friendEmails.filter((email) => email !== normalizedEmail)
      : [...group.friendEmails, normalizedEmail];
    try {
      const response = await fetch(`/api/friend-groups/${encodeURIComponent(group.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ friendEmails })
      });
      const data = await readApiResponse<{ group: FriendGroup }>(response);
      setFriendGroups((groups) =>
        groups.map((item) => item.id === group.id ? data.group : item)
      );
      setCalendars((items) => items.map((calendar) =>
        calendar.type === 'outlook-friend' &&
        calendar.email.toLowerCase() === normalizedEmail
          ? {
              ...calendar,
              checked: isMember ? calendar.checked : data.group.isActive
            }
          : calendar
      ));
      showToast(
        isMember
          ? `Removed ${normalizedEmail} from "${group.name}".`
          : `Added ${normalizedEmail} to "${group.name}".`
      );
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not add friend to group.');
    }
  };

  const toggleFriendGroup = async (group: FriendGroup) => {
    const isActive = !group.isActive;
    try {
      const response = await fetch(`/api/friend-groups/${encodeURIComponent(group.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive })
      });
      const data = await readApiResponse<{ group: FriendGroup }>(response);
      const memberEmails = new Set(data.group.friendEmails.map((email) => email.toLowerCase()));
      setFriendGroups((groups) =>
        groups.map((item) => item.id === group.id ? data.group : item)
      );
      setCalendars((items) => items.map((calendar) =>
        calendar.type === 'outlook-friend' && memberEmails.has(calendar.email.toLowerCase())
          ? { ...calendar, checked: isActive }
          : calendar
      ));
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not update friend group.');
    }
  };

  const deleteFriendGroup = async (group: FriendGroup) => {
    try {
      const response = await fetch(`/api/friend-groups/${encodeURIComponent(group.id)}`, {
        method: 'DELETE'
      });
      await readApiResponse<{ ok: boolean }>(response);
      setFriendGroups((groups) => groups.filter((item) => item.id !== group.id));
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not delete friend group.');
    }
  };

  // Delete a friend/custom calendar
  const deleteCalendar = async (calendar: CalendarItem) => {
    if (calendar.type === 'outlook-friend') {
      try {
        const response = await fetch(`/api/friends/${encodeURIComponent(calendar.email)}`, {
          method: 'DELETE'
        });
        await readApiResponse<{ ok: boolean }>(response);
      } catch (error) {
        showToast(error instanceof Error ? error.message : 'Could not remove this friend.');
        return;
      }
    } else if (calendar.type === 'custom-file') {
      try {
        const response = await fetch(`/api/calendar/extra/${encodeURIComponent(calendar.id)}`, {
          method: 'DELETE'
        });
        await readApiResponse<{ ok: boolean }>(response);
      } catch (error) {
        showToast(error instanceof Error ? error.message : 'Could not delete this extra calendar.');
        return;
      }
    }
    setCalendars((prev) => prev.filter((item) => item.id !== calendar.id));
    showToast(`Removed "${calendar.name}" from your calendars.`);
  };

  // Accept incoming friend request
  const acceptFriendRequest = async (req: FriendRequest) => {
    try {
      const response = await fetch(`/api/friends/${encodeURIComponent(req.email)}`, {
        method: 'PATCH'
      });
      await readApiResponse<{ ok: boolean }>(response);
      const calendarResponse = await fetch(
        `/api/calendar/shared/${encodeURIComponent(req.email)}`
      );
      const calendar = await readApiResponse<{
        name: string;
        ownerName: string;
        email: string;
        events: CalendarEvent[];
      }>(calendarResponse);
      setFriendRequests((previous) => previous.filter((request) => request.id !== req.id));
      setCalendars((previous) => [
        ...previous,
        {
          id: `cal-friend-${req.email}`,
          name: calendar.name,
          ownerName: calendar.ownerName,
          email: req.email,
          type: 'outlook-friend',
          checked: true,
          isDeletable: true,
          lastSynced: 'Shared personal calendar',
          events: calendar.events
        }
      ]);
      showToast(`Accepted ${req.name}'s calendar share.`);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not accept this request.');
    }
  };

  // Decline incoming friend request
  const declineFriendRequest = async (req: FriendRequest) => {
    try {
      const response = await fetch(`/api/friends/${encodeURIComponent(req.email)}`, {
        method: 'DELETE'
      });
      await readApiResponse<{ ok: boolean }>(response);
      setFriendRequests((prev) => prev.filter((request) => request.id !== req.id));
      showToast(`Declined request from ${req.email}`);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not decline this request.');
    }
  };

  // Send a request to share personal calendars.
  const handleAddFriendSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!friendEmailInput.trim()) return;
    const cleanEmail = friendEmailInput.trim().toLowerCase();
    try {
      const response = await fetch('/api/friends', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail })
      });
      await readApiResponse<{ ok: boolean }>(response);
      showToast(`Calendar share request sent to ${cleanEmail}.`);
      setFriendEmailInput('');
      setFriendProfileSuggestions([]);
      setIsFriendProfileDropdownOpen(false);
      setIsAddModalOpen(false);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not send this request.');
    }
  };

  // Handle uploading .ics or .json file
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError('');
    setUploadedEventsPreview(null);
    setUploadedFileContent('');
    setUploadedFileIsIcs(false);
    setUploadDestination('personal');
    if (file.size > 1_000_000) {
      setUploadError('Calendar files must be smaller than 1 MB.');
      return;
    }

    if (!customCalName.trim()) {
      setCustomCalName(file.name.replace(/\.(ics|json)$/i, ''));
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const textContent = (event.target?.result as string) || '';
        const parsedEvents = parseCalendarFileContent(textContent, file.name);
        setUploadedEventsPreview(parsedEvents);
        setUploadedFileContent(textContent);
        const isIcs = /\.ics$/i.test(file.name);
        setUploadedFileIsIcs(isIcs);
        setUploadDestination(isIcs ? 'personal' : 'extra');
      } catch (err: unknown) {
        setUploadError(err instanceof Error ? err.message : 'Invalid calendar file format.');
      }
    };
    reader.readAsText(file);
  };

  const handleSaveCustomCalendar = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!customCalName.trim() || !uploadedEventsPreview) return;

    if (uploadedFileIsIcs && uploadDestination === 'personal') {
      try {
        const response = await fetch('/api/calendar', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: customCalName.trim(),
            ics: uploadedFileContent,
            events: uploadedEventsPreview.map((event) => ({
              ...event,
              weekOffset: event.weekOffset ?? 0
            }))
          })
        });
        await readApiResponse<{ name: string }>(response);
        const personalCalendar: CalendarItem = {
          id: 'cal-me',
          name: customCalName.trim(),
          ownerName: session?.user?.name || session?.user?.email || undefined,
          email: session?.user?.email || '',
          type: 'outlook-me',
          checked: true,
          isDeletable: false,
          lastSynced: 'Saved personal .ics calendar',
          events: uploadedEventsPreview
        };
        setCalendars((previous) => [
          personalCalendar,
          ...previous.filter((calendar) => calendar.id !== 'cal-me')
        ]);
        setCustomCalName('');
        setUploadedEventsPreview(null);
        setUploadedFileContent('');
        setUploadedFileIsIcs(false);
        setUploadDestination('personal');
        setIsAddModalOpen(false);
        showToast(`Saved "${personalCalendar.name}" as your personal calendar.`);
      } catch (error) {
        setUploadError(error instanceof Error ? error.message : 'Could not save your calendar.');
      }
      return;
    }

    try {
      const response = await fetch('/api/calendar/extra', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: customCalName.trim(),
          events: uploadedEventsPreview.map((event) => ({
            ...event,
            weekOffset: event.weekOffset ?? 0
          })),
          ...(uploadedFileIsIcs ? { ics: uploadedFileContent } : {})
        })
      });
      const savedCalendar = await readApiResponse<{ id: string; name: string }>(response);
      const extraCalendar: CalendarItem = {
        id: savedCalendar.id,
        name: savedCalendar.name,
        ownerName: session?.user?.name || session?.user?.email || undefined,
        email: 'Private extra calendar',
        type: 'custom-file',
        checked: true,
        isDeletable: true,
        lastSynced: 'Private to your account',
        events: uploadedEventsPreview
      };
      setCalendars((previous) => [...previous, extraCalendar]);
      setCustomCalName('');
      setUploadedEventsPreview(null);
      setUploadedFileContent('');
      setUploadedFileIsIcs(false);
      setUploadDestination('personal');
      setIsAddModalOpen(false);
      showToast(`Added "${extraCalendar.name}" as a private extra calendar.`);
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'Could not save your extra calendar.');
    }
  };

  const updatePersonalEvent = (
    id: string,
    field: 'dayIndex' | 'weekOffset' | 'start' | 'end' | 'title' | 'location' | 'lecturer',
    value: string
  ) => {
    setEditingPersonalEvents((events) => events.map((event) => {
      if (event.id !== id) return event;
      if (field === 'dayIndex' || field === 'weekOffset' || field === 'start' || field === 'end') {
        return { ...event, [field]: Number(value) };
      }
      return { ...event, [field]: value };
    }));
  };

  const savePersonalCalendarEdits = async () => {
    if (!calendarsRef.current.some((calendar) => calendar.id === 'cal-me')) return;
    setIsSavingPersonalCalendar(true);
    try {
      const originalById = new Map(originalPersonalEvents.map((event) => [event.id, event]));
      const editedIds = new Set(editingPersonalEvents.map((event) => event.id));
      for (const event of editingPersonalEvents) {
        const original = originalById.get(event.id);
        const normalizedEvent = { ...event, weekOffset: event.weekOffset ?? 0 };
        if (!original) {
          await patchOwnCalendarEvent('create', normalizedEvent);
        } else if (JSON.stringify(original) !== JSON.stringify(normalizedEvent)) {
          await patchOwnCalendarEvent('update', normalizedEvent);
        }
      }
      for (const event of originalPersonalEvents) {
        if (!editedIds.has(event.id)) {
          await patchOwnCalendarEvent('delete', event);
        }
      }
      setIsPersonalCalendarEditorOpen(false);
      showToast('Your calendar edits are saved and shared with accepted friends.');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not save calendar edits.');
    } finally {
      setIsSavingPersonalCalendar(false);
    }
  };

  const updateOwnCalendarEvents = (events: CalendarEvent[]) => {
    const updatedCalendars = calendarsRef.current.map((calendar) =>
      calendar.id === 'cal-me' ? { ...calendar, events } : calendar
    );
    calendarsRef.current = updatedCalendars;
    setCalendars(updatedCalendars);
  };

  const patchOwnCalendarEvent = useCallback(async (
    action: 'create' | 'update' | 'delete',
    event: CalendarEvent
  ) => {
    const queuedSave = calendarSaveQueueRef.current.then(async () => {
      const response = await fetch('/api/calendar', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, event })
      });
      const result = await readApiResponse<{ events: CalendarEvent[] }>(response);
      updateOwnCalendarEvents(uniqueCalendarEvents(result.events));
    }, async () => {
      const response = await fetch('/api/calendar', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, event })
      });
      const result = await readApiResponse<{ events: CalendarEvent[] }>(response);
      updateOwnCalendarEvents(uniqueCalendarEvents(result.events));
    });
    calendarSaveQueueRef.current = queuedSave.catch(() => undefined);
    return queuedSave;
  }, []);

  const createCalendarEventAtPosition = (
    event: React.DragEvent<HTMLDivElement>,
    dayIndex: number,
    week: number
  ) => {
    const personalCalendar = calendarsRef.current.find((calendar) => calendar.id === 'cal-me');
    if (!personalCalendar?.checked) {
      showToast('Enable My Calendar before adding an event.');
      return;
    }
    if (eventDropInProgressRef.current) {
      return;
    }
    eventDropInProgressRef.current = true;
    window.setTimeout(() => {
      eventDropInProgressRef.current = false;
    }, 750);
    const rect = event.currentTarget.getBoundingClientRect();
    const rawHour = (event.clientY - rect.top) / HOUR_HEIGHT;
    const start = Math.max(0, Math.min(23.75, Math.round(rawHour * 4) / 4));
    const newEvent: CalendarEvent = {
      id: `event-${crypto.randomUUID()}`,
      dayIndex,
      weekOffset: week,
      start,
      end: Math.min(24, start + 1),
      title: 'New event',
      location: '',
      lecturer: '',
      category: 'Personal'
    };
    const events = uniqueCalendarEvents([...personalCalendar.events, newEvent]);
    updateOwnCalendarEvents(events);
    setEventDetails(newEvent);
    void patchOwnCalendarEvent('create', newEvent).catch((error: unknown) => {
      showToast(error instanceof Error ? error.message : 'Could not save the new event.');
    });
  };

  const startNewEventDrag = (event: React.DragEvent<HTMLButtonElement>) => {
    event.dataTransfer.setData('application/x-syntgrid-new-event', 'new-event');
    event.dataTransfer.effectAllowed = 'copy';
  };

  const startEventResize = (
    event: React.PointerEvent<HTMLDivElement>,
    calendar: CalendarItem,
    calendarEvent: CalendarEvent,
    edge: 'start' | 'end'
  ) => {
    if (calendar.id !== 'cal-me') return;
    event.stopPropagation();
    event.preventDefault();
    setEventResize({
      eventId: calendarEvent.id,
      edge,
      pointerY: event.clientY,
      originalStart: calendarEvent.start,
      originalEnd: calendarEvent.end
    });
  };

  useEffect(() => {
    if (!eventResize) return;

    const handlePointerMove = (event: PointerEvent) => {
      const delta = Math.round(((event.clientY - eventResize.pointerY) / HOUR_HEIGHT) * 4) / 4;
      const nextValue = Math.max(0, Math.min(24, (eventResize.edge === 'start'
        ? eventResize.originalStart + delta
        : eventResize.originalEnd + delta)));
      const personalCalendar = calendarsRef.current.find((calendar) => calendar.id === 'cal-me');
      if (!personalCalendar) return;
      const events = personalCalendar.events.map((calendarEvent) => {
        if (calendarEvent.id !== eventResize.eventId) return calendarEvent;
        if (eventResize.edge === 'start') {
          return { ...calendarEvent, start: Math.min(nextValue, calendarEvent.end - 0.25) };
        }
        return { ...calendarEvent, end: Math.max(nextValue, calendarEvent.start + 0.25) };
      });
      updateOwnCalendarEvents(events);
    };
    const handlePointerUp = () => {
      const personalCalendar = calendarsRef.current.find((calendar) => calendar.id === 'cal-me');
      const resizedEvent = personalCalendar?.events.find((event) => event.id === eventResize.eventId);
      if (resizedEvent) {
        void patchOwnCalendarEvent('update', resizedEvent).catch((error: unknown) => {
          showToast(error instanceof Error ? error.message : 'Could not save the resized event.');
        });
      }
      setEventResize(null);
    };
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [eventResize, patchOwnCalendarEvent]);

  useEffect(() => {
    calendarsRef.current = calendars;
  }, [calendars]);

  const saveEventDetails = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!eventDetails) return;
    setIsSavingEventDetails(true);
    try {
      const personalCalendar = calendarsRef.current.find((calendar) => calendar.id === 'cal-me');
      if (!personalCalendar) throw new Error('Your personal calendar is not available.');
      await patchOwnCalendarEvent('update', eventDetails);
      setEventDetails(null);
      showToast('Event saved to your personal calendar.');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not save this event.');
    } finally {
      setIsSavingEventDetails(false);
    }
  };

  const deleteEvent = async () => {
    if (!eventDetails) return;
    setIsSavingEventDetails(true);
    try {
      const personalCalendar = calendarsRef.current.find((calendar) => calendar.id === 'cal-me');
      if (!personalCalendar) throw new Error('Your personal calendar is not available.');
      await patchOwnCalendarEvent('delete', eventDetails);
      setEventDetails(null);
      showToast('Event deleted from your personal calendar.');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not delete this event.');
    } finally {
      setIsSavingEventDetails(false);
    }
  };

  const importAiSchedule = async (importedEvents: ImportedScheduleEvent[]) => {
    const personalCalendar = calendarsRef.current.find((calendar) => calendar.id === 'cal-me');
    if (!personalCalendar?.checked) {
      throw new Error('Enable My Calendar before importing a schedule.');
    }
    const weekStartMs = weekStart.getTime();
    const weekEndMs = weekStartMs + 7 * 86_400_000;
    const importedCalendarEvents: CalendarEvent[] = importedEvents.map((event) => {
      const start = new Date(event.startTime);
      const end = new Date(event.endTime);
      const startMs = start.getTime();
      const endMs = end.getTime();
      if (startMs < weekStartMs || endMs > weekEndMs) {
        throw new Error('Every imported event must be inside the currently visible week.');
      }
      if (start.toISOString().slice(0, 10) !== end.toISOString().slice(0, 10)) {
        throw new Error('Events cannot cross midnight. Split overnight items into separate daily events.');
      }
      const dayIndex = (start.getUTCDay() + 6) % 7;
      const startHour = start.getUTCHours() + start.getUTCMinutes() / 60;
      const endHour = end.getUTCHours() + end.getUTCMinutes() / 60;
      return {
        id: `ai-${crypto.randomUUID()}`,
        dayIndex,
        weekOffset,
        start: startHour,
        end: endHour,
        title: event.title,
        location: '',
        lecturer: event.description,
        category: event.category
      };
    });
    const occupied = activeCalendars.flatMap((calendar) => calendar.events);
    for (const imported of importedCalendarEvents) {
      const overlaps = [...occupied, ...importedCalendarEvents].some((existing) =>
        existing.id !== imported.id &&
        existing.dayIndex === imported.dayIndex &&
        (existing.weekOffset ?? 0) === weekOffset &&
        imported.start < existing.end &&
        imported.end > existing.start
      );
      if (overlaps) throw new Error(`"${imported.title}" overlaps an existing event.`);
    }
    for (const event of importedCalendarEvents) {
      await patchOwnCalendarEvent('create', event);
    }
    showToast(`Imported ${importedCalendarEvents.length} event${importedCalendarEvents.length === 1 ? '' : 's'} into My Calendar.`);
  };

  // Copy Gemini prompt helper with fallback for permissions policy
  const copyText = async (text: string, key: string) => {
    let copied = false;
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(text);
        copied = true;
      } catch {
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
  const isLoadingAccountData =
    isLoggedIn && loadedAccountEmail !== (session?.user?.email ?? null);
  if (status === 'loading' || isLoadingAccountData) {
    return (
      <div className="relative min-h-screen bg-[#121212] flex items-center justify-center text-zinc-500 text-xs">
        <div className="flex flex-col items-center gap-4" role="status" aria-live="polite">
          <span className="h-9 w-9 animate-spin rounded-full border-2 border-[#333] border-t-[#ff9f43]" />
          <span>{status === 'loading' ? 'Checking your session…' : 'Loading your calendars and friends…'}</span>
        </div>
        <span className="absolute bottom-6 text-[11px] text-zinc-600">by makxyak</span>
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-[#121212] text-zinc-100 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-sm rounded-2xl border border-[#2e2e2e] bg-[#1a1a1a] p-6 shadow-2xl">
          <div className="mb-5 text-center">
            <h1 className="text-xl font-bold text-white">Welcome to syntgrid</h1>
            <p className="mt-2 text-xs leading-relaxed text-zinc-400">
              Sign in with Google or Microsoft, then upload your Imperial Outlook calendar as an
              .ics file. Your sign-in account calendar is never imported.
            </p>
          </div>
          {authProviders ? (
            <div className="space-y-3">
              {authProviders.some((provider) => provider.id === 'google') && (
                <button
                  onClick={() => signIn('google')}
                  className="w-full py-3 px-4 rounded-xl bg-white hover:bg-zinc-100 text-zinc-900 font-semibold text-sm flex items-center justify-center gap-3 transition shadow-lg cursor-pointer"
                >
                  <span className="font-bold text-base text-blue-600">G</span>
                  Continue with Google
                </button>
              )}
              {authProviders.some((provider) => provider.id === 'azure-ad') && (
                <button
                  onClick={() => signIn('azure-ad')}
                  className="w-full py-3 px-4 rounded-xl bg-[#242424] hover:bg-[#303030] border border-[#3a3a3a] text-white font-semibold text-sm flex items-center justify-center gap-3 transition cursor-pointer"
                >
                  Continue with Microsoft
                </button>
              )}
              {!authProviders.length && (
                <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-200">
                  No sign-in providers are configured. Add the provider credentials to the
                  server environment and restart the app.
                </p>
              )}
              {!authProviders.some((provider) => provider.id === 'google') && (
                <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-100">
                  Google sign-in is not configured on this server. Add
                  GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET, then restart or redeploy.
                </p>
              )}
              {!authProviders.some((provider) => provider.id === 'azure-ad') && (
                <p className="rounded-xl border border-sky-500/30 bg-sky-500/10 p-3 text-xs text-sky-100">
                  Microsoft sign-in is disabled until the server is configured with its specific
                  Entra tenant ID. The broad “common” tenant is not accepted.
                </p>
              )}
            </div>
          ) : (
            <p className="py-3 text-center text-xs text-zinc-400">
              {authProviderError || 'Checking available sign-in options…'}
            </p>
          )}
          <a href="/tutorial" className="mt-5 block text-center text-xs text-sky-300 hover:underline">
            How to export and upload your Imperial calendar
          </a>
          <nav className="mt-4 flex justify-center gap-4 text-[11px] text-zinc-500">
            <a href="/privacy" className="hover:text-zinc-300 hover:underline">Privacy Policy</a>
            <a href="/terms" className="hover:text-zinc-300 hover:underline">Terms of Service</a>
          </nav>
          <p className="mt-5 text-center text-[11px] text-zinc-600">by makxyak</p>
        </div>
      </div>
    );
  }

  

  return (
    <div className="min-h-screen bg-[#121212] text-zinc-100 flex flex-col font-sans select-none md:h-screen md:w-screen md:overflow-hidden">
      {/* ====================================================================
          TOP NAVIGATION BAR (Matches your Outlook/Scientia week bar)
         ==================================================================== */}
      <header className="min-h-14 shrink-0 bg-[#171717] border-b border-[#262626] px-3 py-2 sm:px-4 md:h-14 md:py-0 flex flex-wrap items-center justify-between gap-2 sm:gap-4 z-20">
        {/* Left: Brand + Week Navigation */}
        <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-4">
          <div className="flex items-center gap-2.5 pr-3 border-r border-[#2a2a2a]">
            <Image
              src="/syntgrid-icon.png"
              alt=""
              width={32}
              height={32}
              className="h-8 w-8 rounded-lg object-cover"
            />
            <span className="font-mono font-bold tracking-tight text-sm text-white hidden sm:inline">
              syntgrid
            </span>
            <span className="hidden sm:inline text-[10px] text-zinc-500">
              by makxyak
            </span>
          </div>

          <button
            onClick={() => setWeekOffset(todayWeekOffset)}

            className="px-3 py-1.5 rounded-md bg-[#222222] hover:bg-[#2c2c2c] border border-[#333333] text-xs font-medium text-zinc-200 flex items-center gap-1.5 transition cursor-pointer"
          >
            <CalendarIcon className="w-3.5 h-3.5 text-zinc-400" />
            Today
          </button>

          <button
            type="button"
            draggable
            onDragStart={startNewEventDrag}
            className="flex cursor-grab items-center gap-1.5 rounded-md border border-emerald-400/40 bg-emerald-400/10 px-2.5 py-1.5 text-xs font-semibold text-emerald-200 transition hover:bg-emerald-400/20 active:cursor-grabbing"
            title="Drag onto your personal calendar to create an event"
          >
            <Plus className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">New event (drag)</span>
            <span className="sm:hidden">New event</span>
          </button>

          <AISchedulerModal
            weekStartIso={weekStart.toISOString()}
            existingScheduleText={existingScheduleText}
            onImport={importAiSchedule}
            showToast={showToast}
          />

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

          <h2 className="min-w-0 truncate font-serif text-sm sm:text-base font-semibold text-zinc-100 tracking-tight">
            {dateLabel.format(weekStart)} – {dateLabel.format(weekEnd)}

          </h2>
        </div>

        {/* Center/Right: Active Split-Column Mode Pill + Stack Code Guide + User */}
        <div className="flex w-full items-center justify-end gap-2 sm:w-auto sm:gap-2.5">
          <button
            type="button"
            onClick={() => setIsTutorialOpen(true)}
            className="px-2.5 py-1.5 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 border border-sky-400/30 text-sky-200 text-[11px] font-medium transition sm:px-3 sm:text-xs"
          >
            Calendar tutorial
          </button>

          {/* Logged-in account */}
          <div className="flex items-center gap-2 pl-2 border-l border-[#2a2a2a]">
            <div className="w-7 h-7 rounded-full bg-[#ff6b6b]/20 border border-[#ff6b6b] flex items-center justify-center text-xs font-bold text-[#ffd8d8]">
              {(session?.user?.name || session?.user?.email || 'U').slice(0, 1).toUpperCase()}
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
              title="Sign out"
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
      <div className="flex flex-1 flex-col overflow-visible md:flex-row md:overflow-hidden">
        {/* ==================================================================
            MAIN WEEK-CENTERED SPLIT-COLUMN CALENDAR VIEWPORT
           ================================================================== */}
        <main className="h-[70dvh] min-h-[32rem] flex-none flex flex-col overflow-hidden bg-[#121212] md:h-auto md:min-h-0 md:flex-1">
          {/* Scrollable Wrapper */}
          <div
            ref={calendarScrollRef}
            className={`flex-1 overflow-auto relative touch-none ${
              isPanningCalendar ? 'cursor-grabbing' : 'cursor-grab'
            }`}
            onPointerDown={startCalendarPan}
            onPointerMove={panCalendar}
            onPointerUp={stopCalendarPan}
            onPointerCancel={stopCalendarPan}
          >
            <div
              className="min-h-full min-w-[700px] flex flex-col md:min-w-0"
              style={{
                minWidth: isHorizontalScrollMode
                  ? `${64 + DAYS_OF_WEEK.length * Math.max(250, activeCalendars.length * 92)}px`
                  : undefined
              }}
            >
              {/* STICKY DAY HEADERS ROW */}
              <div className="sticky top-0 z-20 bg-[#161616] border-b border-[#262626] flex">
                {/* Top-Left Time Gutter Corner */}
                <div className="sticky left-0 z-30 w-16 shrink-0 border-r border-[#262626] bg-[#161616] flex items-center justify-center text-[10px] uppercase tracking-wider text-zinc-500 font-medium">
                  GMT+1
                </div>

                {/* 7 Day Header Columns */}
                <div className="flex-1 grid grid-cols-7">
                  {DAYS_OF_WEEK.map((day: DayOfWeek) => {
                    const isCurrentDay = weekOffset === todayWeekOffset &&
                      day.dayIndex === todayDayIndex;
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
                              <span className="truncate">{cal.ownerName || cal.name}</span>
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
                <div className="sticky left-0 z-10 w-16 shrink-0 border-r border-[#262626] bg-[#141414] relative select-none">
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
                              onDragOver={cal.id === 'cal-me'
                                ? (event) => {
                                    if (event.dataTransfer.types.includes('application/x-syntgrid-new-event')) {
                                      event.preventDefault();
                                      event.dataTransfer.dropEffect = 'copy';
                                    }
                                  }
                                : undefined}
                              onDrop={cal.id === 'cal-me'
                                ? (event) => {
                                    if (!event.dataTransfer.types.includes('application/x-syntgrid-new-event')) return;
                                    event.preventDefault();
                                    createCalendarEventAtPosition(event, day.dayIndex, weekOffset);
                                  }
                                : undefined}
                            >
                              {positionedEvents.map((ev: PositionedEvent) => {
                                const topPx = ev.start * HOUR_HEIGHT;

                                const heightPx = (ev.end - ev.start) * HOUR_HEIGHT;
                                const widthPct = 100 / ev.totalCols;
                                const leftPct = ev.colIndex * widthPct;
                                const eventPalette = getEventPalette(ev, cal.palette);

                                const isNarrow =
                                  activeCalendars.length >= 2 && ev.totalCols >= 2;

                                return (
                                  <div
                                    key={ev.id}
                                    data-calendar-event
                                    onDoubleClick={(event) => {
                                      event.stopPropagation();
                                      if (cal.id === 'cal-me' && !ev.id.startsWith('ai-')) setEventDetails({ ...ev });
                                    }}
                                    onMouseEnter={(e: React.MouseEvent<HTMLDivElement>) => {
                                      const rect = e.currentTarget.getBoundingClientRect();
                                      setTooltipPos({
                                        x: Math.min(window.innerWidth - 300, Math.max(16, rect.left)),
                                        y: Math.max(16, rect.top - 10)
                                      });
                                      setHoveredEvent({
                                        ...ev,
                                        ownerName: cal.ownerName || cal.name,
                                        ownerEmail: cal.email,
                                        palette: eventPalette
                                      });
                                    }}
                                    onMouseLeave={() => setHoveredEvent(null)}
                                    style={{
                                      top: `${topPx + 2}px`,
                                      height: `${heightPx - 4}px`,
                                      left: `calc(${leftPct}% + 2px)`,
                                      width: `calc(${widthPct}% - 4px)`,
                                      backgroundColor: eventPalette.bg,
                                      borderColor: ev.color ?? eventPalette.border,
                                      color: ev.color ?? eventPalette.text,
                                      ...(ev.color ? {
                                        backgroundColor: `${ev.color}2b`
                                      } : {})
                                    }}
                                    className={`absolute rounded-lg px-2 py-1.5 overflow-hidden transition-all duration-150 cursor-pointer flex flex-col justify-between shadow-sm hover:z-30 hover:brightness-110 ${
                                      ev.dashed
                                        ? 'border-[1.5px] border-dashed opacity-50'
                                        : 'border border-l-[3px]'
                                    }`}
                                  >
                                    {cal.id === 'cal-me' && !ev.id.startsWith('ai-') && (
                                      <>
                                        <div
                                          className="absolute inset-x-0 top-0 z-10 h-2 cursor-ns-resize"
                                          onPointerDown={(event) => startEventResize(event, cal, ev, 'start')}
                                        />
                                        <div
                                          className="absolute inset-x-0 bottom-0 z-10 h-2 cursor-ns-resize"
                                          onPointerDown={(event) => startEventResize(event, cal, ev, 'end')}
                                        />
                                      </>
                                    )}
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
                                          style={{ color: eventPalette.subtext }}
                                        >
                                          {ev.location}
                                        </p>
                                      )}
                                    </div>

                                    {heightPx >= 64 && (
                                      <div
                                        className="text-[10px] truncate opacity-80 mt-auto pt-0.5"
                                        style={{ color: eventPalette.subtext }}
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
                  {currentTimePosition !== null &&
                    currentTimeLabel !== null &&
                    weekOffset === todayWeekOffset &&
                    currentTimePosition < HOURS.length * HOUR_HEIGHT && (
                      <div
                        aria-label={`Current local time in ${localTimeZone}: ${currentTimeLabel}`}
                        className="absolute z-20 pointer-events-none"
                        style={{
                          top: `${currentTimePosition}px`,
                          left: `${(todayDayIndex / DAYS_OF_WEEK.length) * 100}%`,
                          width: `${100 / DAYS_OF_WEEK.length}%`
                        }}
                      >
                        <div className="absolute left-0 right-0 border-t-2 border-rose-400" />
                        <span className="absolute left-0 -top-2.5 rounded bg-rose-400 px-1 py-0.5 text-[9px] font-bold leading-none text-[#121212]">
                          {currentTimeLabel}
                        </span>
                      </div>
                    )}
                </div>
              </div>
            </div>
          </div>
        </main>

        {/* ==================================================================
            RIGHT SIDEBAR: INCOMING REQUESTS + FRIENDS/CALENDARS CHECKLIST
           ================================================================== */}
        <aside className="w-full shrink-0 bg-[#171717] border-t border-[#262626] flex flex-col justify-between z-20 md:w-80 md:border-l md:border-t-0">
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
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                    Calendars & Friends
                  </span>
                  <span className="ml-2 text-[11px] text-zinc-500">
                    {activeCalendars.length} of {calendarsWithColors.length} active
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCreatingFriendGroup((isCreating) => !isCreating)}
                  aria-label="Create friend group"
                  title="Create friend group"
                  className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#383838] bg-[#222] text-zinc-300 transition hover:border-[#ff9f43] hover:text-[#ffbd78]"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>

              {isCreatingFriendGroup && (
                <form onSubmit={createFriendGroup} className="mb-3 flex gap-2">
                  <input
                    autoFocus
                    required
                    maxLength={40}
                    value={newFriendGroupName}
                    onChange={(event) => setNewFriendGroupName(event.target.value)}
                    placeholder="Group name"
                    aria-label="New friend group name"
                    className="min-w-0 flex-1 rounded-lg border border-[#383838] bg-[#121212] px-2.5 py-2 text-xs text-white focus:border-[#ff9f43] focus:outline-none"
                  />
                  <button
                    type="submit"
                    className="rounded-lg bg-[#ff9f43] px-3 py-2 text-xs font-bold text-[#121212] hover:brightness-110"
                  >
                    Create
                  </button>
                </form>
              )}

              {friendGroups.length > 0 && (
                <div className="mb-3 space-y-2">
                  {friendGroups.map((group) => (
                    <div
                      key={group.id}
                      onDragOver={(event) => {
                        if (draggingFriendEmail) event.preventDefault();
                      }}
                      onDrop={(event) => {
                        event.preventDefault();
                        const friendEmail =
                          event.dataTransfer.getData('text/plain') || draggingFriendEmail;
                        if (friendEmail) void toggleFriendInGroup(group, friendEmail);
                        setDraggingFriendEmail(null);
                      }}
                      className={`rounded-xl border p-2.5 transition ${
                        draggingFriendEmail
                          ? 'border-dashed border-[#ff9f43] bg-[#ff9f43]/5'
                          : 'border-[#343434] bg-[#1c1c1c]'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => void toggleFriendGroup(group)}
                          role="switch"
                          aria-checked={group.isActive}
                          aria-label={`${group.isActive ? 'Deactivate' : 'Activate'} ${group.name}`}
                          className={`flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition ${
                            group.isActive ? 'bg-emerald-400' : 'bg-[#444]'
                          }`}
                        >
                          <span className={`h-4 w-4 rounded-full bg-white transition ${
                            group.isActive ? 'translate-x-4' : 'translate-x-0'
                          }`} />
                        </button>
                        <span className="min-w-0 flex-1 truncate text-xs font-semibold text-zinc-100">
                          {group.name}
                        </span>
                        <span className="text-[10px] text-zinc-500">
                          {group.friendEmails.length}
                        </span>
                        <button
                          type="button"
                          onClick={() => void deleteFriendGroup(group)}
                          aria-label={`Delete ${group.name}`}
                          title="Delete group"
                          className="rounded p-1 text-zinc-500 transition hover:bg-rose-500/15 hover:text-rose-300"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <p className="mt-1.5 pl-11 text-[10px] text-zinc-500">
                        {draggingFriendEmail
                          ? `Drop to ${
                              group.friendEmails.includes(draggingFriendEmail.toLowerCase())
                                ? 'remove'
                                : 'add'
                            } ${draggingFriendEmail}`
                          : 'Drag friend tiles here to add or remove'}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              <div className="space-y-2">
                {calendarsWithColors.map((cal: CalendarItemWithPalette) => (
                  <div
                    key={cal.id}
                    onClick={() => toggleCalendar(cal.id)}
                    draggable={cal.type === 'outlook-friend'}
                    onDragStart={(event) => {
                      if (cal.type !== 'outlook-friend') return;
                      event.dataTransfer.effectAllowed = 'copy';
                      event.dataTransfer.setData('text/plain', cal.email);
                      setDraggingFriendEmail(cal.email);
                    }}
                    onDragEnd={() => setDraggingFriendEmail(null)}
                    className={`group p-2.5 rounded-xl border transition cursor-pointer flex items-center justify-between gap-2.5 ${
                      cal.checked
                        ? 'bg-[#202020] border-[#343434]'
                        : 'bg-[#181818] border-[#242424] opacity-65 hover:opacity-100'
                    } ${cal.type === 'outlook-friend' ? 'cursor-grab active:cursor-grabbing' : ''}`}
                    title={cal.type === 'outlook-friend' ? 'Drag this friend to a group' : undefined}
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
                        {cal.ownerName && (
                          <div className="mt-0.5 truncate text-[10px] text-zinc-500">
                            Owner: {cal.ownerName}
                          </div>
                        )}
                        <div className="flex items-center gap-1.5 text-[10px] text-zinc-400 truncate mt-0.5">
                          <span
                            className="px-1.5 py-0.2 rounded text-[9px] font-medium"
                            style={{
                              backgroundColor: cal.palette.badgeBg,
                              color: cal.palette.text
                            }}
                          >
                            {cal.type === 'outlook-me'
                              ? 'My Calendar'
                              : cal.type === 'outlook-friend'
                              ? 'Friend OAuth'
                              : 'Room / File'}
                          </span>
                          <span className="truncate">{cal.events.length} events</span>
                        </div>
                      </div>
                    </div>

                    {cal.type === 'outlook-me' && (
                      <button
                        onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                          e.stopPropagation();
                          setEditingPersonalEvents(cal.events.map((event) => ({ ...event })));
                          setOriginalPersonalEvents(cal.events.map((event) => ({ ...event })));
                          setIsPersonalCalendarEditorOpen(true);
                        }}
                        className="p-1.5 rounded-lg opacity-60 group-hover:opacity-100 hover:bg-sky-500/20 text-zinc-400 hover:text-sky-200 transition cursor-pointer shrink-0"
                        title="Edit your personal calendar"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {/* Delete / Remove Button */}
                    {cal.isDeletable && (
                      <button
                        onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                          e.stopPropagation();
                          void deleteCalendar(cal);
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

      {isTutorialOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="flex max-h-[calc(100dvh-2rem)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-[#303030] bg-[#191919] shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-[#2b2b2b] px-5 py-4">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-emerald-300">
                  quick reference
                </p>
                <h3 className="mt-1 font-serif text-lg font-semibold text-white">
                  Upload your Imperial timetable
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsTutorialOpen(false)}
                className="rounded-lg p-1.5 text-zinc-400 transition hover:bg-[#292929] hover:text-white"
                aria-label="Close calendar tutorial"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="overflow-y-auto px-5 py-5 text-sm leading-relaxed text-zinc-300">
              <div className="grid gap-3 sm:grid-cols-2">
                <section className="rounded-xl border border-[#303030] bg-[#202020] p-4">
                  <h4 className="font-semibold text-white">Classic Outlook</h4>
                  <ol className="mt-2 space-y-2 text-xs">
                    <li>1. Open your Imperial timetable.</li>
                    <li>2. Choose <strong className="text-white">File → Save Calendar</strong>.</li>
                    <li>3. Select your date range and full details.</li>
                    <li>4. Save the file with an <strong className="text-white">.ics</strong> extension.</li>
                  </ol>
                </section>
                <section className="rounded-xl border border-[#303030] bg-[#202020] p-4">
                  <h4 className="font-semibold text-white">Outlook on the web</h4>
                  <ol className="mt-2 space-y-2 text-xs">
                    <li>1. Open <strong className="text-white">Settings → Calendar → Shared calendars</strong>.</li>
                    <li>2. Select your Imperial timetable under Publish a calendar.</li>
                    <li>3. Open the ICS link and save it as a file.</li>
                  </ol>
                </section>
              </div>
              <p className="mt-4 rounded-xl border border-amber-400/25 bg-amber-400/10 px-4 py-3 text-xs text-amber-100">
                Upload it with <strong>Add Friend or Room Timetable</strong>. My Calendar is shareable with accepted friends; Extra calendar stays private.
              </p>
              <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-[#2b2b2b] pt-4 text-xs">
                <a href="/privacy" className="text-sky-300 hover:underline">Privacy policy</a>
                <a href="/terms" className="text-sky-300 hover:underline">Terms of service</a>
                <span className="font-mono text-zinc-600">stored locally for this session</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ====================================================================
          UNIFIED "+ ADD" MODAL (friend requests and custom calendars)
         ==================================================================== */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto rounded-2xl border border-[#2e2e2e] bg-[#1a1a1a] shadow-2xl">
            <div className="px-5 py-4 border-b border-[#282828] flex items-center justify-between">
              <h3 className="text-sm font-bold text-white">
                Add to syntgrid
              </h3>
              <button
                onClick={() => {
                  setIsAddModalOpen(false);
                  setFriendProfileSuggestions([]);
                  setIsFriendProfileDropdownOpen(false);
                }}
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

            {/* TAB 1: ADD FRIEND VIA EMAIL */}
            {addModalTab === 'friend' ? (
              <form onSubmit={handleAddFriendSubmit} className="p-5 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-200 mb-1.5">
                    Search for a friend
                  </label>
                  <input
                    type="text"
                    required
                    value={friendEmailInput}
                    role="combobox"
                    aria-autocomplete="list"
                    aria-expanded={
                      isFriendProfileDropdownOpen &&
                      friendEmailInput.trim().length >= 2
                    }
                    aria-controls="friend-profile-suggestions"
                    autoComplete="off"
                    onFocus={() => setIsFriendProfileDropdownOpen(true)}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                      setFriendEmailInput(e.target.value);
                      setFriendProfileSuggestions([]);
                      setFriendProfileSearchError('');
                      setIsFriendProfileDropdownOpen(true);
                    }}
                    placeholder="Search by name or email"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#121212] border border-[#303030] focus:border-[#ff9f43] focus:outline-none text-xs text-white"
                  />
                  {isFriendProfileDropdownOpen && friendEmailInput.trim().length >= 2 && (
                    <div
                      id="friend-profile-suggestions"
                      role="listbox"
                      aria-label="Matching profiles"
                      className="mt-1 max-h-64 overflow-y-auto rounded-xl border border-[#343434] bg-[#171717] shadow-xl"
                    >
                      {isSearchingFriendProfiles ? (
                        <p className="px-3 py-3 text-xs text-zinc-400">Searching profiles…</p>
                      ) : friendProfileSearchError ? (
                        <p role="alert" className="px-3 py-3 text-xs text-rose-300">
                          {friendProfileSearchError}
                        </p>
                      ) : friendProfileSuggestions.length > 0 ? (
                        friendProfileSuggestions.map((profile) => (
                          <button
                            key={profile.email}
                            type="button"
                            role="option"
                            aria-selected={friendEmailInput === profile.email}
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => {
                              setFriendEmailInput(profile.email);
                              setIsFriendProfileDropdownOpen(false);
                            }}
                            className="flex w-full items-center gap-3 border-b border-[#292929] px-3 py-2.5 text-left last:border-b-0 hover:bg-[#242424] focus:bg-[#242424] focus:outline-none"
                          >
                            {profile.image ? (
                              <Image
                                src={profile.image}
                                alt=""
                                width={36}
                                height={36}
                                unoptimized
                                className="h-9 w-9 shrink-0 rounded-full object-cover"
                              />
                            ) : (
                              <span
                                aria-hidden="true"
                                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#ff9f43]/20 text-sm font-bold text-[#ffbd78]"
                              >
                                {(profile.name || profile.email).slice(0, 1).toUpperCase()}
                              </span>
                            )}
                            <span className="min-w-0">
                              <span className="block truncate text-xs font-semibold text-zinc-100">
                                {profile.name}
                              </span>
                              <span className="mt-0.5 block truncate text-[11px] text-zinc-400">
                                {profile.email}
                              </span>
                            </span>
                          </button>
                        ))
                      ) : (
                        <p className="px-3 py-3 text-xs text-zinc-400">
                          No matching profiles. You can still enter an account email.
                        </p>
                      )}
                    </div>
                  )}
                  <p className="text-[11px] text-zinc-400 mt-1.5">
                    Search by profile name or email, or enter their account email. They&apos;ll receive an invitation to share their calendar.
                  </p>
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
                    Send Calendar Request
                  </button>
                </div>
              </form>
            ) : (
              /* TAB 2: UPLOAD CUSTOM TIMETABLE (.JSON OR .ICS GENERATED BY GEMINI) */
              <form onSubmit={handleSaveCustomCalendar} className="p-5 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-200 mb-1.5">
                    Calendar Name
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

                <fieldset>
                  <legend className="block text-xs font-semibold text-zinc-200 mb-1.5">
                    Add this upload as
                  </legend>
                  <div className="grid grid-cols-2 gap-2">
                    <label className={`rounded-xl border p-3 text-xs transition ${
                      uploadDestination === 'personal'
                        ? 'border-[#ff9f43] bg-[#ff9f43]/10'
                        : 'border-[#303030] bg-[#141414]'
                    } ${uploadedEventsPreview && !uploadedFileIsIcs ? 'opacity-50' : 'cursor-pointer'}`}>
                      <input
                        type="radio"
                        name="upload-destination"
                        value="personal"
                        checked={uploadDestination === 'personal'}
                        disabled={Boolean(uploadedEventsPreview && !uploadedFileIsIcs)}
                        onChange={() => setUploadDestination('personal')}
                        className="sr-only"
                      />
                      <span className="font-semibold text-zinc-100">My Calendar</span>
                      <span className="mt-1 block text-[11px] leading-relaxed text-zinc-400">
                        Saved to your account and visible to accepted friends.
                      </span>
                      {uploadedEventsPreview && !uploadedFileIsIcs && (
                        <span className="mt-1 block text-[10px] text-amber-300">
                          Personal calendars require an .ics file.
                        </span>
                      )}
                    </label>
                    <label className={`rounded-xl border p-3 text-xs cursor-pointer transition ${
                      uploadDestination === 'extra'
                        ? 'border-[#1dd1a1] bg-[#1dd1a1]/10'
                        : 'border-[#303030] bg-[#141414]'
                    }`}>
                      <input
                        type="radio"
                        name="upload-destination"
                        value="extra"
                        checked={uploadDestination === 'extra'}
                        onChange={() => setUploadDestination('extra')}
                        className="sr-only"
                      />
                      <span className="font-semibold text-zinc-100">Extra calendar</span>
                      <span className="mt-1 block text-[11px] leading-relaxed text-zinc-400">
                        Private to you; it is never shared with friends.
                      </span>
                    </label>
                  </div>
                </fieldset>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-zinc-200">
                      Calendar File (`.ics` or `.json`)
                    </label>
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
                      Click to upload your `.ics` or a `.json` room schedule
                    </p>
                    <p className="text-[11px] text-zinc-500 mt-0.5">
                      Choose My Calendar to share an .ics with accepted friends, or Extra calendar to keep the upload private. JSON uploads are private extras.
                    </p>
                  </div>
                </div>

                <p className="text-[11px] text-zinc-400">
                  Need to export your timetable first?{' '}
                  <a href="/tutorial" className="text-sky-300 hover:underline">
                    Follow the Imperial Outlook tutorial
                  </a>
                  . Your Google or Microsoft account calendar is not imported.
                </p>

                <div className="p-3 rounded-xl bg-[#141414] border border-[#262626] flex items-center justify-between gap-2">
                  <div className="text-[11px] text-zinc-400">
                    <strong className="text-zinc-200">Tip:</strong> Copy the prompt to give Gemini with your timetable photo so it outputs syntgrid&apos;s JSON format.
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
                      Ready to import <strong>{uploadedEventsPreview.length} events</strong> into &quot;{customCalName || 'Custom Schedule'}&quot;
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
                    {uploadedFileIsIcs && uploadDestination === 'personal'
                      ? 'Save as My Calendar'
                      : 'Add Private Extra Calendar'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {eventDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <form
            onSubmit={saveEventDetails}
            className="w-full max-w-md rounded-2xl border border-[#303030] bg-[#1a1a1a] p-5 shadow-2xl"
          >
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-emerald-300">
                  personal event
                </p>
                <h3 className="mt-1 font-serif text-lg font-semibold text-white">
                  Event details
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEventDetails(null)}
                className="rounded-lg p-1.5 text-zinc-400 transition hover:bg-[#292929] hover:text-white"
                aria-label="Close event details"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3">
              <label className="block text-xs text-zinc-400">
                Title
                <input
                  autoFocus
                  required
                  value={eventDetails.title}
                  onChange={(event) => setEventDetails({ ...eventDetails, title: event.target.value })}
                  className="mt-1 w-full rounded-lg border border-[#383838] bg-[#111] px-3 py-2 text-sm text-white outline-none focus:border-emerald-400"
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-xs text-zinc-400">
                  Start
                  <input
                    type="time"
                    step="900"
                    value={`${String(Math.floor(eventDetails.start)).padStart(2, '0')}:${String(Math.round((eventDetails.start % 1) * 60)).padStart(2, '0')}`}
                    onChange={(event) => setEventDetails({
                      ...eventDetails,
                      start: Number(event.target.value.slice(0, 2)) + Number(event.target.value.slice(3)) / 60
                    })}
                    className="mt-1 w-full rounded-lg border border-[#383838] bg-[#111] px-3 py-2 text-sm text-white outline-none focus:border-emerald-400"
                  />
                </label>
                <label className="block text-xs text-zinc-400">
                  End
                  <input
                    type="time"
                    step="900"
                    value={`${String(Math.floor(eventDetails.end)).padStart(2, '0')}:${String(Math.round((eventDetails.end % 1) * 60)).padStart(2, '0')}`}
                    onChange={(event) => setEventDetails({
                      ...eventDetails,
                      end: Number(event.target.value.slice(0, 2)) + Number(event.target.value.slice(3)) / 60
                    })}
                    className="mt-1 w-full rounded-lg border border-[#383838] bg-[#111] px-3 py-2 text-sm text-white outline-none focus:border-emerald-400"
                  />
                </label>
              </div>
              <label className="block text-xs text-zinc-400">
                Location
                <input
                  value={eventDetails.location}
                  onChange={(event) => setEventDetails({ ...eventDetails, location: event.target.value })}
                  className="mt-1 w-full rounded-lg border border-[#383838] bg-[#111] px-3 py-2 text-sm text-white outline-none focus:border-emerald-400"
                />
              </label>
              <label className="block text-xs text-zinc-400">
                Notes / lecturer
                <input
                  value={eventDetails.lecturer}
                  onChange={(event) => setEventDetails({ ...eventDetails, lecturer: event.target.value })}
                  className="mt-1 w-full rounded-lg border border-[#383838] bg-[#111] px-3 py-2 text-sm text-white outline-none focus:border-emerald-400"
                />
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => void deleteEvent()}
                disabled={isSavingEventDetails}
                className="mr-auto flex items-center gap-1.5 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-2 text-xs font-medium text-rose-200 hover:bg-rose-500/20 disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete event
              </button>
              <button
                type="button"
                onClick={() => setEventDetails(null)}
                className="rounded-xl bg-[#292929] px-4 py-2 text-xs font-medium text-zinc-300 hover:bg-[#333]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSavingEventDetails || eventDetails.end <= eventDetails.start}
                className="rounded-xl bg-emerald-400 px-4 py-2 text-xs font-bold text-[#121212] hover:brightness-110 disabled:opacity-50"
              >
                {isSavingEventDetails ? 'Saving…' : 'Save event'}
              </button>
            </div>
          </form>
        </div>
      )}

      {isPersonalCalendarEditorOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="flex max-h-[calc(100dvh-2rem)] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-[#2e2e2e] bg-[#1a1a1a] shadow-2xl">
            <div className="px-5 py-4 border-b border-[#282828] flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white">Edit your personal calendar</h3>
                <p className="mt-1 text-[11px] text-zinc-400">
                  Changes are saved to your account and visible to accepted friends.
                </p>
              </div>
              <button
                onClick={() => setIsPersonalCalendarEditorOpen(false)}
                className="p-1 rounded-lg hover:bg-[#262626] text-zinc-400 hover:text-white cursor-pointer"
                title="Close editor"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-5 space-y-3">
              {editingPersonalEvents.length === 0 && (
                <p className="rounded-xl border border-[#2e2e2e] bg-[#141414] p-4 text-xs text-zinc-400">
                  This calendar has no events. Add an event below, or upload an Imperial Outlook .ics file.
                </p>
              )}
              {editingPersonalEvents.map((event) => (
                <div key={event.id} className="grid grid-cols-1 md:grid-cols-12 gap-2 rounded-xl border border-[#2c2c2c] bg-[#151515] p-3">
                  <input
                    aria-label="Event title"
                    value={event.title}
                    onChange={(e) => updatePersonalEvent(event.id, 'title', e.target.value)}
                    placeholder="Event title"
                    className="md:col-span-3 rounded-lg border border-[#303030] bg-[#101010] px-2.5 py-2 text-xs text-white"
                  />
                  <input
                    aria-label="Location"
                    value={event.location}
                    onChange={(e) => updatePersonalEvent(event.id, 'location', e.target.value)}
                    placeholder="Location"
                    className="md:col-span-2 rounded-lg border border-[#303030] bg-[#101010] px-2.5 py-2 text-xs text-white"
                  />
                  <input
                    aria-label="Lecturer or details"
                    value={event.lecturer}
                    onChange={(e) => updatePersonalEvent(event.id, 'lecturer', e.target.value)}
                    placeholder="Lecturer / details"
                    className="md:col-span-2 rounded-lg border border-[#303030] bg-[#101010] px-2.5 py-2 text-xs text-white"
                  />
                  <select
                    aria-label="Day of week"
                    value={event.dayIndex}
                    onChange={(e) => updatePersonalEvent(event.id, 'dayIndex', e.target.value)}
                    className="md:col-span-1 rounded-lg border border-[#303030] bg-[#101010] px-2 py-2 text-xs text-white"
                  >
                    {DAYS_OF_WEEK.map((day) => (
                      <option key={day.dayIndex} value={day.dayIndex}>{day.short}</option>
                    ))}
                  </select>
                  <input
                    aria-label="Week offset"
                    type="number"
                    value={event.weekOffset ?? 0}
                    onChange={(e) => updatePersonalEvent(event.id, 'weekOffset', e.target.value)}
                    title="Weeks from the calendar's starting week"
                    className="md:col-span-1 rounded-lg border border-[#303030] bg-[#101010] px-2 py-2 text-xs text-white"
                  />
                  <input
                    aria-label="Start time"
                    type="number"
                    min="0"
                    max="23.75"
                    step="0.25"
                    value={event.start}
                    onChange={(e) => updatePersonalEvent(event.id, 'start', e.target.value)}
                    className="md:col-span-1 rounded-lg border border-[#303030] bg-[#101010] px-2 py-2 text-xs text-white"
                  />
                  <input
                    aria-label="End time"
                    type="number"
                    min="0.25"
                    max="24"
                    step="0.25"
                    value={event.end}
                    onChange={(e) => updatePersonalEvent(event.id, 'end', e.target.value)}
                    className="md:col-span-1 rounded-lg border border-[#303030] bg-[#101010] px-2 py-2 text-xs text-white"
                  />
                  <button
                    onClick={() => setEditingPersonalEvents((events) => events.filter((item) => item.id !== event.id))}
                    className="md:col-span-1 flex items-center justify-center rounded-lg bg-rose-500/10 text-rose-300 hover:bg-rose-500/20"
                    title="Delete event"
                    type="button"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap justify-between gap-2 border-t border-[#282828] p-4">
              <button
                type="button"
                onClick={() => setEditingPersonalEvents((events) => [
                  ...events,
                  {
                    id: `manual-${Date.now()}`,
                    dayIndex: 0,
                    weekOffset: 0,
                    start: 9,
                    end: 10,
                    title: 'New event',
                    location: '',
                    lecturer: '',
                    category: 'Personal'
                  }
                ])}
                className="rounded-xl bg-[#242424] px-4 py-2 text-xs font-medium text-zinc-200 hover:bg-[#2e2e2e]"
              >
                Add event
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsPersonalCalendarEditorOpen(false)}
                  className="rounded-xl bg-[#242424] px-4 py-2 text-xs font-medium text-zinc-300 hover:bg-[#2e2e2e]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isSavingPersonalCalendar}
                  onClick={() => void savePersonalCalendarEdits()}
                  className="rounded-xl bg-emerald-400 px-4 py-2 text-xs font-bold text-[#121212] hover:brightness-110 disabled:opacity-50"
                >
                  {isSavingPersonalCalendar ? 'Saving…' : 'Save calendar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ====================================================================
          FREE HOSTING & MICROSOFT OAUTH BACKEND CODE MODAL
         ==================================================================== */}
      {isCodeModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="flex max-h-[calc(100dvh-2rem)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-[#2e2e2e] bg-[#181818] shadow-2xl">
            <div className="px-6 py-4 border-b border-[#282828] flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white">
                  Authentication and saved calendar data
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Google and Microsoft are sign-in providers; calendar access is based on your uploaded .ics file.
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
                    Unlike Render&apos;s free tier (which sleeps after 15m and takes 40s to wake up), Vercel wakes instantly and hosts Next.js API routes for free.
                  </p>
                </div>
                <div className="p-3.5 rounded-xl bg-[#1f1f1f] border border-[#2c2c2c]">
                  <div className="font-bold text-white mb-1">2. DB: MongoDB</div>
                  <p className="text-[11px] text-zinc-400">
                    The uploaded calendar source and normalized editable events are stored on the signed-in user record.
                  </p>
                </div>
                <div className="p-3.5 rounded-xl bg-[#1f1f1f] border border-[#2c2c2c]">
                  <div className="font-bold text-white mb-1">3. Auth: NextAuth</div>
                  <p className="text-[11px] text-zinc-400">
                    Google and Microsoft OAuth identify the account only. No calendar permissions or live Graph sync are requested.
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
  email               String @unique
  calendarName        String?
  personalCalendarIcs String?
  calendarEvents      Json?
}

model Friendship {
  senderId   String
  receiverId String
  status     String @default("PENDING")
}`}
                </pre>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-bold text-zinc-100">
                    2. Calendar API and sharing permissions
                  </span>
                </div>
                <p className="rounded-xl border border-[#282828] bg-[#111111] p-3.5 text-[11px] leading-relaxed text-zinc-300">
                  The calendar API saves the uploaded .ics source and event data to your account.
                  Shared-calendar reads require an accepted friendship; provider calendar APIs are
                  not called.
                </p>
                <pre hidden className="p-3.5 rounded-xl bg-[#111111] border border-[#282828] overflow-x-auto text-[11px] text-sky-300 font-mono leading-relaxed">
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
    location: ev.location?.displayName || "",
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