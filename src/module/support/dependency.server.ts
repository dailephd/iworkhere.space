import "server-only";
import { submitReport } from "./persistence.server";
import { contextSource } from "./projection";
import type { SubmissionDependency } from "./submission.server";
import { verifyChallenge } from "./turnstile.server";

export function defaultSubmissionDependency(): SubmissionDependency {
    return {
        source: contextSource(),
        challenge: token => verifyChallenge(token),
        submit: (report, idempotencyKey) => submitReport(report, idempotencyKey),
    };
}
