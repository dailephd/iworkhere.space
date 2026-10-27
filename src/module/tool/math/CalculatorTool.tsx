"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import type { ToolComponentProp } from "../type"

type RunState =
    | { ok: true; value: string }
    | { ok: false; error: string }
    | null

export function CalculatorTool({ query, setQuery }: ToolComponentProp) {
    const exprFromQuery = useMemo(() => {
        const v = query?.expr
        return typeof v === "string" ? v : ""
    }, [query])

    const [expr, setExpr] = useState(exprFromQuery)
    const [runState, setRunState] = useState<RunState>(null)

    useEffect(() => {
        setExpr(exprFromQuery)
    }, [exprFromQuery])

    const pushQuery = useCallback(
        (nextExpr: string) => {
            if (!setQuery) return
            setQuery({
                ...(query ?? {}),
                expr: nextExpr,
            })
        },
        [setQuery, query]
    )

    const setExprAll = useCallback(
        (next: string) => {
            setExpr(next)
            pushQuery(next)
        },
        [pushQuery]
    )

    const run = useCallback(() => {
        const cleaned = expr.trim()
        if (!cleaned) {
            setRunState({ ok: false, error: "Enter an expression to calculate." })
            return
        }

        try {
            const out = evalExpr(cleaned)
            if (!Number.isFinite(out)) {
                setRunState({ ok: false, error: "Result is not finite." })
                return
            }
            setRunState({ ok: true, value: formatNumber(out) })
        } catch (e) {
            const msg = e instanceof Error ? e.message : "Invalid expression."
            setRunState({ ok: false, error: msg })
        }
    }, [expr])

    const clear = useCallback(() => {
        setExprAll("")
        setRunState(null)
    }, [setExprAll])

    const back = useCallback(() => {
        if (!expr) return
        const next = expr.slice(0, -1)
        setExprAll(next)
    }, [expr, setExprAll])

    const append = useCallback(
        (s: string) => {
            setExprAll(`${expr}${s}`)
        },
        [expr, setExprAll]
    )

    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent<HTMLInputElement>) => {
            if (e.key === "Enter" || e.key === "=") {
                e.preventDefault()
                run()
            }
        },
        [run]
    )

    const keyItem = useMemo(
        () => [
            { label: "7", onPress: () => append("7") },
            { label: "8", onPress: () => append("8") },
            { label: "9", onPress: () => append("9") },
            { label: "÷", onPress: () => append("/") },

            { label: "4", onPress: () => append("4") },
            { label: "5", onPress: () => append("5") },
            { label: "6", onPress: () => append("6") },
            { label: "×", onPress: () => append("*") },

            { label: "1", onPress: () => append("1") },
            { label: "2", onPress: () => append("2") },
            { label: "3", onPress: () => append("3") },
            { label: "−", onPress: () => append("-") },

            { label: "0", onPress: () => append("0") },
            { label: ".", onPress: () => append(".") },
            { label: "(", onPress: () => append("(") },
            { label: ")", onPress: () => append(")") },

            { label: "C", onPress: clear },
            { label: "⌫", onPress: back },
            { label: "+", onPress: () => append("+") },
            { label: "=", onPress: run },
        ],
        [append, back, clear, run]
    )

    return (
        <div className="space-y-4">
            <div className="space-y-2">
                <label htmlFor="calc-expr" className="text-sm text-[var(--text-muted)]">
                    Expression
                </label>

                <input
                    id="calc-expr"
                    value={expr}
                    onChange={(e) => setExprAll(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Example: (2 + 3) * 4 / 5"
                    inputMode="text"
                    autoComplete="off"
                    spellCheck={false}
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--text)] outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                />

                <div className="grid grid-cols-4 gap-2">
                    {keyItem.map((k) => (
                        <button
                            key={k.label}
                            type="button"
                            onClick={k.onPress}
                            className="rounded-xl border border-[var(--border)] bg-[var(--surface-alt)] px-3 py-2 text-base text-[var(--text)] outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                        >
                            {k.label}
                        </button>
                    ))}
                </div>

                <div className="text-xs text-[var(--text-muted)]">
                    Press Enter or &quot;=&quot; to run. Allowed: numbers, spaces, +, -, *, /, parentheses, decimal point.
                </div>
            </div>

            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
                <div className="text-sm text-[var(--text-muted)]">Result</div>

                {runState == null ? (
                    <div className="mt-2 text-sm text-[var(--text-muted)]">
                        Run the expression to see result.
                    </div>
                ) : runState.ok ? (
                    <output className="mt-2 block text-xl font-semibold text-[var(--text)]">
                        {runState.value}
                    </output>
                ) : (
                    <div role="alert" className="mt-2 text-sm text-[var(--text-muted)]">
                        {runState.error}
                    </div>
                )}
            </div>
        </div>
    )
}

