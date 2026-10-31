'use client';

import { Clipboard, Download, Link2, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export interface ImportedScheduleEvent {
  title: string;
  description: string;
  startTime: string;
  endTime: string;
  category: string;
}

interface WeekScheduleToolsProps {
  weekStartIso: string;
  existingScheduleText: string;
  existingAiScheduleText: string;
  savedPromptNotes: string;
  onSavePromptNotes: (notes: string) => Promise<void>;
  trellisUrl: string;
  onImport: (events: ImportedScheduleEvent[]) => Promise<void>;
  showToast: (message: string) => void;
}

const eventSchemaKeys = '"title","description","startTime","endTime","category"';

function formatWeekRange(weekStartIso: string) {
  const start = new Date(weekStartIso);
  const end = new Date(start.getTime() + 6 * 86_400_000);
  const format = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  return `${format.format(start)} to ${format.format(end)}`;
}

function parseImportedSchedule(value: unknown): ImportedScheduleEvent[] {
  const rawEvents =
    value && typeof value === 'object' && !Array.isArray(value) && 'events' in value
      ? (value as { events: unknown }).events
      : value;
  if (!Array.isArray(rawEvents) || rawEvents.length > 100) {
    throw new Error('Paste a JSON object with 0–100 events in its "events" array.');
  }
  return rawEvents.map((value, index) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error(`Event ${index + 1} must be an object.`);
    }
    const event = value as Record<string, unknown>;
    const title = typeof event.title === 'string' ? event.title.trim() : '';
    const startTime = typeof event.startTime === 'string' ? event.startTime : '';
    const endTime = typeof event.endTime === 'string' ? event.endTime : '';
    if (!title || title.length > 200) throw new Error(`Event ${index + 1} needs a title under 200 characters.`);
    if (Number.isNaN(new Date(startTime).getTime()) || Number.isNaN(new Date(endTime).getTime())) {
      throw new Error(`Event ${index + 1} has an invalid startTime or endTime.`);
    }
    if (new Date(endTime).getTime() <= new Date(startTime).getTime()) {
      throw new Error(`Event ${index + 1} must end after it starts.`);
    }
    return {
      title,
      description: typeof event.description === 'string' ? event.description.trim().slice(0, 500) : '',
      startTime,
      endTime,
      category: typeof event.category === 'string' && event.category.trim()
        ? event.category.trim().slice(0, 40)
        : 'PERSONAL'
    };
  });
}

