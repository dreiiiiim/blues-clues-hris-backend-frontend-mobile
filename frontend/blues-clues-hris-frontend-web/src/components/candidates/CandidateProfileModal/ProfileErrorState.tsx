import { Button } from "@/components/ui/button";

export function ProfileErrorState({
  error,
  onRetry,
}: Readonly<{
  error: string;
  onRetry: () => void;
}>) {
  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      <Button type="button" variant="outline" size="sm" onClick={onRetry}>
        Retry
      </Button>
    </div>
  );
}
