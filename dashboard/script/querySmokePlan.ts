import { dashboardQuery } from "../src/lib/query";
import { rangePlan, RANGE } from "../src/lib/range";

// Pure plans for the disposable PostgreSQL smoke. No connection/configuration.
const now = new Date();
process.stdout.write(JSON.stringify(RANGE.map(range => ({ range, query: Object.entries(dashboardQuery(rangePlan(range, now))) }))));
