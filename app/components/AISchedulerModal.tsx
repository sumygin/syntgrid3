'use client';

import { Sparkles, X, Check, Undo2 } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useState } from 'react';

export type AiEventCategory = 'STUDY' | 'SLEEP' | 'MEAL' | 'GYM' | 'PERSONAL';

export interface AiScheduleEvent {
  id?: string;
  batchId?: string;
  title: string;
  description: string | null;
  startTime: string;
  endTime: string;
  category: AiEventCategory;
  color?: string;
}

interface AISchedulerModalProps {
  weekStartIso: string;
  currentIso: string;
  existingScheduleText: string;
  stagedEvents: AiScheduleEvent[];
  latestBatchId: string | null;
  hasUndoBatch: boolean;
  onStage: (events: AiScheduleEvent[]) => void;
  onCommit: (batchId: string, events: AiScheduleEvent[]) => void;
  onDiscard: () => void;
  onUndo: () => void;
  showToast: (message: string) => void;
}

async function readJson<T>(response: Response): Promise<T> {
  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message = data && typeof data === 'object' && 'error' in data && typeof data.error === 'string'
      ? data.error
      : `Request failed (HTTP ${response.status}).`;
    throw new Error(message);
  }
  return data as T;
}

const categoryColors: Record<AiEventCategory, string> = {
  STUDY: 'border-sky-400/50 bg-sky-400/10 text-sky-200',
  SLEEP: 'border-violet-400/50 bg-violet-400/10 text-violet-200',
  MEAL: 'border-amber-400/50 bg-amber-400/10 text-amber-200',
  GYM: 'border-emerald-400/50 bg-emerald-400/10 text-emerald-200',
  PERSONAL: 'border-rose-400/50 bg-rose-400/10 text-rose-200'
};

const AI_BATCH_COLORS = ['#38bdf8', '#c084fc', '#fb7185', '#34d399', '#fbbf24', '#2dd4bf', '#818cf8'];

function colorForGeneration(generation: number) {
  return AI_BATCH_COLORS[generation % AI_BATCH_COLORS.length];
}

