# Converter catalog expansion proposal

Research recorded 2026-10-11. Planning only: no new tools, dependencies or runtime
conversion framework are implemented. Proposed v0.7.0 for wave 1 and v0.8.0 for
wave 2, both pending planner approval. Frozen v0.5.0 and v0.6.0 remain unchanged.
The category migration was implemented and released in v0.4.1; only the new
converter waves below remain proposals without approved release assignments.

## Accuracy and feasibility

All ten proposed tools can run locally and offline using small explicit unit
tables and pure conversion functions. Use a canonical base unit per quantity,
with exact defining ratios where available. Keep calculation precision until
display formatting; do not repeatedly convert a rounded displayed result.
JavaScript floating-point results are approximations: test ordinary linear and
affine operations at relative tolerance 1e-12 with an appropriate absolute
tolerance near zero, not exact equality of arbitrary decimal results. Reject
empty, malformed and non-finite input and overflow; distinguish zero from no
input. Never claim measurement accuracy or invent significant figures.

SI units and prefixes follow the [BIPM SI Brochure](https://www.bipm.org/en/si-brochure-9).
Defining ratios and named customary variants should be checked against the
[NIST conversion tables](https://www.nist.gov/pml/special-publication-811/nist-guide-si-appendix-b-conversion-factors/nist-guide-si-appendix-b9)
when each tool is planned. Decimal and binary storage prefixes must stay
distinct, following [NIST binary prefixes](https://physics.nist.gov/cuu/Units/binary.html).
Below is a proposed product selection, not a claim that every possible unit is
supported or that all similarly named historical units are interchangeable.

## First expansion — proposed v0.7.0

| Tool | Expected units | Mathematical requirements | Expected user value and specific tests |
|---|---|---|---|
| Temperature | Celsius, Fahrenheit, kelvin | Affine offsets, not a scale-factor table: K = °C + 273.15; °F = 9°C/5 + 32. Absolute temperatures cannot fall below 0 K. Temperature differences need a separately labelled mode or exclusion. | Travel, weather and cooking. Test freezing/boiling reference points, −40 °C = −40 °F, absolute zero, negative Celsius, round trips and boundary rejection with documented floating tolerance. |
| Volume | mL, L, m³, cm³; US liquid fl oz/pint/quart/gallon; Imperial fl oz/pint/quart/gallon | Base m³; 1 L = 0.001 m³. Explicitly label US liquid versus Imperial, never a generic gallon. Defer dry measures and regional cups. Nonnegative volume. | Recipes, containers and purchases. Test 1 L = 1000 mL, US/Imperial distinction, zero, large/small quantities and inverse conversions. |
| Area | mm², cm², m², km², hectare, in², ft², yd², acre, mi² | Square length factors; base m². Use international foot, not obsolete US survey foot. Nonnegative area. | Rooms, land and materials. Test squared-factor regressions, hectares, acreage, zero and scale extremes. |
| Speed | m/s, km/h, mph, ft/s, knot | Base m/s, compound length/time ratios; knot is nautical miles/hour. No Mach without environmental assumptions. Nonnegative magnitude. | Travel, fitness and weather. Test 1 m/s = 3.6 km/h, exact mile and nautical-mile definitions, zero and round trips. |
| Data Storage | bit, byte; kB/MB/GB/TB/PB and KiB/MiB/GiB/TiB/PiB | 8 bits/byte; powers of 1000 versus 1024. Keep symbols case-sensitive. Define supported magnitude/precision limits; use exact integer arithmetic where required or disclose approximation beyond safe integer range. Fractional amounts need explicit semantics. | Storage purchases and download sizes. Test 1 KiB = 1024 B versus 1 kB = 1000 B, bit/byte factor, decimal/binary inverses, safe-integer boundary and large values. |

## Second expansion — proposed v0.8.0

| Tool | Expected units | Mathematical requirements | Expected user value and specific tests |
|---|---|---|---|
| Pressure | Pa, kPa, MPa, bar, mbar, atmosphere, psi, torr | Base Pa; distinguish torr from conventional mmHg. Do not silently translate gauge to absolute pressure. Negative gauge inputs only if the product explicitly defines that mode; ordinary absolute pressure nonnegative. | Tires and technical specifications. Test bar/Pa and standard atmosphere anchors, psi round trips, large/small values and mode limitations. |
| Energy | J, kJ, MJ, Wh, kWh, thermochemical cal/kcal, explicitly labelled BTU (IT) | Base J; 1 Wh = 3600 J. Never an unspecified calorie or BTU. Signed scalar energy is acceptable if explained. | Electricity and food-energy comparisons. Test kWh/J, named calorie variants, zero/negative inputs and unit inverses. |
| Power | W, kW, MW, mechanical horsepower, metric horsepower | Base W; keep horsepower variants distinct. Do not confuse energy with power or infer consumption duration. Signed power can represent direction. | Appliances and motor ratings. Test prefix scaling, separate horsepower factors, negative/zero values and round trips. |
| Angle | degree, radian, gradian/gon, turn, arcminute, arcsecond | π-based factors are approximate in floating point. Preserve signed and multi-turn values; do not normalize modulo 360 unless an explicit optional mode is designed. | Geometry and engineering. Test 180° = π rad, full turns, arc subdivision, negative values and multiples beyond one turn. |
| Fuel Economy | US mpg, Imperial mpg, km/L, L/100 km | Reciprocal conversion for consumption versus efficiency; exact mile/gallon definitions. Strictly positive input; zero must produce an explained undefined result, not Infinity. Label US/Imperial prominently. | Vehicle comparisons. Test regional mpg distinction, reciprocal direction, inverse round trips, near-zero/overflow and zero/negative rejection. |

## Potential shared interface

Start by inspecting the existing Length and Weight owners. A possible common
presentation is a labelled numeric value, From/To selects, Swap, Reset, Copy,
formatted result, source-of-factors note and local role="alert" feedback. Preserve
existing ToolComponentProp, registry registration, storage/telemetry abstractions
and client/server split. Use named interfaces and explicit imports. A small
presentation-only component is justified only after two real tools demonstrate
identical UI; affine, reciprocal and linear functions remain quantity-specific.
No universal conversion engine, reflection or auto-discovery is proposed.

Each future tool needs independent factor-reference vectors, identity and
inverse tests, formatting/rounding boundaries, invalid/non-finite/overflow
paths, supported-domain tests, SSR-safe unit tests, keyboard/label/alert tests,
mobile layouts and browser regressions for Swap/Reset/Copy. Compare reference
values independently rather than computing expected values with production
helpers. Include registry, category, SEO and sitemap checks at integration.

Factor provenance must distinguish exact definitions from rounded table entries.
Do not treat a seven-digit reference coefficient as exact or promise 1e-12
agreement with a rounded source value. Derive exact customary factors from
their defining ratios where possible; document precision for approximate
factors. Label the proposed acre as international acre and defer US survey
acre alongside survey-foot variants. The floating-point tolerance above tests
arithmetic consistency, not the precision of a source measurement or factor.

## Currency deferred

No currency tool or version is assigned. Planner must first approve provider
licensing and provenance, supported currencies, rate timestamp/time zone,
freshness threshold, caching duration and privacy, offline/stale behavior,
provider failure/retry rules, base/cross-rate consistency, rounding, and visible
disclosures for indicative rates, spreads/fees and last update. A stale cached
rate must never be presented as current. This needs a separate network/data
contract before any implementation scope is approved.
