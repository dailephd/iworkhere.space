export interface TimeParts {
    hours: number
    minutes: number
}

export type TimeArithmeticOperation = "add" | "subtract"

export type TimeArithmeticError =
    | "invalid-left"
    | "invalid-right"
    | "negative-result"

export type TimeArithmeticResult =
    | { ok: true; value: string }
    | { ok: false; error: TimeArithmeticError }

const TIME_PATTERN = /^(\d+):(\d{2})$/

export function parseTime(input: string): TimeParts | null {
    const trimmed = input.trim()
    const match = TIME_PATTERN.exec(trimmed)
    if (!match) return null

    const [, hoursText, minutesText] = match
    const hours = Number.parseInt(hoursText, 10)
    const minutes = Number.parseInt(minutesText, 10)

    if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return null
    if (hours < 0 || minutes < 0 || minutes > 59) return null

    return { hours, minutes }
}

function toTotalMinutes(time: TimeParts): number {
    return time.hours * 60 + time.minutes
}

function formatTime(totalMinutes: number): string {
    const hours = Math.floor(totalMinutes / 60)
    const minutes = totalMinutes % 60

    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`
}

function parseOperands(
    left: string,
    right: string,
):
    | { ok: true; leftTime: TimeParts; rightTime: TimeParts }
    | { ok: false; error: Extract<TimeArithmeticError, "invalid-left" | "invalid-right"> } {
    const leftTime = parseTime(left)
    if (!leftTime) {
        return { ok: false, error: "invalid-left" }
    }

    const rightTime = parseTime(right)
    if (!rightTime) {
        return { ok: false, error: "invalid-right" }
    }

    return { ok: true, leftTime, rightTime }
}

export function calculateTime(
    left: string,
    operation: TimeArithmeticOperation,
    right: string,
): TimeArithmeticResult {
    const parsed = parseOperands(left, right)
    if (!parsed.ok) {
        return parsed
    }

    const leftMinutes = toTotalMinutes(parsed.leftTime)
    const rightMinutes = toTotalMinutes(parsed.rightTime)
    const totalMinutes =
        operation === "add"
            ? leftMinutes + rightMinutes
            : leftMinutes - rightMinutes

    if (totalMinutes < 0) {
        return { ok: false, error: "negative-result" }
    }

    return { ok: true, value: formatTime(totalMinutes) }
}

export function addTime(left: string, right: string): TimeArithmeticResult {
    return calculateTime(left, "add", right)
}

export function subtractTime(left: string, right: string): TimeArithmeticResult {
    return calculateTime(left, "subtract", right)
}
