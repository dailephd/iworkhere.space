import { describe, expect, test } from "vitest"
import { addTime, calculateTime, parseTime, subtractTime } from "./timeArithmetic"

describe("parseTime", () => {
    test("parses valid HH:MM", () => {
        expect(parseTime("01:30")).toEqual({ hours: 1, minutes: 30 })
    })

    test("parses single-digit hour", () => {
        expect(parseTime("9:05")).toEqual({ hours: 9, minutes: 5 })
    })

    test("parses large hour values", () => {
        expect(parseTime("99:59")).toEqual({ hours: 99, minutes: 59 })
    })

    test("parses 00:00", () => {
        expect(parseTime("00:00")).toEqual({ hours: 0, minutes: 0 })
    })

    test("returns null for empty string", () => {
        expect(parseTime("")).toBeNull()
    })

    test("returns null for missing colon", () => {
        expect(parseTime("1234")).toBeNull()
    })

    test("returns null for minutes > 59", () => {
        expect(parseTime("01:60")).toBeNull()
    })

    test("returns null for non-numeric input", () => {
        expect(parseTime("ab:cd")).toBeNull()
    })

    test("returns null for single-digit minutes", () => {
        expect(parseTime("01:5")).toBeNull()
    })

    test("returns null for missing hours", () => {
        expect(parseTime(":15")).toBeNull()
    })

    test("returns null for negative values", () => {
        expect(parseTime("-01:15")).toBeNull()
    })

    test("trims whitespace", () => {
        expect(parseTime("  02:30  ")).toEqual({ hours: 2, minutes: 30 })
    })
})

describe("addTime", () => {
    test("adds two times without carry", () => {
        expect(addTime("01:20", "00:30")).toEqual({
            ok: true,
            value: "01:50",
        })
    })

    test("adds two times with minute carry", () => {
        expect(addTime("01:50", "00:20")).toEqual({
            ok: true,
            value: "02:10",
        })
    })

    test("adds zero", () => {
        expect(addTime("05:30", "00:00")).toEqual({
            ok: true,
            value: "05:30",
        })
    })

    test("adds large hour values", () => {
        expect(addTime("50:00", "50:00")).toEqual({
            ok: true,
            value: "100:00",
        })
    })

    test("carries across very large hour values", () => {
        expect(addTime("999:59", "00:01")).toEqual({
            ok: true,
            value: "1000:00",
        })
    })

    test("returns error for invalid first input", () => {
        expect(addTime("bad", "01:00")).toEqual({
            ok: false,
            error: "invalid-left",
        })
    })

    test("returns error for invalid second input", () => {
        expect(addTime("01:00", "bad")).toEqual({
            ok: false,
            error: "invalid-right",
        })
    })
})

describe("subtractTime", () => {
    test("subtracts without borrow", () => {
        expect(subtractTime("02:30", "01:10")).toEqual({
            ok: true,
            value: "01:20",
        })
    })

    test("subtracts with borrow", () => {
        expect(subtractTime("02:00", "00:45")).toEqual({
            ok: true,
            value: "01:15",
        })
    })

    test("subtracts to zero", () => {
        expect(subtractTime("01:30", "01:30")).toEqual({
            ok: true,
            value: "00:00",
        })
    })

    test("subtracts zero", () => {
        expect(subtractTime("03:45", "00:00")).toEqual({
            ok: true,
            value: "03:45",
        })
    })

    test("borrows across large hour values", () => {
        expect(subtractTime("100:00", "00:01")).toEqual({
            ok: true,
            value: "99:59",
        })
    })

    test("returns message for negative result", () => {
        expect(subtractTime("00:30", "01:00")).toEqual({
            ok: false,
            error: "negative-result",
        })
    })

    test("returns error for invalid left input", () => {
        expect(subtractTime("bad", "01:00")).toEqual({
            ok: false,
            error: "invalid-left",
        })
    })

    test("returns error for invalid right input", () => {
        expect(subtractTime("01:00", "bad")).toEqual({
            ok: false,
            error: "invalid-right",
        })
    })
})

describe("calculateTime", () => {
    test("routes add operations through normalized arithmetic", () => {
        expect(calculateTime("10:55", "add", "00:10")).toEqual({
            ok: true,
            value: "11:05",
        })
    })

    test("routes subtract operations through normalized arithmetic", () => {
        expect(calculateTime("12:00", "subtract", "01:30")).toEqual({
            ok: true,
            value: "10:30",
        })
    })

    test("reports invalid left operand distinctly", () => {
        expect(calculateTime("oops", "add", "00:10")).toEqual({
            ok: false,
            error: "invalid-left",
        })
    })

    test("reports invalid right operand distinctly", () => {
        expect(calculateTime("00:10", "subtract", "oops")).toEqual({
            ok: false,
            error: "invalid-right",
        })
    })
})
