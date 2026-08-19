import { EvaluateClient } from "./EvaluateClient";

export default async function EvaluatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <EvaluateClient policyId={decodeURIComponent(id)} />;
}
