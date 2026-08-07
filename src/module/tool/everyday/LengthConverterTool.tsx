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

export function LengthConverterTool({ toolId }: ToolComponentProp) {
    const [value, setValue] = useState<string>("1")
    const [fromUnit, setFromUnit] = useState<LengthUnit>("m")
    const [toUnit, setToUnit] = useState<LengthUnit>("ft")

    useEffect(() => {
        trackEvent("tool_opened", { toolId, slug: "length-converter" })
    }, [toolId])

    const result = useMemo(() => {
        const num = parseFloat(value)
        if (isNaN(num)) {
            return "Invalid input"
        }

        const meters = num * TO_METERS[fromUnit]
        const converted = meters / TO_METERS[toUnit]

        // Format nicely: up to 6 decimal places, remove trailing zeros
        return Number(converted.toFixed(6)).toString()
    }, [value, fromUnit, toUnit])

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
                <div className="mt-2 text-2xl font-semibold text-[var(--text)]">
                    {result} <span className="text-sm font-normal text-[var(--text-muted)]">{toUnit}</span>
                </div>
            </div>
        </div>
    )
}
