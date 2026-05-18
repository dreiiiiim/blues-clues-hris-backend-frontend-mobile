import { Loader2 } from "lucide-react";

export function ProfileLoadingState() {
  return (
    <div className="flex min-h-48 items-center justify-center text-sm text-muted-foreground">
      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      Loading applicant profile...
    </div>
  );
}
