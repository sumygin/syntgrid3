'use client';

import { Clipboard, Download, FileUp, Link2, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
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
  trellisUrl,
  onImport,
  showToast
}: WeekScheduleToolsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [pasteValue, setPasteValue] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [trellisToken, setTrellisToken] = useState<string | null>(null);
  const [trellisBoards, setTrellisBoards] = useState<{ id: string; name: string; role: string }[]>([]);
  const [trellisBoardId, setTrellisBoardId] = useState('');
  const [trellisTasksText, setTrellisTasksText] = useState('No Trellis board linked.');
  const trellisWindowRef = useRef<Window | null>(null);

  useEffect(() => {
    const handleMessage = (event: MessageEvent<unknown>) => {
      if (event.origin !== new URL(trellisUrl).origin || event.source !== trellisWindowRef.current) return;
      const data = event.data as { type?: string; accessToken?: string };
      if (data.type === 'TRELLIS_SUPABASE_SESSION' && data.accessToken) setTrellisToken(data.accessToken);
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
      if (data.boards[0]) setTrellisBoardId(data.boards[0].id);
    }).catch((error: unknown) => showToast(error instanceof Error ? error.message : 'Could not link Trellis.'));
  }, [showToast, trellisToken, trellisUrl]);

  useEffect(() => {
    const board = trellisBoards.find((item) => item.id === trellisBoardId);
    if (!board || !trellisToken) return;
    void fetch(`${trellisUrl}/api/board?name=${encodeURIComponent(board.name)}`, {
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
    trellisWindowRef.current = window.open(
      `${trellisUrl}?syntgridOrigin=${encodeURIComponent(window.location.origin)}`,
      'syntgrid-trellis',
      'popup,width=1100,height=800'
    );
    if (!trellisWindowRef.current) showToast('Allow popups to link Trellis.');
  };

  const copyWeekInfo = async () => {
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

${trellisTasksText}

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

  return (
    <>
      <button
        type="button"
        onClick={() => void copyWeekInfo()}
        className="flex items-center gap-1.5 rounded-md border border-sky-400/40 bg-sky-400/10 px-2.5 py-1.5 text-xs font-semibold text-sky-200 transition hover:bg-sky-400/20"
      >
        <Clipboard className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Copy week info</span>
        <span className="sm:hidden">Copy week</span>
      </button>
      <button
        type="button"
        onClick={linkTrellis}
        className="flex items-center gap-1.5 rounded-md border border-violet-400/40 bg-violet-400/10 px-2.5 py-1.5 text-xs font-semibold text-violet-200 transition hover:bg-violet-400/20"
      >
        <Link2 className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Link Trellis</span>
        <span className="sm:hidden">Trellis</span>
      </button>
      {trellisBoards.length > 0 && (
        <select
          value={trellisBoardId}
          onChange={(event) => setTrellisBoardId(event.target.value)}
          className="max-w-40 rounded-md border border-violet-400/40 bg-[#171717] px-2 py-1.5 text-xs text-violet-100"
          aria-label="Trellis board"
        >
          {trellisBoards.map((board) => <option key={board.id} value={board.id}>{board.name}</option>)}
        </select>
      )}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-1.5 rounded-md border border-emerald-400/40 bg-emerald-400/10 px-2.5 py-1.5 text-xs font-semibold text-emerald-200 transition hover:bg-emerald-400/20"
      >
        <FileUp className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Import AI schedule</span>
        <span className="sm:hidden">Import</span>
      </button>
      {isOpen && createPortal(
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/75 p-3 backdrop-blur-sm sm:p-5">
          <div className="flex max-h-[calc(100dvh-1.5rem)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-[#3b3b3b] bg-[#171717] shadow-2xl sm:max-h-[calc(100dvh-2.5rem)]">
            <div className="flex items-start justify-between border-b border-[#2b2b2b] p-5">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-emerald-300">manual AI workflow</p>
                <h2 className="mt-1 font-serif text-xl font-semibold text-white">Import your schedule</h2>
                <p className="mt-1 text-xs text-zinc-400">Paste the JSON returned by your AI model for {formatWeekRange(weekStartIso)}.</p>
              </div>
              <button type="button" onClick={() => setIsOpen(false)} className="rounded-lg p-1.5 text-zinc-400 hover:bg-[#292929] hover:text-white" aria-label="Close import schedule">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3 overflow-y-auto p-4 sm:p-5">
              <p className="rounded-xl border border-sky-400/30 bg-sky-400/10 p-3 text-xs leading-relaxed text-sky-100">
                First click <strong>Copy week info</strong>, paste it into your preferred AI model, then paste its JSON response below. The import replaces only AI-generated events; university, friend, and manually created events are preserved. Expected event keys: <code className="font-mono">{eventSchemaKeys}</code>.
              </p>
              <textarea
                autoFocus
                value={pasteValue}
                onChange={(event) => setPasteValue(event.target.value)}
                placeholder={'{"events":[{"title":"Study","description":"","startTime":"2026-10-31T09:00:00+00:00","endTime":"2026-10-31T10:30:00+00:00","category":"STUDY"}]}'} 
                className="min-h-64 w-full resize-y rounded-xl border border-[#383838] bg-[#111] p-3 font-mono text-xs leading-relaxed text-white outline-none focus:border-emerald-400"
              />
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setIsOpen(false)} className="rounded-xl border border-[#383838] bg-[#242424] px-4 py-2.5 text-xs font-semibold text-zinc-200 hover:bg-[#2e2e2e]">Cancel</button>
                <button type="button" onClick={() => void importSchedule()} disabled={isImporting || !pasteValue.trim()} className="rounded-xl bg-emerald-400 px-4 py-2.5 text-xs font-bold text-[#171717] hover:brightness-110 disabled:opacity-50">
                  <Download className="mr-1 inline h-3.5 w-3.5" />{isImporting ? 'Importing…' : 'Import to My Calendar'}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
