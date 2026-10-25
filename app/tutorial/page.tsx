import Link from "next/link";

const steps = [
  {
    title: "Open your Imperial calendar",
    description:
      "Sign in to Imperial Microsoft 365 and open Outlook Calendar. Select the specific Imperial timetable calendar you want to share, not your general personal calendar."
  },
  {
    title: "Export that calendar as an .ics file",
    description:
      "In classic Outlook for Windows, open the calendar, choose File → Save Calendar, then select More Options. Choose the date range and Full details, and save the file with the .ics format. In Outlook on the web or the new Outlook, open Settings → Calendar → Shared calendars → Publish a calendar, select the Imperial calendar and copy its ICS link. If Outlook opens the link as calendar text, save that content to a file ending in .ics."
  },
  {
    title: "Keep the export private",
    description:
      "Publishing an ICS link may make the calendar accessible to anyone who has that link. Only publish if Imperial’s policy allows it and you are comfortable with the sharing setting. You can instead export a local .ics file from classic Outlook."
  },
  {
    title: "Sign in to syntgrid",
    description:
      "Use either Google or Microsoft as your syntgrid login. This is only for your account identity; syntgrid does not read or import the calendar attached to that Google or Microsoft account."
  },
  {
    title: "Upload your Imperial .ics file",
    description:
      "In the calendar workspace, choose Add Friend or Room Timetable → Upload Room / Custom File. Upload the .ics file, give it a name, then choose Save as My Calendar. The uploaded events are saved to your syntgrid account and replace the personal calendar currently linked to it."
  },
  {
    title: "Review and edit what you share",
    description:
      "Use the pencil button beside My Calendar to edit event titles, locations, details, days and times, or remove/add events. Save your changes to update the calendar stored in your account. Accepted friends can then load the updated calendar in their comparison view."
  }
];

export default function CalendarTutorialPage() {
  return (
    <main className="min-h-screen bg-[#121212] px-4 py-10 text-zinc-100">
      <div className="mx-auto max-w-3xl">
        <Link href="/" className="text-sm text-sky-300 hover:underline">
          ← Back to syntgrid
        </Link>
        <header className="mt-7">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">
            Calendar setup
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">
            Export your Imperial Outlook calendar
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-zinc-400">
            Upload the particular Imperial timetable you want to compare. Your Google or
            Microsoft sign-in is only used to identify your syntgrid account; its calendar is
            never connected or imported.
          </p>
        </header>

        <ol className="mt-8 space-y-4">
          {steps.map((step, index) => (
            <li
              key={step.title}
              className="flex gap-4 rounded-2xl border border-[#2c2c2c] bg-[#191919] p-5"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-400/15 text-sm font-bold text-emerald-300">
                {index + 1}
              </span>
              <div>
                <h2 className="text-sm font-semibold text-white">{step.title}</h2>
                <p className="mt-1.5 text-sm leading-relaxed text-zinc-400">
                  {step.description}
                </p>
              </div>
            </li>
          ))}
        </ol>

        <div className="mt-6 rounded-xl border border-sky-400/20 bg-sky-400/5 p-4 text-xs leading-relaxed text-sky-100/80">
          Syntgrid stores the uploaded calendar source and parsed events against your signed-in
          account. Only accepted friends can retrieve the saved calendar through the app.
        </div>

        <Link
          href="/"
          className="mt-6 inline-flex rounded-xl bg-emerald-400 px-4 py-2.5 text-sm font-bold text-[#121212] hover:brightness-110"
        >
          Go to your calendar
        </Link>
      </div>
    </main>
  );
}
