import Link from "next/link";

const uploadSteps = [
  {
    title: "Sign in",
    description: "Use Google or Microsoft to open your syntgrid account."
  },
  {
    title: "Upload your .ics file",
    description:
      "Choose Add Friend or Room Timetable → Upload Room / Custom File. Pick the .ics file you just saved."
  },
  {
    title: "Choose who can see it",
    description:
      "Choose My Calendar to share it with accepted friends, or Extra calendar to keep it private."
  }
];

export default function CalendarTutorialPage() {
  return (
    <main className="min-h-screen bg-[#121212] px-4 py-10 text-zinc-100">
      <div className="mx-auto max-w-4xl">
        <Link href="/" className="text-sm text-sky-300 hover:underline">
          ← Back to syntgrid
        </Link>

        <header className="mt-7">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">
            Quick guide
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">
            Upload your Imperial timetable
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-zinc-400">
            Export the specific Imperial Outlook calendar you want to use as an <strong className="text-zinc-200">.ics file</strong>, then upload it to syntgrid.
          </p>
        </header>

        <section className="mt-9">
          <div className="mb-4 flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-sky-400/15 text-sm font-bold text-sky-300">
              1
            </span>
            <div>
              <h2 className="text-lg font-semibold text-white">Export from Outlook</h2>
              <p className="text-xs text-zinc-500">Choose the instructions for your version of Outlook.</p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <article className="rounded-2xl border border-[#303030] bg-[#191919] p-5">
              <div className="mb-4 inline-flex rounded-full bg-violet-400/10 px-2.5 py-1 text-[11px] font-semibold text-violet-200">
                Classic Outlook · Windows
              </div>
              <ol className="space-y-3 text-sm leading-relaxed text-zinc-300">
                <li><span className="mr-2 font-bold text-violet-300">1.</span>Open the Imperial timetable calendar.</li>
                <li><span className="mr-2 font-bold text-violet-300">2.</span>Select <strong className="text-white">File → Save Calendar</strong>.</li>
                <li><span className="mr-2 font-bold text-violet-300">3.</span>Choose <strong className="text-white">More Options</strong>, set your date range, and select <strong className="text-white">Full details</strong>.</li>
                <li><span className="mr-2 font-bold text-violet-300">4.</span>Save the file. Make sure its name ends in <strong className="text-white">.ics</strong>.</li>
              </ol>
            </article>

            <article className="rounded-2xl border border-[#303030] bg-[#191919] p-5">
              <div className="mb-4 inline-flex rounded-full bg-sky-400/10 px-2.5 py-1 text-[11px] font-semibold text-sky-200">
                Outlook on the web · New Outlook
              </div>
              <ol className="space-y-3 text-sm leading-relaxed text-zinc-300">
                <li><span className="mr-2 font-bold text-sky-300">1.</span>Open <strong className="text-white">Settings → Calendar → Shared calendars</strong>.</li>
                <li><span className="mr-2 font-bold text-sky-300">2.</span>Under <strong className="text-white">Publish a calendar</strong>, select your Imperial timetable.</li>
                <li><span className="mr-2 font-bold text-sky-300">3.</span>Copy and open the <strong className="text-white">ICS link</strong> to download the calendar.</li>
                <li><span className="mr-2 font-bold text-sky-300">4.</span>If it opens as text, save that page as a file ending in <strong className="text-white">.ics</strong>.</li>
              </ol>
            </article>
          </div>

          <div className="mt-4 rounded-xl border border-amber-400/25 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
            <strong>Important:</strong> Export the Imperial timetable you want to use—not your general Google or Outlook calendar.
          </div>
        </section>

        <section className="mt-9">
          <div className="mb-4 flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-400/15 text-sm font-bold text-emerald-300">
              2
            </span>
            <div>
              <h2 className="text-lg font-semibold text-white">Add it to syntgrid</h2>
              <p className="text-xs text-zinc-500">Your uploaded file supplies your timetable.</p>
            </div>
          </div>

          <ol className="grid gap-3 md:grid-cols-3">
            {uploadSteps.map((step, index) => (
              <li key={step.title} className="rounded-2xl border border-[#2c2c2c] bg-[#191919] p-4">
                <span className="text-xs font-bold uppercase tracking-wide text-emerald-300">
                  Step {index + 1}
                </span>
                <h3 className="mt-2 text-sm font-semibold text-white">{step.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-zinc-400">{step.description}</p>
              </li>
            ))}
          </ol>

          <div className="mt-4 rounded-xl border border-rose-400/25 bg-rose-400/10 px-4 py-3 text-sm leading-relaxed text-rose-100">
            <strong>My Calendar</strong> replaces the personal calendar currently linked to your account and is visible to accepted friends. <strong>Extra calendar</strong> stays private to you.
          </div>
        </section>

        <Link
          href="/"
          className="mt-7 inline-flex rounded-xl bg-emerald-400 px-4 py-2.5 text-sm font-bold text-[#121212] hover:brightness-110"
        >
          Go to your calendar
        </Link>
      </div>
    </main>
  );
}
