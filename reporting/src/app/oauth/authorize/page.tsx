import { Authorization } from "../../../lib/authorization.client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Authorize observability reporting", robots: { index: false, follow: false } };

export default function Page() {
    const token = process.env.NEXT_PUBLIC_STYTCH_PUBLIC_TOKEN;
    if (!token?.startsWith("public-token-test-")) return <main><h1>Authorization unavailable</h1><p>Test sign-in has not been configured.</p></main>;
    return <Authorization publicToken={token} />;
}
