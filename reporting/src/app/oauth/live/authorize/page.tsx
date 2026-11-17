import { Authorization } from "../../../../component/Authorization";
import { STYTCH_LIVE_ISSUER } from "../../../../lib/stytchLive";

export const dynamic = "force-dynamic";
export const metadata = { title: "Authorize live observability reporting", robots: { index: false, follow: false } };

export default function Page() {
    const token = process.env.NEXT_PUBLIC_STYTCH_LIVE_PUBLIC_TOKEN;
    if (!token?.startsWith("public-token-live-")) return <main><h1>Authorization unavailable</h1><p>Live sign-in has not been configured.</p></main>;
    return <Authorization key="stytch-live" publicToken={token} environment="live" customBaseUrl={STYTCH_LIVE_ISSUER} />;
}
