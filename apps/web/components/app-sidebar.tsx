"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, Calendar, Users, MessageSquare, Heart, ClipboardCheck,
  FileText, CreditCard, Shield, Settings, Phone, Sparkles, LogOut, ChevronLeft, ChevronRight,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useState } from "react";

const navItems = [
  { href: "/app", icon: LayoutDashboard, label: "Dashboard", exact: true },
  { href: "/app/appointments", icon: Calendar, label: "Appointments" },
  { href: "/app/providers", icon: Users, label: "Providers" },
  { href: "/app/messages", icon: MessageSquare, label: "Messages" },
  { href: "/app/wellness", icon: Sparkles, label: "Wellness" },
  { href: "/app/checkins", icon: Heart, label: "Check-ins" },
  { href: "/app/assessments", icon: ClipboardCheck, label: "Assessments" },
  { href: "/app/billing", icon: CreditCard, label: "Billing" },
  { href: "/app/insurance", icon: Shield, label: "Insurance" },
  { href: "/app/privacy", icon: FileText, label: "Privacy & Data" },
  { href: "/app/settings", icon: Settings, label: "Settings" },
];

const bottomItems = [
  { href: "/app/help/crisis-support", icon: Phone, label: "Crisis Support", className: "text-destructive" },
];

export function AppSidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        "flex flex-col h-full bg-card border-r border-border transition-all duration-200",
        collapsed ? "w-16" : "w-64"
      )}
    >
      <div className="p-4 border-b border-border flex items-center justify-between">
        {!collapsed && (
          <div className="flex items-center gap-3">
            <Avatar className="h-9 w-9">
              <AvatarFallback className="bg-primary text-primary-foreground text-sm">SJ</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground truncate">Sarah Johnson</p>
              <p className="text-xs text-muted-foreground truncate">Patient</p>
            </div>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1.5 rounded-md hover:bg-muted text-muted-foreground"
        >
          {collapsed ? <ChevronRight className="size-4" /> : <ChevronLeft className="size-4" />}
        </button>
      </div>

      <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted",
                collapsed && "justify-center px-2"
              )}
              title={collapsed ? item.label : undefined}
            >
              <item.icon className="size-5 flex-shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="p-2 border-t border-border space-y-1">
        {bottomItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors hover:bg-destructive/10",
              item.className,
              collapsed && "justify-center px-2"
            )}
            title={collapsed ? item.label : undefined}
          >
            <item.icon className="size-5 flex-shrink-0" />
            {!collapsed && <span>{item.label}</span>}
          </Link>
        ))}
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className={cn(
            "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted w-full transition-colors",
            collapsed && "justify-center px-2"
          )}
        >
          <LogOut className="size-5 flex-shrink-0" />
          {!collapsed && <span>Sign Out</span>}
        </button>
      </div>
    </aside>
  );
}
