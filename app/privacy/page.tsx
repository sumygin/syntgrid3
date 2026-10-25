import Link from "next/link";

export const metadata = {
  title: "Privacy Policy | syntgrid",
  description: "How syntgrid handles account details, uploaded calendars, and sharing.",
};

export default function PrivacyPolicyPage() {
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
          <h1 className="mt-2 text-3xl font-bold tracking-tight">Privacy Policy</h1>
          <p className="mt-3 text-sm text-zinc-400">Last updated: 25 October 2026</p>
        </header>

        <div className="space-y-7 py-7 text-sm leading-relaxed text-zinc-300">
          <section>
            <h2 className="text-lg font-semibold text-white">Information we handle</h2>
            <p className="mt-2">
              When you sign in, syntgrid receives account information made available by your
              chosen Google or Microsoft identity provider, such as your name and email address.
              Syntgrid uses this information to identify your account. It does not request
              permission to read or import the calendar associated with that provider account.
            </p>
            <p className="mt-2">
              If you upload an iCalendar (.ics) file, syntgrid stores the uploaded calendar text
              and the parsed event information, including event titles, times, locations, and
              descriptions. If you add or edit events, the updated event data and generated
              calendar text are stored with your account. Friend requests and accepted
              friendship records are also stored to provide calendar sharing.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white">How information is used</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>To authenticate you and associate your calendars with your account.</li>
              <li>To display, edit, and compare calendars you choose to upload.</li>
              <li>To manage friend requests and show your calendar to accepted friends.</li>
              <li>To operate, maintain, and protect the service.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white">Calendar sharing</h2>
            <p className="mt-2">
              A calendar you upload is associated with your account. Other users can retrieve
              it through syntgrid only after a friendship is accepted. Do not upload information
              you do not want included in that sharing. Anyone who has already viewed or copied
              information may retain a copy outside syntgrid.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white">Storage and service providers</h2>
            <p className="mt-2">
              Account and calendar records are stored in the application&apos;s configured
              database. Authentication is provided by Google or Microsoft when you choose that
              option. The application may also rely on its hosting and infrastructure providers
              to run the service. Those providers may process technical information, such as
              requests and security logs, as part of operating their services.
            </p>
            <p className="mt-2">
              Information is retained while it is needed to operate your account and the
              features you use. The current application does not provide a self-service account
              or data deletion control. Do not upload sensitive or confidential information.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white">Your choices and responsibilities</h2>
            <p className="mt-2">
              You can choose not to upload a calendar and can remove a friend connection in the
              application. Before uploading or sharing a calendar, make sure you have permission
              to use and share its contents. For questions or deletion requests, contact the
              person or organization operating this syntgrid deployment.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white">Changes and contact</h2>
            <p className="mt-2">
              This policy may be updated as the service changes. The operator of this deployment
              should provide a contact address and identify the responsible organization before
              making syntgrid available to the public. This page is a product privacy notice,
              not legal advice.
            </p>
          </section>
        </div>

        <nav className="flex gap-4 border-t border-[#2c2c2c] pt-5 text-sm">
          <Link href="/terms" className="text-sky-300 hover:underline">
            Terms of Service
          </Link>
          <Link href="/tutorial" className="text-sky-300 hover:underline">
            Calendar tutorial
          </Link>
        </nav>
      </article>
    </main>
  );
}
