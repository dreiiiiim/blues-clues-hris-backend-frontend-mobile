type StatusKey = 'Active' | 'Pending' | 'Suspended' | 'Expired' | 'Upcoming' | 'Due Soon' | 'Paid';

const badgeVariants: Record<StatusKey, string> = {
  Active:    'bg-green-100 text-green-800',
  Pending:   'bg-yellow-100 text-yellow-800',
  Suspended: 'bg-red-100 text-red-800',
  Expired:   'bg-gray-100 text-gray-800',
  Upcoming:  'bg-blue-100 text-blue-800',
  'Due Soon':'bg-orange-100 text-orange-800',
  Paid:      'bg-green-100 text-green-800',
};

export function StatusBadge({ status }: { status: string }) {
  const classes = badgeVariants[status as StatusKey] ?? 'bg-slate-100 text-slate-600';
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${classes}`}>
      {status}
    </span>
  );
}
