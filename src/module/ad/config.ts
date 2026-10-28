export const ADSENSE_CLIENT = "ca-pub-7976885058339852";
export const ADSENSE_SLOT = { header: "4100977160", right: "2496999884" } as const;
export const ADSENSE_SCRIPT = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`;
export const ADS_TXT = "google.com, pub-7976885058339852, DIRECT, f08c47fec0942fa0\n";
export type AdPlacement = keyof typeof ADSENSE_SLOT;
/**
 * A supplied deployment environment other than "production" (preview,
 * development, custom or empty) denies serving. An absent value keeps the
 * standalone behavior. Only the server eligibility boundary supplies it.
 */
export function adsenseEnabled(flag = process.env.NEXT_PUBLIC_ADSENSE_ENABLED, mode = process.env.NODE_ENV, deploymentEnvironment?: string): boolean {
    if (deploymentEnvironment !== undefined && deploymentEnvironment !== "production") return false;
    return flag === "true" && mode === "production";
}
