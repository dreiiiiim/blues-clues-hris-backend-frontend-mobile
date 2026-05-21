import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { Outfit } from "next/font/google";
import { ArrowLeft } from "lucide-react";

const outfit = Outfit({ subsets: ["latin"] });

export default function SubscriptionLayout({ children }: { children: ReactNode }) {
  return (
    <div className={`${outfit.className} relative min-h-[100dvh] overflow-x-hidden bg-slate-50`}>
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-48 -left-48 h-[40rem] w-[40rem] rounded-full bg-primary/5 blur-[160px]" />
        <div className="absolute -bottom-32 -right-24 h-[32rem] w-[32rem] rounded-full bg-primary/3 blur-[130px]" />
      </div>

      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-slate-200/80 bg-white/80 px-4 backdrop-blur-md sm:px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <Image
            src="/blues-clues-logo.png"
            alt="Blue's Clues HRIS"
            width={28}
            height={28}
            className="rounded-md"
            priority
          />
          <span className="text-sm font-semibold tracking-tight text-slate-800">
            Blue&apos;s Clues HRIS
          </span>
        </Link>
        <Link
          href="/"
          className="flex items-center gap-1.5 text-xs font-medium text-slate-500 transition-colors duration-200 hover:text-slate-800"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back home
        </Link>
      </header>

      {children}
    </div>
  );
}
