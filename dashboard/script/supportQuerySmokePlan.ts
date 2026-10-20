import { supportDetailQuery, supportHealthQuery, supportJobQuery, supportListQuery } from "../src/lib/supportQuery";

// Pure plans for the disposable PostgreSQL smoke. No connection/configuration.
const id = "SR-0123456789ABCDEF";
process.stdout.write(JSON.stringify(Object.entries({
    list: supportListQuery(1), listPage: supportListQuery(3), health: supportHealthQuery(), detail: supportDetailQuery(id), job: supportJobQuery(id),
})));
