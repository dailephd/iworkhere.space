"use client";

import { useState } from "react";
import { createStytchUIClient, IdentityProvider, Products, StytchLogin, StytchProvider, useStytchSession } from "@stytch/nextjs";

function Consent() {
    const { session, isInitialized, fromCache } = useStytchSession();
    if (!isInitialized || fromCache) return <p>Checking sign-in…</p>;
    return session ? <IdentityProvider /> : <StytchLogin config={{ products: [Products.otp], otpOptions: { methods: ["email"], expirationMinutes: 10 } }} />;
}

export interface AuthorizationProp { publicToken: string; environment?: "test" | "live" }

export function Authorization({ publicToken, environment = "test" }: AuthorizationProp) {
    const [stytch] = useState(() => createStytchUIClient(publicToken));
    return <main><h1>Authorize observability reporting</h1><p>Stytch {environment === "live" ? "Live" : "Test"} sign-in and consent. Reporting access requires separate operator enrollment.</p><StytchProvider stytch={stytch}><Consent /></StytchProvider></main>;
}
