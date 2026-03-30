"use client"

import { useEffect, useMemo, useState, useRef } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Search, Bell, ChevronDown, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getUserInfo, type StoredUser } from "@/lib/authStorage";

type PersonaType = "applicant" | "employee" | "hr" | "manager" | "admin" | "system-admin";

const TOPBAR_CONFIG: Record<PersonaType, { search: string; role: string }> = {
  hr: { search: "Search employees...", role: "HR Administration" },
  employee: { search: "Search...", role: "Internal Staff" },
  applicant: { search: "Search jobs...", role: "Job Applicant" },
  manager: { search: "Search team members...", role: "Manager" },
  admin: { search: "Search...", role: "Admin" },
  "system-admin": { search: "Search...", role: "System Admin" },
};

type PortalNotification = {
  id: string;
  title: string;
  message: string;
  time: string;
  unread: boolean;
};

export function Topbar({ persona = "applicant" }: Readonly<{ persona?: PersonaType }>) {
  const [user, setUser] = useState<StoredUser | null>(null);
  const [searchValue, setSearchValue] = useState("");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const config = TOPBAR_CONFIG[persona];
  const [notifications, setNotifications] = useState<PortalNotification[]>([]);

  useEffect(() => {
    setUser(getUserInfo());
  }, []);

  useEffect(() => {
    const applicantFeed: PortalNotification[] = [
      {
        id: "n1",
        title: "Application Update",
        message: "Frontend Developer role is now under review.",
        time: "2h ago",
        unread: true,
      },
      {
        id: "n2",
        title: "Recruiter Message",
        message: "Please keep your contact number updated for interview scheduling.",
        time: "1d ago",
        unread: true,
      },
      {
        id: "n3",
        title: "New Job Match",
        message: "A new opening matches your saved job preferences.",
        time: "3d ago",
        unread: false,
      },
    ];

    const defaultFeed: PortalNotification[] = [
      {
        id: "n1",
        title: "System Update",
        message: "New activity is available in your dashboard.",
        time: "Today",
        unread: true,
      },
    ];

    setNotifications(persona === "applicant" ? applicantFeed : defaultFeed);
  }, [persona]);

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

  const unreadCount = useMemo(
    () => notifications.filter((note) => note.unread).length,
    [notifications]
  );

  const markAllRead = () => {
    setNotifications((prev) => prev.map((note) => ({ ...note, unread: false })));
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
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="relative text-muted-foreground hover:text-primary transition-colors cursor-pointer group">
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-4 h-4 px-1 rounded-full bg-destructive text-[9px] leading-none font-bold text-destructive-foreground border border-background flex items-center justify-center group-hover:scale-105 transition-transform">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-90 p-0">
            <div className="flex items-center justify-between px-3 py-2.5 border-b border-border">
              <DropdownMenuLabel className="p-0 text-sm text-foreground font-semibold">
                Notifications
              </DropdownMenuLabel>
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="text-[11px] font-semibold text-primary hover:underline cursor-pointer"
                >
                  Mark all as read
                </button>
              )}
            </div>
            <div className="max-h-80 overflow-y-auto">
              {notifications.map((note) => (
                <div key={note.id} className="px-3 py-3 hover:bg-muted/40 transition-colors border-b last:border-b-0 border-border/70">
                  <div className="flex items-start gap-2">
                    <span
                      className={`mt-1.5 h-1.5 w-1.5 rounded-full shrink-0 ${note.unread ? "bg-primary" : "bg-muted-foreground/35"}`}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-foreground">{note.title}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{note.message}</p>
                      <p className="text-[10px] text-muted-foreground/70 mt-1">{note.time}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <DropdownMenuSeparator />
            <div className="px-3 py-2 text-[11px] text-muted-foreground">
              {persona === "applicant" ? "Messages and application updates" : "Workspace updates"}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

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
