"use client"

import { useMemo, useState, useEffect } from "react"
import type { ToolComponentProp } from "../type"
import { trackEvent } from "@/module/observability"

type LengthUnit = "m" | "km" | "cm" | "mm" | "inch" | "ft" | "yd" | "mile"

const UNIT_LABELS: Record<LengthUnit, string> = {
    m: "Meters (m)",
    km: "Kilometers (km)",
    cm: "Centimeters (cm)",
    mm: "Millimeters (mm)",
    inch: "Inches (in)",
    ft: "Feet (ft)",
    yd: "Yards (yd)",
    mile: "Miles (mi)",
}

const TO_METERS: Record<LengthUnit, number> = {
    m: 1,
    km: 1000,
    cm: 0.01,
    mm: 0.001,
    inch: 0.0254,
    ft: 0.3048,
    yd: 0.9144,
    mile: 1609.344,
}

const NUMERIC_PATTERN = /^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i

type ConversionResult =
    | { ok: true; text: string }
    | { ok: false; error: string }

function convert(value: string, from: LengthUnit, to: LengthUnit): ConversionResult {
    const trimmed = value.trim()
    if (!trimmed) return { ok: false, error: "Invalid input: enter a number." }
    if (!NUMERIC_PATTERN.test(trimmed)) return { ok: false, error: "Invalid input: enter a valid number." }

    const num = Number(trimmed)
    if (!Number.isFinite(num)) return { ok: false, error: "Invalid input: the number is too large." }

    // One combined factor keeps same-unit conversions exact and avoids an intermediate overflow.
    const converted = num * (TO_METERS[from] / TO_METERS[to])
    if (!Number.isFinite(converted)) return { ok: false, error: "Result is out of range for this conversion." }

    // Format nicely: up to 6 decimal places, remove trailing zeros
    const rounded = Number(converted.toFixed(6))
    if (!Number.isFinite(rounded)) return { ok: false, error: "Result is out of range for this conversion." }
    return { ok: true, text: rounded.toString() }
}

export function LengthConverterTool({ toolId }: ToolComponentProp) {
    const [value, setValue] = useState<string>("1")
    const [fromUnit, setFromUnit] = useState<LengthUnit>("m")
    const [toUnit, setToUnit] = useState<LengthUnit>("ft")

    useEffect(() => {
        trackEvent("tool_opened", { toolId, slug: "length-converter" })
    }, [toolId])

    const result = useMemo(() => convert(value, fromUnit, toUnit), [value, fromUnit, toUnit])

    useEffect(() => {
        trackEvent("tool_executed", { toolId, slug: "length-converter" })
    }, [value, fromUnit, toUnit, toolId])

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                    <label htmlFor="length-value" className="text-sm text-[var(--text-muted)]">
                        Value
                    </label>
                    <input
                        id="length-value"
                        type="number"
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                        className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--text)] outline-none focus-visible:outline focus-visible:outline-2"
                    />
                </div>

                <div className="space-y-2">
                    <label htmlFor="length-from" className="text-sm text-[var(--text-muted)]">
                        From
                    </label>
                    <select
                        id="length-from"
                        value={fromUnit}
                        onChange={(e) => setFromUnit(e.target.value as LengthUnit)}
                        className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--text)] outline-none focus-visible:outline focus-visible:outline-2"
                    >
                        {(Object.keys(UNIT_LABELS) as LengthUnit[]).map((u) => (
                            <option key={u} value={u}>
                                {UNIT_LABELS[u]}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="space-y-2">
                    <label htmlFor="length-to" className="text-sm text-[var(--text-muted)]">
                        To
                    </label>
                    <select
                        id="length-to"
                        value={toUnit}
                        onChange={(e) => setToUnit(e.target.value as LengthUnit)}
                        className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--text)] outline-none focus-visible:outline focus-visible:outline-2"
                    >
                        {(Object.keys(UNIT_LABELS) as LengthUnit[]).map((u) => (
                            <option key={u} value={u}>
                                {UNIT_LABELS[u]}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
                <div className="text-sm text-[var(--text-muted)]">Result</div>
                {result.ok ? (
                    <div className="mt-2 text-2xl font-semibold text-[var(--text)]">
                        {result.text} <span className="text-sm font-normal text-[var(--text-muted)]">{toUnit}</span>
                    </div>
                ) : (
                    <div role="alert" className="mt-2 text-sm text-[var(--text)]">
                        {result.error}
                    </div>
                )}
            </div>
        </div>
    )
}
