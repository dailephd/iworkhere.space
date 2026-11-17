"use client";

import { useState } from "react";
import { createStytchUIClient, IdentityProvider, Products, StytchLogin, StytchProvider, useStytchSession } from "@stytch/nextjs";

function Consent() {
    const { session, isInitialized, fromCache } = useStytchSession();
    if (!isInitialized || fromCache) return <p>Checking sign-in…</p>;
    return session ? <IdentityProvider /> : <StytchLogin config={{ products: [Products.otp], otpOptions: { methods: ["email"], expirationMinutes: 10 } }} />;
}

export interface AuthorizationProp { publicToken: string; environment?: "test" | "live"; customBaseUrl?: string }

export function Authorization({ publicToken, environment = "test", customBaseUrl }: AuthorizationProp) {
    const [stytch] = useState(() => {
        if (environment === "live") return createStytchUIClient(publicToken, { customBaseUrl, cookieOptions: {
            opaqueTokenCookieName: "iworkhere_live_stytch_session", jwtCookieName: "iworkhere_live_stytch_session_jwt",
            istCookieName: "iworkhere_live_stytch_intermediate", path: "/oauth/live",
        } });
        return createStytchUIClient(publicToken, customBaseUrl ? { customBaseUrl } : undefined);
    });
    return <main><h1>Authorize observability reporting</h1><p>Stytch {environment === "live" ? "Live" : "Test"} sign-in and consent. Reporting access requires separate operator enrollment.</p><StytchProvider stytch={stytch}><Consent /></StytchProvider></main>;
}
