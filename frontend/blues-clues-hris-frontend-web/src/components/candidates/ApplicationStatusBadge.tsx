function normalizeStatus(status: string): string {
  return status
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

const STATUS_CONFIG: Record<string, string> = {
  submitted: "bg-gray-100 text-gray-600 border-gray-200",
  screening: "bg-amber-100 text-amber-700 border-amber-200",
  technical: "bg-blue-100 text-blue-700 border-blue-200",
  "final interview": "bg-purple-100 text-purple-700 border-purple-200",
  hired: "bg-green-100 text-green-700 border-green-200",
  rejected: "bg-red-100 text-red-700 border-red-200",
};

export function getApplicationStatusStyle(status: string): string {
  const normalized = normalizeStatus(status).toLowerCase();
  return STATUS_CONFIG[normalized] ?? "bg-gray-100 text-gray-600 border-gray-200";
}

export function getNormalizedStatusLabel(status: string): string {
  return normalizeStatus(status);
}

export function ApplicationStatusBadge({
  status,
  className = "",
}: Readonly<{
  status: string;
  className?: string;
}>) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${getApplicationStatusStyle(status)} ${className}`.trim()}
    >
      {getNormalizedStatusLabel(status)}
    </span>
  );
}
