"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface MonthlyViewProps {
  selectedStock: string;
  selectedDate?: Date;
}

interface TickerEvent {
  id: number;
  ticker: string;
  eventDate: string;
  eventName: string;
  impact: string;
}

export default function MonthlyView({ selectedStock, selectedDate }: MonthlyViewProps) {
  const [monthlyEvents, setMonthlyEvents] = useState<TickerEvent[]>([]);

  useEffect(() => {
    async function getMonthlyData() {
      try {
        const res = await fetch(`/api/ticker?ticker=${selectedStock}`);
        const json = await res.json();
        // Use the selectedDate or fall back to today.
        const refDate = selectedDate ? new Date(selectedDate) : new Date();
        const month = refDate.getMonth();
        const year = refDate.getFullYear();
        const filtered = json.events.filter((event: any) => {
          const eventDate = new Date(event.eventDate);
          return eventDate.getMonth() === month && eventDate.getFullYear() === year;
        });
        setMonthlyEvents(filtered);
      } catch (error) {
        console.error("Error fetching monthly events:", error);
      }
    }

    if (selectedStock && selectedDate) {
      getMonthlyData();
    }
  }, [selectedStock, selectedDate]);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">{selectedStock} Monthly Events</h3>
        <p className="text-sm text-muted-foreground">
          {selectedDate?.toLocaleString("default", { month: "long", year: "numeric" })}
        </p>
      </div>

      {monthlyEvents.length > 0 ? (
        <div className="space-y-4">
          {monthlyEvents.map((event) => (
            <Card key={event.id}>
              <CardHeader className="py-2">
                <CardTitle className="text-sm font-medium">
                  {new Date(event.eventDate).toLocaleDateString()}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex justify-between items-center">
                  <div className="font-medium">{event.eventName}</div>
                  <Badge
                    variant={
                      event.impact.toLowerCase() === "high"
                        ? "destructive"
                        : event.impact.toLowerCase() === "medium"
                        ? "default"
                        : "secondary"
                    }
                  >
                    {event.impact.toUpperCase()}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <p>No monthly events to show.</p>
      )}
    </div>
  );
}
