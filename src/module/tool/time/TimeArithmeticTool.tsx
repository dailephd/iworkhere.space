"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import type { ToolComponentProp } from "../type"
import { trackEvent } from "@/module/observability"
import { calculateTime } from "./timeArithmetic"

type Operation = "add" | "subtract"

const INPUT_CLASSNAME =
    "w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--text)] outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"

export function TimeArithmeticTool({ toolId }: ToolComponentProp) {
    const [timeA, setTimeA] = useState("")
    const [timeB, setTimeB] = useState("")
    const [operation, setOperation] = useState<Operation>("add")
    const hasFiredOpened = useRef(false)
    const previousTrackedResultRef = useRef("")

    useEffect(() => {
        if (hasFiredOpened.current) {
            return
        }

        trackEvent("tool_opened", { toolId, slug: "time-arithmetic" })
        hasFiredOpened.current = true
    }, [toolId])

    const hasInteracted = timeA !== "" || timeB !== ""

    const { result, leftError, rightError, generalError } = useMemo(() => {
        if (!hasInteracted) {
            return {
                result: "",
                leftError: "",
                rightError: "",
                generalError: "",
            }
        }

        const arithmeticResult = calculateTime(timeA, operation, timeB)

        if (arithmeticResult.ok) {
            return {
                result: arithmeticResult.value,
                leftError: "",
                rightError: "",
                generalError: "",
            }
        }

        if (arithmeticResult.error === "invalid-left") {
            return {
                result: "",
                leftError: "Use HH:MM with two-digit minutes, such as 01:50.",
                rightError: "",
                generalError: "",
            }
        }

        if (arithmeticResult.error === "invalid-right") {
            return {
                result: "",
                leftError: "",
                rightError: "Use HH:MM with two-digit minutes, such as 00:20.",
                generalError: "",
            }
        }

        return {
            result: "",
            leftError: "",
            rightError: "",
            generalError: "Subtraction cannot produce a negative time value.",
        }
    }, [hasInteracted, operation, timeA, timeB])

    useEffect(() => {
        if (!result || previousTrackedResultRef.current === result) {
            return
        }

        trackEvent("tool_executed", { toolId, slug: "time-arithmetic" })
        previousTrackedResultRef.current = result
    }, [result, toolId])

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                    <label htmlFor="time-a" className="text-sm text-[var(--text-muted)]">
                        Time A
                    </label>
                    <input
                        id="time-a"
                        type="text"
                        value={timeA}
                        onChange={(event) => setTimeA(event.target.value)}
                        placeholder="HH:MM"
                        inputMode="numeric"
                        autoComplete="off"
                        spellCheck={false}
                        aria-describedby={leftError ? "time-a-error" : undefined}
                        aria-invalid={Boolean(leftError)}
                        className={INPUT_CLASSNAME}
                    />
                    {leftError ? (
                        <p id="time-a-error" className="text-sm text-[var(--text-muted)]">
                            {leftError}
                        </p>
                    ) : null}
                </div>

                <div className="space-y-2">
                    <label htmlFor="time-op" className="text-sm text-[var(--text-muted)]">
                        Operation
                    </label>
                    <select
                        id="time-op"
                        value={operation}
                        onChange={(event) => setOperation(event.target.value as Operation)}
                        className={INPUT_CLASSNAME}
                    >
                        <option value="add">+ Add</option>
                        <option value="subtract">- Subtract</option>
                    </select>
                </div>

                <div className="space-y-2">
                    <label htmlFor="time-b" className="text-sm text-[var(--text-muted)]">
                        Time B
                    </label>
                    <input
                        id="time-b"
                        type="text"
                        value={timeB}
                        onChange={(event) => setTimeB(event.target.value)}
                        placeholder="HH:MM"
                        inputMode="numeric"
                        autoComplete="off"
                        spellCheck={false}
                        aria-describedby={rightError ? "time-b-error" : undefined}
                        aria-invalid={Boolean(rightError)}
                        className={INPUT_CLASSNAME}
                    />
                    {rightError ? (
                        <p id="time-b-error" className="text-sm text-[var(--text-muted)]">
                            {rightError}
                        </p>
                    ) : null}
                </div>
            </div>

            <p className="text-xs text-[var(--text-muted)]">
                Enter hours and two-digit minutes, such as 01:50, 00:20, or 120:05.
            </p>

            {generalError ? (
                <div
                    role="alert"
                    className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 text-sm text-[var(--text)]"
                >
                    {generalError}
                </div>
            ) : null}

            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
                <div className="text-sm text-[var(--text-muted)]">Result</div>
                <div className="mt-2 text-2xl font-semibold text-[var(--text)]">
                    {result || "--:--"}
                </div>
            </div>
        </div>
    )
}
