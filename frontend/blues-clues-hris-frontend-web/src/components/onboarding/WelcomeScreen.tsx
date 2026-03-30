import { PartyPopper } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface WelcomeScreenProps {
  onStart: () => void;
}

export function WelcomeScreen({ onStart }: Readonly<WelcomeScreenProps>) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50">
      <Card className="max-w-2xl w-full">
        <CardHeader className="text-center space-y-4">
          <div className="flex justify-center">
            <div className="rounded-full bg-blue-100 p-6">
              <PartyPopper className="size-16 text-blue-600" />
            </div>
          </div>
          <CardTitle className="text-3xl">Congratulations!</CardTitle>
          <CardDescription className="text-lg">
            Welcome to the team! We're excited to have you on board. Let's get you started with the onboarding process.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-semibold mb-2">What to expect:</h3>
            <ul className="space-y-2 text-sm text-slate-700">
              <li className="flex items-start gap-2">
                <span className="text-blue-600">•</span>
                <span>Complete necessary documentation and forms</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600">•</span>
                <span>Upload required documents with validation</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600">•</span>
                <span>Review and acknowledge company policies</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600">•</span>
                <span>Request necessary equipment and resources</span>
              </li>
            </ul>
          </div>
          <Button onClick={onStart} className="w-full" size="lg">
            Start Onboarding Process
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
