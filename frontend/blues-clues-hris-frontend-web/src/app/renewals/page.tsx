import { Suspense } from "react";
import { RenewalsClient } from "./_components/RenewalsClient";

export default function RenewalsPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading renewals...</div>}>
      <RenewalsClient />
    </Suspense>
  );
}
