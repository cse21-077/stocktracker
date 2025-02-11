"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface WeeklyViewProps {
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

export default function WeeklyView({ selectedStock, selectedDate }: WeeklyViewProps) {
  const [weeklyEvents, setWeeklyEvents] = useState<TickerEvent[]>([]);

  useEffect(() => {
    async function getWeeklyData() {
      try {
        const res = await fetch(`/api/ticker?ticker=${selectedStock}`);
        const json = await res.json();
        const selected = selectedDate ? new Date(selectedDate) : new Date();

        // Calculate Monday and Sunday for the week (assuming week starts on Monday)
        const day = selected.getDay();
        const adjustedDay = day === 0 ? 7 : day;
        const monday = new Date(selected);
        monday.setDate(selected.getDate() - adjustedDay + 1);
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);

        const filtered = json.events.filter((event: any) => {
          const eventDate = new Date(event.eventDate);
          return eventDate >= monday && eventDate <= sunday;
        });
        setWeeklyEvents(filtered);
      } catch (error) {
        console.error("Error fetching weekly events:", error);
      }
    }

    if (selectedStock && selectedDate) {
      getWeeklyData();
    }
  }, [selectedStock, selectedDate]);

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">{selectedStock} Weekly Events</h3>
        <p className="text-sm text-muted-foreground">Week of {selectedDate?.toLocaleDateString()}</p>
      </div>

      {weeklyEvents.length > 0 ? (
        weeklyEvents.map((event) => {
          // Derive the day name from eventDate
          const dayName = new Date(event.eventDate).toLocaleDateString(undefined, { weekday: "long" });
          return (
            <Card key={event.id}>
              <CardHeader className="py-2">
                <CardTitle className="text-sm font-medium">{dayName}</CardTitle>
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
          );
        })
      ) : (
        <p>No weekly events to show.</p>
      )}
    </div>
  );
}
