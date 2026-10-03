import { DashboardView } from "../component/DashboardView";
import { loadDashboard } from "../lib/database.server";
import { dashboardModel } from "../lib/model";
import { parseRange, rangePlan } from "../lib/range";

export const dynamic = "force-dynamic";
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
    const plan = rangePlan(parseRange((await searchParams).range), new Date());
    const model = dashboardModel(await loadDashboard(plan), plan);
    return <DashboardView model={model} plan={plan} />;
}
