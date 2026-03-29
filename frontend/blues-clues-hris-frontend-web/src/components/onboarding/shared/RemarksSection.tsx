import { MessageSquare } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Remark } from "@/types/onboarding.types";

interface RemarksSectionProps {
  items: Array<{ remarksHistory?: Remark[] }>;
}

export function RemarksSection({ items }: Readonly<RemarksSectionProps>) {
  const allRemarks: Remark[] = [];
  items.forEach((item) => {
    if (item.remarksHistory && item.remarksHistory.length > 0) {
      allRemarks.push(...item.remarksHistory);
    }
  });
  const sortedRemarks = allRemarks.toSorted((a, b) => b.date.getTime() - a.date.getTime());

  if (sortedRemarks.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="size-5" />
          Remarks & Feedback
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="max-h-75">
          <div className="space-y-3">
            {sortedRemarks.map((remark) => (
              <div key={remark.id} className="p-3 bg-slate-50 rounded-lg border">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-700">{remark.author}</span>
                    <Badge variant="outline" className="text-xs">
                      {remark.category}
                    </Badge>
                  </div>
                  <span className="text-xs text-slate-500">{remark.date.toLocaleString()}</span>
                </div>
                <p className="text-sm text-slate-600">{remark.message}</p>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
