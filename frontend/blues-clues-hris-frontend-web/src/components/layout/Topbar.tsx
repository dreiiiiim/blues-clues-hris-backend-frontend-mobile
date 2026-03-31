"use client"

import { useEffect, useState, useRef } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Search, ChevronDown, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { getUserInfo, type StoredUser } from "@/lib/authStorage";
import { NotificationBell } from "@/components/NotificationBell";

type PersonaType = "applicant" | "employee" | "hr" | "manager" | "admin" | "system-admin";

const TOPBAR_CONFIG: Record<PersonaType, { search: string; role: string }> = {
  hr: { search: "Search employees...", role: "HR Administration" },
  employee: { search: "Search...", role: "Internal Staff" },
  applicant: { search: "Search jobs...", role: "Job Applicant" },
  manager: { search: "Search team members...", role: "Manager" },
  admin: { search: "Search...", role: "Admin" },
  "system-admin": { search: "Search...", role: "System Admin" },
};

export function Topbar({ persona = "applicant" }: { persona?: PersonaType }) {
  const [user, setUser] = useState<StoredUser | null>(null);
  const [searchValue, setSearchValue] = useState("");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const config = TOPBAR_CONFIG[persona];

  useEffect(() => {
    setUser(getUserInfo());
  }, []);

  // Sync topbar input with URL ?q= when URL changes (e.g. page navigation)
  useEffect(() => {
    setSearchValue(searchParams.get("q") ?? "");
  }, [searchParams]);

  const handleSearch = (value: string) => {
    setSearchValue(value);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) params.set("q", value); else params.delete("q");
      router.replace(`${pathname}?${params.toString()}`, { scroll: false } as any);
    }, 300);
  };

  const initial = user?.name?.charAt(0) || persona.charAt(0).toUpperCase();

  return (
    <header className="h-16 bg-background border-b border-border flex items-center justify-between px-8 shrink-0">

      {/* Search Section */}
      <div className="relative w-96">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder={config.search}
          value={searchValue}
          onChange={(e) => handleSearch(e.target.value)}
          className="pl-9 bg-muted/30 border-border focus-visible:ring-primary/20"
        />
      </div>

      {/* Actions and Profile Section */}
      <div className="flex items-center gap-6">

        {/* Notifications */}
        {persona === "applicant" && user && (
          <NotificationBell applicantId={user.user_id} showUnreadBadge={true} />
        )}

        {/* Profile Dropdown */}
        <button className="flex items-center gap-3 border-l border-border pl-6 cursor-pointer group">
          <div className="flex flex-col text-right transition-transform group-hover:-translate-x-1">
            <span className="text-sm font-semibold text-foreground">
              {user?.name || "Loading..."}
            </span>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
              {config.role}
            </span>
          </div>

          {/* Avatar */}
          <div className="h-9 w-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm border border-primary/20 transition-all group-hover:bg-primary group-hover:text-primary-foreground">
            {user ? initial : <Loader2 className="h-4 w-4 animate-spin" />}
          </div>

          <ChevronDown className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
        </button>

      </div>
    </header>
  );
}
