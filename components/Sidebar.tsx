"use client"

import { useState } from "react";
import { LineChart, Calendar, MessageSquare, Settings, BarChart3, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const sidebarItems = [
  { icon: BarChart3, label: "Overview" },
  { icon: Calendar, label: "Events" },
  { icon: LineChart, label: "Analysis" },
  { icon: MessageSquare, label: "Comments" },
  { icon: Settings, label: "Settings" },
];

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);

  return (
      <div className={cn("h-screen border-r bg-card p-4 transition-all", collapsed ? "w-20" : "w-64")}>
        <div className="flex items-center justify-between mb-8">
          {!collapsed && <div className="text-xl font-bold">StockTracker</div>}
          <Button
              variant="ghost"
              className="p-2"
              onClick={() => setCollapsed(!collapsed)}
          >
            {collapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
          </Button>
        </div>
        <nav className="space-y-2">
          {sidebarItems.map((item) => (
              <Button
                  key={item.label}
                  variant="ghost"
                  className="w-full flex items-center gap-2 justify-start"
              >
                <item.icon className="h-5 w-5" />
                {!collapsed && item.label}
              </Button>
          ))}
        </nav>
      </div>
  );
}
