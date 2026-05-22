import { CheckCircle, Clock, XCircle } from "lucide-react";
import type { ElementType } from "react";

const STATUS_CONFIG: Record<string, { className: string; Icon: ElementType | null }> = {
  open: {
    className: "bg-green-100 text-green-700 border-green-200",
    Icon: CheckCircle,
  },
  closed: {
    className: "bg-red-100 text-red-700 border-red-200",
    Icon: XCircle,
  },
  draft: {
    className: "bg-amber-100 text-amber-700 border-amber-200",
    Icon: Clock,
  },
};

export function JobStatusBadge({ status }: Readonly<{ status: string }>) {
  const config = STATUS_CONFIG[status] ?? {
    className: "bg-gray-100 text-gray-700 border-gray-200",
    Icon: null,
  };
  const Icon = config.Icon;

  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase ${config.className}`}>
      {Icon && <Icon className="h-3 w-3" />}
      {status}
    </span>
  );
}
