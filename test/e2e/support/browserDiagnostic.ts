export interface ConsoleDiagnostic {
    type: string;
    text: string;
}

export function getConsoleFailure(message: ConsoleDiagnostic): string | null {
    if (message.type === "error") return `console error: ${message.text}`;
    if (/hydrat|did not match|server rendered html/i.test(message.text)) {
        return `hydration diagnostic: ${message.text}`;
    }
    return null;
}
