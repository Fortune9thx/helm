import { PolicyDetailClient } from "./PolicyDetailClient";

export default async function PolicyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PolicyDetailClient policyId={decodeURIComponent(id)} />;
}
