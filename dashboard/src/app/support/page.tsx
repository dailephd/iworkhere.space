import { SupportListView } from "../../component/SupportView";
import { loadSupportList } from "../../lib/supportDatabase.server";

export const dynamic = "force-dynamic";

function pageNumber(value: string | string[] | undefined): number {
    const parsed = Number(Array.isArray(value) ? value[0] : value);
    return Number.isSafeInteger(parsed) && parsed >= 1 && parsed <= 10_000 ? parsed : 1;
}

export default async function SupportPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
    const page = pageNumber((await searchParams).page);
    return <SupportListView data={await loadSupportList(page)} page={page} now={new Date()} />;
}
