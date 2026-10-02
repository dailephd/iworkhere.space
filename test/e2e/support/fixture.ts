import { test as base, expect } from "@playwright/test";
import { getConsoleFailure } from "./browserDiagnostic";

export const test = base.extend({
    page: async ({ page }, providePage, testInfo) => {
        const failures: string[] = [];
        const advertisingRequests: string[] = [];
        await page.context().route(/https?:\/\/([^/]*\.)?(googlesyndication\.com|doubleclick\.net|googleadservices\.com)\//, route => {
            advertisingRequests.push(new URL(route.request().url()).hostname);
            return route.abort();
        });
        page.on("pageerror", error => failures.push(`pageerror: ${error.message}`));
        page.on("console", message => {
            const failure = getConsoleFailure({ type: message.type(), text: message.text() });
            if (failure) failures.push(failure);
        });
        await providePage(page);
        if (failures.length) {
            await testInfo.attach("browser-diagnostics", {
                body: JSON.stringify(failures, null, 2),
                contentType: "application/json",
            });
        }
        expect(failures, "No page errors, console errors or hydration diagnostics").toEqual([]);
        expect(advertisingRequests, "Ads disabled: no live Google advertising requests").toEqual([]);
    },
});

export { expect };
