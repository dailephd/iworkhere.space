import type { ReportCategory } from "./contract";

export interface CategoryRule {
    id: ReportCategory;
    label: string;
    hint: string;
    expectedLabel: string;
    expectedRequired: boolean;
    observedLabel: string;
}

const generalRule = {
    expectedLabel: "Expected behavior (optional)",
    expectedRequired: false,
    observedLabel: "What happened instead? Example (optional)",
} as const;

export const CATEGORY_RULE: readonly CategoryRule[] = [
    { id: "incorrect_result", label: "Incorrect result", hint: "A calculation, conversion or output is wrong.", expectedLabel: "Expected result", expectedRequired: true, observedLabel: "What you got instead / example (optional)" },
    { id: "tool_failure", label: "Tool failure", hint: "An action fails, hangs or produces no download.", ...generalRule },
    { id: "invalid_output", label: "Invalid output", hint: "A file or result is corrupt, incomplete or wrong.", ...generalRule },
    { id: "interface_accessibility", label: "Interface or accessibility", hint: "Controls overlap, focus or keyboard use breaks, or contrast is poor.", ...generalRule },
    { id: "performance_compatibility", label: "Performance or compatibility", hint: "Something is slow, freezes or fails in a specific browser.", ...generalRule },
    { id: "content_link", label: "Content or link", hint: "Instructions are wrong or a link is broken.", ...generalRule },
    { id: "privacy_security", label: "Privacy or security", hint: "You suspect data exposure or a security weakness. Do not include exploit details.", ...generalRule },
    { id: "suggestion", label: "Suggestion", hint: "Request a new tool, format or improvement.", expectedLabel: "What improvement would help? (optional)", expectedRequired: false, observedLabel: "Suggested use case (optional)" },
    { id: "other", label: "Other", hint: "Anything else.", ...generalRule },
];

export function categoryRule(category: ReportCategory): CategoryRule {
    const rule = CATEGORY_RULE.find(item => item.id === category);
    if (!rule) throw new Error("Unknown report category");
    return rule;
}