/* ---- Expression evaluation (safe, no eval) ---- */

const MAX_NESTING = 200

type Token =
    | { kind: "num"; value: number }
    | { kind: "op"; value: "+" | "-" | "*" | "/" }
    | { kind: "lp" }
    | { kind: "rp" }

function evalExpr(input: string): number {
    const token = tokenize(input)
    let pos = 0
    let depth = 0

    function peekOp(...allowed: string[]): "+" | "-" | "*" | "/" | null {
        const one = token[pos]
        if (one && one.kind === "op" && allowed.includes(one.value)) return one.value
        return null
    }

    function apply(op: "+" | "-" | "*" | "/", a: number, b: number): number {
        let out: number
        if (op === "+") out = a + b
        else if (op === "-") out = a - b
        else if (op === "*") out = a * b
        else out = a / b
        if (!Number.isFinite(out)) throw new Error("Result is not finite.")
        return out
    }

    function parseExpression(): number {
        let left = parseProduct()
        let op = peekOp("+", "-")
        while (op) {
            pos += 1
            left = apply(op, left, parseProduct())
            op = peekOp("+", "-")
        }
        return left
    }

    function parseProduct(): number {
        let left = parseUnary()
        let op = peekOp("*", "/")
        while (op) {
            pos += 1
            left = apply(op, left, parseUnary())
            op = peekOp("*", "/")
        }
        return left
    }

    function parseUnary(): number {
        const sign = peekOp("+", "-")
        if (!sign) return parsePrimary()
        pos += 1
        depth += 1
        if (depth > MAX_NESTING) throw new Error("Expression is too deeply nested.")
        const operand = parseUnary()
        depth -= 1
        return sign === "-" ? -operand : operand
    }

    function parsePrimary(): number {
        const one = token[pos]
        if (!one) throw new Error("Invalid expression.")
        if (one.kind === "num") {
            pos += 1
            return one.value
        }
        if (one.kind === "lp") {
            pos += 1
            depth += 1
            if (depth > MAX_NESTING) throw new Error("Expression is too deeply nested.")
            const inner = parseExpression()
            depth -= 1
            const close = token[pos]
            if (!close || close.kind !== "rp") throw new Error("Mismatched parentheses.")
            pos += 1
            return inner
        }
        throw new Error("Invalid expression.")
    }

    const value = parseExpression()
    if (pos < token.length) {
        if (token[pos].kind === "rp") throw new Error("Mismatched parentheses.")
        throw new Error("Invalid expression.")
    }
    return value
}

function tokenize(s: string): Token[] {
    const out: Token[] = []
    let i = 0

    function isDigit(ch: string | undefined): boolean {
        return ch !== undefined && ch >= "0" && ch <= "9"
    }

    while (i < s.length) {
        const ch = s[i]

        if (ch === " " || ch === "\t" || ch === "\n" || ch === "\r") {
            i += 1
            continue
        }

        if (ch === "(") {
            out.push({ kind: "lp" })
            i += 1
            continue
        }

        if (ch === ")") {
            out.push({ kind: "rp" })
            i += 1
            continue
        }

        if (ch === "+" || ch === "-" || ch === "*" || ch === "/") {
            out.push({ kind: "op", value: ch })
            i += 1
            continue
        }

        if (isDigit(ch) || ch === ".") {
            let j = i
            while (isDigit(s[j])) j += 1
            if (s[j] === ".") {
                j += 1
                while (isDigit(s[j])) j += 1
            }

            const raw = s.slice(i, j)
            if (raw === ".") throw new Error("Invalid number.")
            const num = Number(raw)
            if (!Number.isFinite(num)) throw new Error("Invalid number.")
            out.push({ kind: "num", value: num })
            i = j
            continue
        }

        throw new Error(`Invalid character: "${ch}"`)
    }

    return out
}

function formatNumber(v: number): string {
    if (Object.is(v, -0)) return "0"
    const s = String(v)
    if (!s.includes(".")) return s
    return v.toFixed(12).replace(/\.?0+$/, "")
}
