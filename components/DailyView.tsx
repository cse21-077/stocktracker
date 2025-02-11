"use client";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { useState, useEffect, useMemo } from "react";

interface DailyViewProps {
  selectedStock: string;
  stockData: any[];
}

export default function DailyView({ selectedStock, stockData }: DailyViewProps) {
  const today = new Date();

  // Filter events that occur today.
  const todayEvents = stockData.filter((item) => {
    const eventDate = new Date(item.eventDate);
    return (
      eventDate.getFullYear() === today.getFullYear() &&
      eventDate.getMonth() === today.getMonth() &&
      eventDate.getDate() === today.getDate()
    );
  });

  // Build fixed time slots from 6:00 AM to 11:00 PM (i.e. hours 6 to 23)
  // Use useMemo so that timeSlots remains stable between renders.
  const timeSlots = useMemo(() => {
    const slots: number[] = [];
    for (let hour = 6; hour < 24; hour++) {
      slots.push(hour);
    }
    return slots;
  }, []);

  // Group today's events by their hour.
  const eventsByHour: { [hour: number]: any[] } = {};
  todayEvents.forEach((item) => {
    const eventDate = new Date(item.eventDate);
    const eventHour = eventDate.getHours();
    if (!eventsByHour[eventHour]) {
      eventsByHour[eventHour] = [];
    }
    eventsByHour[eventHour].push(item);
  });

  // Get the current hour (using local time)
  const currentHour = new Date().getHours();

  // Pagination state (10 rows per page)
  const rowsPerPage = 10;
  const [currentPage, setCurrentPage] = useState(0);

  // Auto-set current page once when the component mounts (to show the current hour).
  useEffect(() => {
    if (currentHour >= 6 && currentHour < 24) {
      const index = timeSlots.findIndex((hour) => hour === currentHour);
      if (index !== -1) {
        const newPage = Math.floor(index / rowsPerPage);
        setCurrentPage(newPage);
      }
    }
  }, []); // Run only once on mount

  const totalPages = Math.ceil(timeSlots.length / rowsPerPage);
  const startIndex = currentPage * rowsPerPage;
  const endIndex = startIndex + rowsPerPage;
  const displayedTimeSlots = timeSlots.slice(startIndex, endIndex);

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Time</TableHead>
            <TableHead>Symbol</TableHead>
            <TableHead>Event</TableHead>
            <TableHead>Impact</TableHead>
            <TableHead>TIV</TableHead>
            <TableHead>CIV</TableHead>
            <TableHead>DV</TableHead>
            <TableHead>Vol</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {displayedTimeSlots.map((hour) => {
            // Format the time slot label (e.g., "06:00 AM")
            const timeLabel = new Date(today.getFullYear(), today.getMonth(), today.getDate(), hour)
              .toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
            const events = eventsByHour[hour] || [];
            const eventName = events.map((e: any) => e.eventName).join(" / ");
            const impact = events.map((e: any) => e.impact).join(" / ");
            const symbol = events.length > 0 ? events[0].ticker : selectedStock;
            const totalImpliedVol = events.map((e: any) => e.totalImpliedVol).join(" / ");
            const cleanImpliedVol = events.map((e: any) => e.cleanImpliedVol).join(" / ");
            const dirtyVolume = events.map((e: any) => e.dirtyVolume).join(" / ");
            const vol = events.map((e: any) => e.vol).join(" / ");
            const isCurrentHour = hour === currentHour;

            return (
              <TableRow key={hour} className={isCurrentHour ? "bg-blue-700" : ""}>
                <TableCell>{timeLabel}</TableCell>
                <TableCell>{symbol}</TableCell>
                <TableCell>{eventName || "-"}</TableCell>
                <TableCell>{impact || "-"}</TableCell>
                <TableCell>{totalImpliedVol || "-"}</TableCell>
                <TableCell>{cleanImpliedVol || "-"}</TableCell>
                <TableCell>{dirtyVolume || "-"}</TableCell>
                <TableCell>{vol || "-"}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      {/* Pagination Controls */}
      <div className="flex justify-end mt-4 space-x-2">
        <Button
          onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 0))}
          disabled={currentPage === 0}
        >
          Previous
        </Button>
        <Button
          onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages - 1))}
          disabled={currentPage >= totalPages - 1}
        >
          Next
        </Button>
      </div>
    </>
  );
}