export default function AISchedulerModal({
  weekStartIso,
  existingScheduleText,
  existingAiScheduleText,
  savedPromptNotes,
  onSavePromptNotes,
  trellisUrl,
  onImport,
  showToast
}: WeekScheduleToolsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isTrellisOpen, setIsTrellisOpen] = useState(false);
  const [pasteValue, setPasteValue] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [promptNotes, setPromptNotes] = useState(savedPromptNotes);
  const [isSavingPromptNotes, setIsSavingPromptNotes] = useState(false);
  const [trellisToken, setTrellisToken] = useState<string | null>(null);
  const [trellisBoards, setTrellisBoards] = useState<{ id: string; name: string; role: string }[]>([]);
  const [trellisBoardId, setTrellisBoardId] = useState('');
  const [trellisTasksText, setTrellisTasksText] = useState('No Trellis board linked.');
  const trellisWindowRef = useRef<Window | null>(null);
  const trellisBoardStorageKey = 'syntgrid:trellis-board';

  const fetchTrellisTasks = useCallback(async (): Promise<string> => {
    const board = trellisBoards.find((item) => item.id === trellisBoardId);
    if (!board || !trellisToken) return 'No Trellis board linked.';
    const response = await fetch(`${trellisUrl}/api/board?id=${encodeURIComponent(board.id)}`, {
      headers: { Authorization: `Bearer ${trellisToken}` },
      cache: 'no-store'
    });
    if (!response.ok) throw new Error('Could not read the selected Trellis board.');
    const data = await response.json() as {
      l?: {
        n?: string;
        c?: {
          t?: string;
          d?: string;
          due?: string;
          done?: boolean;
          k?: { t?: string; done?: boolean }[];
        }[];
      }[];
    };
    const lines = (data.l ?? []).flatMap((list) =>
      (list.c ?? []).filter((card) => !card.done).map((card) => {
        const checklist = (card.k ?? []).filter((item) => !item.done).map((item) => item.t).filter(Boolean);
        return `- [${list.n ?? 'Unsorted'}] ${card.t ?? 'Untitled'}${card.due ? ` (due ${card.due})` : ''}${card.d ? ` — ${card.d}` : ''}${checklist.length ? `; open checklist: ${checklist.join(', ')}` : ''}`;
      })
    );
    return lines.length ? lines.join('\n') : 'No incomplete tasks on the selected Trellis board.';
  }, [trellisBoardId, trellisBoards, trellisToken, trellisUrl]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      const savedBoard = window.localStorage.getItem(trellisBoardStorageKey);
      if (savedBoard) {
        try {
          const parsed = JSON.parse(savedBoard) as { id?: string };
          if (parsed.id) setTrellisBoardId(parsed.id);
        } catch {
          window.localStorage.removeItem(trellisBoardStorageKey);
        }
      }
      const savedToken = window.sessionStorage.getItem('syntgrid:trellis-token');
      if (savedToken) setTrellisToken(savedToken);
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, []);

  useEffect(() => {
    const handleMessage = (event: MessageEvent<unknown>) => {
      if (event.origin !== new URL(trellisUrl).origin || event.source !== trellisWindowRef.current) return;
      const data = event.data as { type?: string; accessToken?: string };
      if (data.type === 'TRELLIS_SUPABASE_SESSION' && data.accessToken) {
        window.sessionStorage.setItem('syntgrid:trellis-token', data.accessToken);
        setTrellisToken(data.accessToken);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [trellisUrl]);

  useEffect(() => {
    if (!trellisToken) return;
    void fetch(`${trellisUrl}/api/boards`, {
      headers: { Authorization: `Bearer ${trellisToken}` }
    }).then(async (response) => {
      if (!response.ok) throw new Error('Could not read your Trellis boards.');
      return response.json() as Promise<{ boards: { id: string; name: string; role: string }[] }>;
    }).then((data) => {
      setTrellisBoards(data.boards);
      const savedBoard = window.localStorage.getItem(trellisBoardStorageKey);
      const savedBoardId = savedBoard ? (JSON.parse(savedBoard) as { id?: string }).id : '';
      const selectedBoard = data.boards.find((board) => board.id === savedBoardId) ?? data.boards[0];
      if (selectedBoard) {
        setTrellisBoardId(selectedBoard.id);
        window.localStorage.setItem(trellisBoardStorageKey, JSON.stringify(selectedBoard));
      }
    }).catch((error: unknown) => {
      window.sessionStorage.removeItem('syntgrid:trellis-token');
      setTrellisToken(null);
      showToast(error instanceof Error ? error.message : 'Could not link Trellis.');
    });
  }, [showToast, trellisToken, trellisUrl]);

  useEffect(() => {
    const board = trellisBoards.find((item) => item.id === trellisBoardId);
    if (board) window.localStorage.setItem(trellisBoardStorageKey, JSON.stringify(board));
  }, [trellisBoardId, trellisBoards]);

  useEffect(() => {
    const board = trellisBoards.find((item) => item.id === trellisBoardId);
    if (!board || !trellisToken) return;
    void fetch(`${trellisUrl}/api/board?id=${encodeURIComponent(board.id)}`, {
      headers: { Authorization: `Bearer ${trellisToken}` }
    }).then(async (response) => {
      if (!response.ok) throw new Error('Could not read the selected Trellis board.');
      return response.json() as Promise<{ l?: { n?: string; c?: { t?: string; d?: string; due?: string; done?: boolean; k?: { t?: string; done?: boolean }[] }[] }[] }>;
    }).then((data) => {
      const lines = (data.l ?? []).flatMap((list) =>
        (list.c ?? []).filter((card) => !card.done).map((card) => {
          const checklist = (card.k ?? []).filter((item) => !item.done).map((item) => item.t).filter(Boolean);
          return `- [${list.n ?? 'Unsorted'}] ${card.t ?? 'Untitled'}${card.due ? ` (due ${card.due})` : ''}${card.d ? ` — ${card.d}` : ''}${checklist.length ? `; open checklist: ${checklist.join(', ')}` : ''}`;
        })
      );
      setTrellisTasksText(lines.length ? lines.join('\n') : 'No incomplete tasks on the selected Trellis board.');
    }).catch((error: unknown) => showToast(error instanceof Error ? error.message : 'Could not read the selected Trellis board.'));
  }, [showToast, trellisBoardId, trellisBoards, trellisToken, trellisUrl]);

  const linkTrellis = () => {
    setIsTrellisOpen(true);
    trellisWindowRef.current = window.open(
      `${trellisUrl}?syntgridOrigin=${encodeURIComponent(window.location.origin)}`,
      'syntgrid-trellis',
      'popup,width=1100,height=800'
    );
    if (!trellisWindowRef.current) showToast('Allow popups to link Trellis.');
  };

  const copyWeekInfo = async () => {
    let currentTrellisTasks = trellisTasksText;
    try {
      currentTrellisTasks = await fetchTrellisTasks();
      setTrellisTasksText(currentTrellisTasks);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not refresh Trellis tasks.');
      return;
    }
    const text = `Create a schedule for ${formatWeekRange(weekStartIso)}.

Use only dates within this week. Do not overlap any occupied slot below.
Return ONLY valid JSON in this exact format:
{"events":[{"title":"Focused study","description":"Optional short notes","startTime":"2026-10-31T09:00:00+00:00","endTime":"2026-10-31T10:30:00+00:00","category":"STUDY"}]}

Rules:
- Every event must have title, description, startTime, endTime, and category.
- Return no more than 100 events.
- This import replaces only the existing AI-generated events below for this week.
- The events array must be exhaustive: return the complete desired AI schedule for the entire week, not only changes or additions.
- To rewrite an AI event, return its replacement in the new events array.
- To delete an AI event, leave it out of the new events array.
- Return an empty events array to delete all existing AI-generated events.
- Never modify or replace university, friend, or manually created personal events.
- Use ISO-8601 timestamps with timezone offsets.
- endTime must be after startTime.
- Keep events inside ${formatWeekRange(weekStartIso)}.
- Events must start and end on the same calendar date; do not cross midnight.
- Never overlap the occupied events below.
- Categories can be STUDY, SLEEP, MEAL, GYM, or PERSONAL.

Trellis tasks:
- It is not necessary to schedule every Trellis task.
- Prioritize urgent tasks, tasks due this week, and tasks that genuinely require work this week.
- If there is spare time, schedule a few lower-priority tasks that would otherwise be put off.
- Do not schedule completed tasks, and do not let Trellis work displace fixed occupied events.

${currentTrellisTasks}

Additional instructions from the user:
${promptNotes.trim() || 'None provided.'}

Occupied events:
${existingScheduleText}

Existing AI-generated events that may be rewritten or deleted:
${existingAiScheduleText}`;
    try {
      await navigator.clipboard.writeText(text);
      showToast('Week information and AI output format copied.');
    } catch {
      showToast('Could not copy week information. Check clipboard permissions.');
    }
  };

  const savePromptNotes = async () => {
    setIsSavingPromptNotes(true);
    try {
      await onSavePromptNotes(promptNotes);
      showToast('Extra AI scheduling instructions saved.');
    } finally {
      setIsSavingPromptNotes(false);
    }
  };

  const importSchedule = async () => {
    try {
      const parsed: unknown = JSON.parse(pasteValue);
      const events = parseImportedSchedule(parsed);
      setIsImporting(true);
      await onImport(events);
      setPasteValue('');
      setIsOpen(false);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not import this schedule.');
    } finally {
      setIsImporting(false);
    }
  };

  const schedulerWindow = (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/75 p-3 backdrop-blur-sm sm:p-5">
      <div className="flex max-h-[calc(100dvh-1.5rem)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-[#3b3b3b] bg-[#171717] shadow-2xl sm:max-h-[calc(100dvh-2.5rem)]">
        <div className="flex items-start justify-between border-b border-[#2b2b2b] p-5">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-emerald-300">manual AI workflow</p>
            <h2 className="mt-1 font-serif text-xl font-semibold text-white">AI scheduler</h2>
            <p className="mt-1 text-xs text-zinc-400">Copy your week context or import the AI-generated schedule for {formatWeekRange(weekStartIso)}.</p>
          </div>
          <button type="button" onClick={() => setIsOpen(false)} className="rounded-lg p-1.5 text-zinc-400 hover:bg-[#292929] hover:text-white" aria-label="Close AI scheduler">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-3 overflow-y-auto p-4 sm:p-5">
          <button type="button" onClick={() => void copyWeekInfo()} className="flex items-center gap-1.5 rounded-xl border border-sky-400/40 bg-sky-400/10 px-3 py-2 text-xs font-semibold text-sky-200 hover:bg-sky-400/20">
            <Clipboard className="h-3.5 w-3.5" /> Copy week info
          </button>
          <div className="space-y-2">
            <label htmlFor="ai-prompt-notes" className="text-xs font-semibold text-zinc-200">Extra scheduling instructions</label>
            <textarea
              id="ai-prompt-notes"
              value={promptNotes}
              onChange={(event) => setPromptNotes(event.target.value)}
              placeholder="Examples: protect my gym routine; prioritize exam preparation; avoid scheduling before 09:00."
              maxLength={20000}
              className="min-h-28 w-full resize-y rounded-xl border border-[#383838] bg-[#111] p-3 text-xs leading-relaxed text-white outline-none focus:border-sky-400"
            />
            <div className="flex justify-end">
              <button type="button" onClick={() => void savePromptNotes()} disabled={isSavingPromptNotes} className="rounded-lg border border-sky-400/40 bg-sky-400/10 px-3 py-1.5 text-xs font-semibold text-sky-200 hover:bg-sky-400/20 disabled:opacity-50">
                {isSavingPromptNotes ? 'Saving…' : 'Save instructions'}
              </button>
            </div>
          </div>
          <p className="rounded-xl border border-sky-400/30 bg-sky-400/10 p-3 text-xs leading-relaxed text-sky-100">
            Paste the copied prompt into your preferred AI model, then paste its JSON response below. The import replaces only AI-generated events; university, friend, and manually created events are preserved. Expected event keys: <code className="font-mono">{eventSchemaKeys}</code>.
          </p>
          <textarea
            autoFocus
            value={pasteValue}
            onChange={(event) => setPasteValue(event.target.value)}
            placeholder={'{"events":[{"title":"Study","description":"","startTime":"2026-10-31T09:00:00+00:00","endTime":"2026-10-31T10:30:00+00:00","category":"STUDY"}]}'}
            className="min-h-64 w-full resize-y rounded-xl border border-[#383838] bg-[#111] p-3 font-mono text-xs leading-relaxed text-white outline-none focus:border-emerald-400"
          />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setIsOpen(false)} className="rounded-xl border border-[#383838] bg-[#242424] px-4 py-2.5 text-xs font-semibold text-zinc-200 hover:bg-[#2e2e2e]">Close</button>
            <button type="button" onClick={() => void importSchedule()} disabled={isImporting || !pasteValue.trim()} className="rounded-xl bg-emerald-400 px-4 py-2.5 text-xs font-bold text-[#171717] hover:brightness-110 disabled:opacity-50">
              <Download className="mr-1 inline h-3.5 w-3.5" />{isImporting ? 'Importing…' : 'Import to My Calendar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const trellisWindow = (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/75 p-3 backdrop-blur-sm sm:p-5">
      <div className="w-full max-w-lg rounded-2xl border border-[#3b3b3b] bg-[#171717] p-5 shadow-2xl">
        <div className="flex items-start justify-between">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-violet-300">task context</p>
            <h2 className="mt-1 font-serif text-xl font-semibold text-white">Trellis</h2>
            <p className="mt-1 text-xs text-zinc-400">Choose the board whose urgent and current tasks should be included in the AI prompt.</p>
          </div>
          <button type="button" onClick={() => setIsTrellisOpen(false)} className="rounded-lg p-1.5 text-zinc-400 hover:bg-[#292929] hover:text-white" aria-label="Close Trellis">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-5 space-y-3">
          <button type="button" onClick={linkTrellis} className="flex items-center gap-1.5 rounded-xl border border-violet-400/40 bg-violet-400/10 px-3 py-2 text-xs font-semibold text-violet-200 hover:bg-violet-400/20">
            <Link2 className="h-3.5 w-3.5" /> {trellisToken ? 'Refresh Trellis connection' : 'Connect Trellis'}
          </button>
          {trellisBoards.length > 0 && (
            <select value={trellisBoardId} onChange={(event) => setTrellisBoardId(event.target.value)} className="w-full rounded-xl border border-violet-400/40 bg-[#111] px-3 py-2.5 text-xs text-violet-100" aria-label="Trellis board">
              {trellisBoards.map((board) => <option key={board.id} value={board.id}>{board.name}</option>)}
            </select>
          )}
          <p className="max-h-48 overflow-y-auto rounded-xl border border-[#383838] bg-[#111] p-3 whitespace-pre-wrap text-xs leading-relaxed text-zinc-300">{trellisTasksText}</p>
          <div className="flex justify-end">
            <button type="button" onClick={() => setIsTrellisOpen(false)} className="rounded-xl bg-[#242424] px-4 py-2.5 text-xs font-semibold text-zinc-200 hover:bg-[#2e2e2e]">Done</button>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-1.5 rounded-md border border-sky-400/40 bg-sky-400/10 px-2.5 py-1.5 text-xs font-semibold text-sky-200 transition hover:bg-sky-400/20"
      >
        <Clipboard className="h-3.5 w-3.5" /> AI scheduler
      </button>
      <button
        type="button"
        onClick={() => setIsTrellisOpen(true)}
        className="flex items-center gap-1.5 rounded-md border border-violet-400/40 bg-violet-400/10 px-2.5 py-1.5 text-xs font-semibold text-violet-200 transition hover:bg-violet-400/20"
      >
        <Link2 className="h-3.5 w-3.5" />
        <span className="max-w-32 truncate">{trellisBoards.find((board) => board.id === trellisBoardId)?.name
          ? `Trellis: ${trellisBoards.find((board) => board.id === trellisBoardId)?.name}`
          : 'Trellis'}</span>
      </button>
      {isOpen && createPortal(
        schedulerWindow,
        document.body
      )}
      {isTrellisOpen && createPortal(trellisWindow, document.body)}
    </>
  );
}