function formatEventTime(value: string) {
  return new Intl.DateTimeFormat(undefined, { weekday: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

export default function AISchedulerModal({
  weekStartIso,
  currentIso,
  existingScheduleText,
  stagedEvents,
  latestBatchId,
  hasUndoBatch,
  onStage,
  onCommit,
  onDiscard,
  onUndo,
  showToast
}: AISchedulerModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [reasoning, setReasoning] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);
  const [isUndoing, setIsUndoing] = useState(false);
  const [generationNumber, setGenerationNumber] = useState(0);

  const generate = async () => {
    if (!prompt.trim()) {
      showToast('Describe what you want to schedule first.');
      return;
    }
    setIsGenerating(true);
    try {
      const response = await fetch('/api/ai-schedule/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, existingScheduleText, weekStartIso, currentIso })
      });
      const result = await readJson<{ reasoning: string; events: AiScheduleEvent[] }>(response);
      setReasoning(result.reasoning);
      const color = colorForGeneration(generationNumber);
      onStage(result.events.map((event) => ({ ...event, color })));
      setGenerationNumber((value) => value + 1);
      showToast(`${result.events.length} event${result.events.length === 1 ? '' : 's'} ready for review.`);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not generate a schedule.');
    } finally {
      setIsGenerating(false);
    }
  };

  const commit = async () => {
    setIsCommitting(true);
    try {
      const response = await fetch('/api/ai-schedule/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ events: stagedEvents })
      });
      const result = await readJson<{ batchId: string; events: AiScheduleEvent[] }>(response);
      onCommit(result.batchId, result.events);
      setReasoning('');
      showToast('AI schedule saved.');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not save the schedule.');
    } finally {
      setIsCommitting(false);
    }
  };

  const undo = async () => {
    setIsUndoing(true);
    try {
      const response = await fetch('/api/ai-schedule/undo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batchId: latestBatchId })
      });
      await readJson<{ deletedCount: number }>(response);
      onUndo();
      showToast('Last AI schedule undone.');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not undo the schedule.');
    } finally {
      setIsUndoing(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-1.5 rounded-md border border-fuchsia-400/40 bg-fuchsia-400/10 px-2.5 py-1.5 text-xs font-semibold text-fuchsia-200 transition hover:bg-fuchsia-400/20"
      >
        <Sparkles className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">AI Week Scheduler</span>
        <span className="sm:hidden">AI plan</span>
      </button>
      {hasUndoBatch && (
        <button
          type="button"
          onClick={() => void undo()}
          disabled={isUndoing}
          className="flex items-center gap-1.5 rounded-md border border-zinc-600 bg-zinc-800 px-2.5 py-1.5 text-xs font-medium text-zinc-200 transition hover:bg-zinc-700 disabled:opacity-50"
        >
          <Undo2 className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">{isUndoing ? 'Undoing…' : 'Undo AI schedule'}</span>
        </button>
      )}
      {isOpen && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-3 backdrop-blur-sm sm:p-5">
          <aside className="flex max-h-[calc(100dvh-1.5rem)] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-[#3b3b3b] bg-[#171717] shadow-2xl sm:max-h-[calc(100dvh-2.5rem)]">
            <div className="flex items-start justify-between border-b border-[#2b2b2b] p-5">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-fuchsia-300">syntgrid intelligence</p>
                <h2 className="mt-1 font-serif text-xl font-semibold text-white">Plan your week</h2>
                <p className="mt-1 text-xs text-zinc-400">Your existing calendars are hard constraints.</p>
              </div>
              <button type="button" onClick={() => setIsOpen(false)} className="rounded-lg p-1.5 text-zinc-400 hover:bg-[#292929] hover:text-white" aria-label="Close AI scheduler">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
              <label className="block text-xs text-zinc-400">
                What should I plan?
                <textarea
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                  rows={5}
                  maxLength={4000}
                  placeholder="Plan focused study blocks, meals, gym, and a consistent sleep routine around my commitments."
                  className="mt-1 w-full resize-y rounded-xl border border-[#383838] bg-[#111] px-3 py-2.5 text-sm text-white outline-none focus:border-fuchsia-400"
                />
              </label>
              <button type="button" onClick={() => void generate()} disabled={isGenerating} className="flex w-full items-center justify-center gap-2 rounded-xl bg-fuchsia-400 px-4 py-2.5 text-sm font-bold text-[#171717] transition hover:brightness-110 disabled:opacity-50">
                <Sparkles className="h-4 w-4" />
                {isGenerating ? 'Generating plan…' : 'Generate Plan'}
              </button>
              {reasoning && <p className="rounded-xl border border-[#343434] bg-[#111] p-3 text-xs leading-relaxed text-zinc-300">{reasoning}</p>}
              {stagedEvents.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Preview ({stagedEvents.length})</h3>
                    <span className="font-mono text-[10px] text-fuchsia-300">GHOST MODE</span>
                  </div>
                  {stagedEvents.map((event, index) => (
                    <div key={`${event.startTime}-${event.title}-${index}`} className={`rounded-xl border p-3 ${categoryColors[event.category]}`}>
                      <p className="text-sm font-semibold">{event.title}</p>
                      <p className="mt-1 text-[11px] opacity-80">{formatEventTime(event.startTime)} – {new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(new Date(event.endTime))}</p>
                      {event.description && <p className="mt-1 text-[11px] opacity-70">{event.description}</p>}
                    </div>
                  ))}
                  <div className="flex gap-2 pt-2">
                    <button type="button" onClick={onDiscard} className="flex-1 rounded-xl border border-[#383838] bg-[#242424] px-3 py-2.5 text-xs font-semibold text-zinc-200 hover:bg-[#2e2e2e]">Discard</button>
                    <button type="button" onClick={() => void commit()} disabled={isCommitting} className="flex-1 rounded-xl bg-emerald-400 px-3 py-2.5 text-xs font-bold text-[#171717] hover:brightness-110 disabled:opacity-50">
                      <Check className="mr-1 inline h-3.5 w-3.5" />{isCommitting ? 'Saving…' : 'Accept & Save'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </aside>
        </div>,
        document.body
      )}
    </>
  );
}
