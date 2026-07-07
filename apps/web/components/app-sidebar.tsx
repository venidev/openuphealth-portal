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
        "flex flex-col h-full bg-neutral-950/80 backdrop-blur-md border-r border-white/10 transition-all duration-200 font-sans",
        collapsed ? "w-16" : "w-64"
      )}
    >
      <div className="p-4 border-b border-white/10 flex items-center justify-between">
        {!collapsed && (
          <div className="flex items-center gap-3">
            <Avatar className="h-9 w-9">
              <AvatarFallback className="bg-gradient-to-br from-indigo-500/40 to-emerald-500/40 text-white text-sm ring-1 ring-white/10">SJ</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="text-sm font-medium text-white truncate">Sarah Johnson</p>
              <p className="text-xs text-slate-400 truncate">Patient</p>
            </div>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
          className="p-1.5 rounded-md hover:bg-white/5 text-slate-400 transition-colors"
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
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-300",
                isActive
                  ? "bg-emerald-400/10 text-emerald-300 ring-1 ring-emerald-400/20"
                  : "text-slate-400 hover:text-white hover:bg-white/5",
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

      <div className="p-2 border-t border-white/10 space-y-1">
        {bottomItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-rose-300 transition-all duration-300 hover:bg-rose-400/10",
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
            "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-slate-400 hover:text-white hover:bg-white/5 w-full transition-all duration-300",
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
