"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, ClipboardList, Handshake, HeadphonesIcon,
  Shield, FolderOpen, LogOut, Heart, Share2, BookUser,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const navItems = [
  { href: "/care", icon: LayoutDashboard, label: "Dashboard", exact: true },
  { href: "/care/intakes", icon: ClipboardList, label: "Intakes" },
  { href: "/care/referrals", icon: Share2, label: "Referrals" },
  { href: "/care/providers", icon: BookUser, label: "Directory" },
  { href: "/care/matching", icon: Handshake, label: "Matching" },
  { href: "/care/support", icon: HeadphonesIcon, label: "Support" },
  { href: "/care/insurance", icon: Shield, label: "Insurance" },
  { href: "/care/cases", icon: FolderOpen, label: "Cases" },
];

export function CareSidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex flex-col h-full w-64 bg-card border-r border-border">
      <div className="p-4 border-b border-border">
        <Link href="/" className="flex items-center gap-2">
          <div className="bg-primary rounded-lg p-1.5">
            <Heart className="size-4 text-primary-foreground" fill="currentColor" />
          </div>
          <span className="text-sm font-semibold text-foreground">Care Coordinator</span>
        </Link>
      </div>

      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9">
            <AvatarFallback className="bg-accent text-accent-foreground text-sm">CC</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground truncate">Care Coordinator</p>
            <p className="text-xs text-muted-foreground truncate">Coordinator</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href + "/") || pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              <item.icon className="size-5 flex-shrink-0" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="p-2 border-t border-border">
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted w-full transition-colors"
        >
          <LogOut className="size-5 flex-shrink-0" />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
}
