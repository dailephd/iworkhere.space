"use client"

import { useMemo, useState, useEffect } from "react"
import type { ToolComponentProp } from "../type"
import { trackEvent } from "@/module/observability"

type WeightUnit = "g" | "kg" | "lb" | "oz"

const UNIT_LABELS: Record<WeightUnit, string> = {
    g: "Grams (g)",
    kg: "Kilograms (kg)",
    lb: "Pounds (lb)",
    oz: "Ounces (oz)",
}

const TO_GRAMS: Record<WeightUnit, number> = {
    g: 1,
    kg: 1000,
    lb: 453.59237,
    oz: 28.349523125,
}

export function WeightConverterTool({ toolId }: ToolComponentProp) {
    const [value, setValue] = useState<string>("1")
    const [fromUnit, setFromUnit] = useState<WeightUnit>("kg")
    const [toUnit, setToUnit] = useState<WeightUnit>("lb")

    useEffect(() => {
        trackEvent("tool_opened", { toolId, slug: "weight-converter" })
    }, [toolId])

    const result = useMemo(() => {
        const num = parseFloat(value)
        if (isNaN(num)) {
            return "Invalid input"
        }

        const grams = num * TO_GRAMS[fromUnit]
        const converted = grams / TO_GRAMS[toUnit]

        // Format nicely: up to 6 decimal places, remove trailing zeros
        return Number(converted.toFixed(6)).toString()
    }, [value, fromUnit, toUnit])

    useEffect(() => {
        trackEvent("tool_executed", { toolId, slug: "weight-converter" })
    }, [value, fromUnit, toUnit, toolId])

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                    <label htmlFor="weight-value" className="text-sm text-[var(--text-muted)]">
                        Value
                    </label>
                    <input
                        id="weight-value"
                        type="number"
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                        className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--text)] outline-none focus-visible:outline focus-visible:outline-2"
                    />
                </div>

                <div className="space-y-2">
                    <label htmlFor="weight-from" className="text-sm text-[var(--text-muted)]">
                        From
                    </label>
                    <select
                        id="weight-from"
                        value={fromUnit}
                        onChange={(e) => setFromUnit(e.target.value as WeightUnit)}
                        className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--text)] outline-none focus-visible:outline focus-visible:outline-2"
                    >
                        {(Object.keys(UNIT_LABELS) as WeightUnit[]).map((u) => (
                            <option key={u} value={u}>
                                {UNIT_LABELS[u]}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="space-y-2">
                    <label htmlFor="weight-to" className="text-sm text-[var(--text-muted)]">
                        To
                    </label>
                    <select
                        id="weight-to"
                        value={toUnit}
                        onChange={(e) => setToUnit(e.target.value as WeightUnit)}
                        className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--text)] outline-none focus-visible:outline focus-visible:outline-2"
                    >
                        {(Object.keys(UNIT_LABELS) as WeightUnit[]).map((u) => (
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
