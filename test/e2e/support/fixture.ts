import { test as base, expect } from "@playwright/test";
import { getConsoleFailure } from "./browserDiagnostic";

export const test = base.extend({
    page: async ({ page }, providePage, testInfo) => {
        const failures: string[] = [];
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
    },
});

export { expect };
