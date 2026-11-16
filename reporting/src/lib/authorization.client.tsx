"use client";

import { useState } from "react";
import { createStytchUIClient, IdentityProvider, Products, StytchLogin, StytchProvider, useStytchSession } from "@stytch/nextjs";

function Consent() {
    const { session, isInitialized, fromCache } = useStytchSession();
    if (!isInitialized || fromCache) return <p>Checking sign-in…</p>;
    return session ? <IdentityProvider /> : <StytchLogin config={{ products: [Products.otp], otpOptions: { methods: ["email"], expirationMinutes: 10 } }} />;
}

export function Authorization({ publicToken }: { publicToken: string }) {
    const [stytch] = useState(() => createStytchUIClient(publicToken));
    return <main><h1>Authorize observability reporting</h1><p>Stytch Test sign-in and consent. Reporting access requires separate operator enrollment.</p><StytchProvider stytch={stytch}><Consent /></StytchProvider></main>;
}

