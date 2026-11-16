import { reportingQuery } from "../src/lib/reportingQuery";
import { dashboardQuery } from "../src/lib/query";
import { rangePlan, RANGE } from "../src/lib/range";

// Pure plans for disposable PostgreSQL smoke; no connection/configuration.
const now = new Date();
const plan = RANGE.map(range => {
    const selection = rangePlan(range, now);
    const reporting = Object.entries(reportingQuery(selection)).map(([name, query]) => [`reporting_${name}`, query]);
    return { range, query: [...Object.entries(dashboardQuery(selection)), ...reporting] };
});
process.stdout.write(JSON.stringify(plan));
