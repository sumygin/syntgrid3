import NextAuth, { NextAuthOptions } from "next-auth";
import AzureADProvider from "next-auth/providers/azure-ad";
import GoogleProvider from "next-auth/providers/google";

const azureTenantId = process.env.AZURE_AD_TENANT_ID?.trim();
const isConfiguredAzureTenant =
  Boolean(azureTenantId) &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    azureTenantId ?? ""
  );

export const authOptions: NextAuthOptions = {
  providers: [
    ...(isConfiguredAzureTenant &&
    process.env.AZURE_AD_CLIENT_ID &&
    process.env.AZURE_AD_CLIENT_SECRET
      ? [
          AzureADProvider({
            clientId: process.env.AZURE_AD_CLIENT_ID,
            clientSecret: process.env.AZURE_AD_CLIENT_SECRET,
            tenantId: azureTenantId,
            idToken: true,
            authorization: {
              params: {
                scope: "openid profile email",
              },
            },
            profile(profile) {
              const preferredUsername =
                "preferred_username" in profile &&
                typeof profile.preferred_username === "string"
                  ? profile.preferred_username
                  : null;
              return {
                id: profile.sub ?? "",
                name: profile.name ?? preferredUsername,
                email: profile.email ?? preferredUsername,
                image: null,
              };
            },
          }),
        ]
      : []),
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          }),
        ]
      : []),
  ],
  callbacks: {
    async signIn({ account, profile }) {
      if (account?.provider !== "azure-ad") return true;
      return Boolean(
        isConfiguredAzureTenant &&
        profile &&
        "tid" in profile &&
        profile.tid === azureTenantId
      );
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };