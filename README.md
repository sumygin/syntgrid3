This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Authentication and calendar setup

Configure NextAuth with `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, and the provider credentials
`GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` and
`AZURE_AD_CLIENT_ID` / `AZURE_AD_CLIENT_SECRET` (optionally `AZURE_AD_TENANT_ID`).
Set `DATABASE_URL` to the MongoDB connection string used by Prisma.
After applying schema changes, run `npx prisma db push` from the app directory.

For local Google OAuth, set `NEXTAUTH_URL=http://localhost:3000` and add
`http://localhost:3000/api/auth/callback/google` as an authorized redirect URI in the
Google OAuth client. For a deployed app, set `NEXTAUTH_URL` to its public HTTPS origin and
register `<NEXTAUTH_URL>/api/auth/callback/google` instead. Add both Google credentials to
the server environment and restart/redeploy; Google sign-in is hidden until both are set.

Google and Microsoft are used only to sign in. Users upload the specific Imperial Outlook
`.ics` file they want to compare; syntgrid stores that file and its parsed events on their
account. Calendar data is shared only with accepted friends. The in-app tutorial is at
`/tutorial`.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
