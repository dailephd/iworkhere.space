import { notFound } from "next/navigation";
import { SupportDetailView } from "../../../component/SupportView";
import { loadSupportDetail } from "../../../lib/supportDatabase.server";

export const dynamic = "force-dynamic";

export default async function SupportDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const data = await loadSupportDetail((await params).id);
    if (!data) notFound();
    return <SupportDetailView data={data} now={new Date()} />;
}
