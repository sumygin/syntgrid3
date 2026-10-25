import Link from "next/link";

export const metadata = {
  title: "Terms of Service | syntgrid",
  description: "Terms for using syntgrid to upload, edit, compare, and share calendars.",
};

export default function TermsOfServicePage() {
  return (
    <main className="min-h-screen bg-[#121212] px-4 py-10 text-zinc-100">
      <article className="mx-auto max-w-3xl">
        <Link href="/" className="text-sm text-sky-300 hover:underline">
          ← Back to syntgrid
        </Link>
        <header className="mt-7 border-b border-[#2c2c2c] pb-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">
            Legal
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">Terms of Service</h1>
          <p className="mt-3 text-sm text-zinc-400">Last updated: 25 October 2026</p>
        </header>

        <div className="space-y-7 py-7 text-sm leading-relaxed text-zinc-300">
          <section>
            <h2 className="text-lg font-semibold text-white">Using syntgrid</h2>
            <p className="mt-2">
              Syntgrid lets you sign in, upload and edit calendar files, compare timetables, and
              share calendars with accepted friends. By using the service, you agree to these
              terms. If you do not agree, do not use syntgrid.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white">Your account and uploads</h2>
            <p className="mt-2">
              You are responsible for your account and for the files and information you upload.
              Upload only calendar content that you are permitted to use and share. Do not upload
              confidential, sensitive, unlawful, or harmful material, or content that infringes
              another person&apos;s rights.
            </p>
            <p className="mt-2">
              You are responsible for checking imported and edited event details for accuracy.
              Calendar conversion may omit or change information that the application does not
              support.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white">Sharing</h2>
            <p className="mt-2">
              Your uploaded personal calendar may be viewed by users with whom you have an
              accepted friendship in syntgrid. You are responsible for choosing whom to accept
              and ensuring you have permission to share the calendar with them. Do not rely on
              removing access to retrieve copies someone has already made.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white">Acceptable use</h2>
            <p className="mt-2">
              Do not misuse syntgrid, attempt to access another user&apos;s account or data
              without authorization, interfere with the service, or use it in violation of
              applicable law or institutional rules. Access may be limited or suspended to
              protect users or the service.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white">Availability and disclaimer</h2>
            <p className="mt-2">
              Syntgrid is provided on an as-available basis. The service may change, be
              interrupted, or become unavailable, and calendar data should not be treated as the
              sole or authoritative source for attendance, deadlines, room bookings, or other
              important decisions. Verify important information with its original source.
            </p>
            <p className="mt-2">
              To the extent permitted by applicable law, the service is provided without
              warranties of uninterrupted availability, error-free operation, or calendar
              accuracy. These terms do not limit rights or remedies that cannot legally be
              excluded.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white">Changes and contact</h2>
            <p className="mt-2">
              These terms may be updated as the service changes. Continued use after updated
              terms are made available means you accept the changes. The operator of this
              deployment should provide a contact address and identify the responsible
              organization before offering syntgrid publicly. This page is a starting point,
              not legal advice; have it reviewed for the intended deployment and jurisdiction.
            </p>
          </section>
        </div>

        <nav className="flex gap-4 border-t border-[#2c2c2c] pt-5 text-sm">
          <Link href="/privacy" className="text-sky-300 hover:underline">
            Privacy Policy
          </Link>
          <Link href="/tutorial" className="text-sky-300 hover:underline">
            Calendar tutorial
          </Link>
        </nav>
      </article>
    </main>
  );
}
