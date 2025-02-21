"use client";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useState, useEffect } from "react";
import axios from "axios";
import useSWR from "swr";

// Define the FinancialEvent interface to match your database schema.
interface FinancialEvent {
  id?: number;
  ticker: string;
  eventDate: Date;
  eventName: string;
  eventType: string;
  impact: string;
  cleanImpliedVol?: number;
  dirtyVolume?: number;
  totalImpliedVol?: number;
  vol?: number;
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

const AdminPage = () => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState<FinancialEvent | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDate, setSelectedDate] = useState("");

  // Use SWR to fetch events for all stocks.
  const { data,  isLoading } = useSWR(
    `/api/ticker`,
    fetcher,
    {
      refreshInterval: 30000,
      dedupingInterval: 60000,
    }
  );

  const stockData = data?.events || [];

  // Set the default selected date to today's date.
  useEffect(() => {
    const today = new Date().toISOString().split("T")[0];
    setSelectedDate(today);
  }, []);

  // Filter events using the local date format ("YYYY-MM-DD") for comparison.
  const filteredData = stockData.filter((event: FinancialEvent) => {
    if (!event.eventDate) return false;

    // Convert the event date to a local date string in "YYYY-MM-DD" format.
    const eventDateLocal = new Date(event.eventDate).toLocaleDateString("en-CA");
    const matchesSearch = event.ticker.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDate = selectedDate ? eventDateLocal === selectedDate : true;

    return matchesSearch && matchesDate;
  });

  // Handle updating the event volumes via a PUT request.
  const handleSaveChanges = async () => {
    if (!formData || !formData.id) {
      alert("Invalid event data.");
      return;
    }

    try {
      await axios.put(`/api/ticker/${formData.id}`, formData);
      alert("Changes saved successfully!");
      setIsDialogOpen(false);
    } catch (error) {
      console.error("Error saving changes:", error);
      alert("Failed to save changes.");
    }
  };

  return (
    <div className="container mx-auto p-4 flex flex-col items-center">
      <h1 className="text-2xl font-bold mb-4">Admin Panel</h1>
      <div className="flex space-x-4 mb-4 w-full max-w-2xl">
        <Input
          placeholder="Search tickers..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-grow"
        />
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="w-[180px] border rounded px-2 py-1"
        />
      </div>
      {isLoading ? (
        <p>Loading...</p>
      ) : filteredData.length > 0 ? (
        <Table className="w-full max-w-4xl mx-auto">
          <TableHeader>
            <TableRow>
              <TableHead>Ticker</TableHead>
              <TableHead>Event Name</TableHead>
              <TableHead>Event Type</TableHead>
              <TableHead>Time</TableHead>
              <TableHead>Impact</TableHead>
              <TableHead>TIV</TableHead>
              <TableHead>CIV</TableHead>
              <TableHead>DV</TableHead>
              <TableHead>Vol</TableHead>
              <TableHead>Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredData.map((event: FinancialEvent) => (
              <TableRow key={event.id}>
                <TableCell>{event.ticker}</TableCell>
                <TableCell>{event.eventName}</TableCell>
                <TableCell>{event.eventType}</TableCell>
                <TableCell>
                  {event.eventDate
                    ? new Intl.DateTimeFormat("en-US", { timeStyle: "short" }).format(new Date(event.eventDate))
                    : "Invalid Date"}
                </TableCell>
                <TableCell>{event.impact || "-"}</TableCell>
                <TableCell>{event.totalImpliedVol ?? "-"}</TableCell>
                <TableCell>{event.cleanImpliedVol ?? "-"}</TableCell>
                <TableCell>{event.dirtyVolume ?? "-"}</TableCell>
                <TableCell>{event.vol ?? "-"}</TableCell>
                <TableCell>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setFormData({ ...event });
                      setIsDialogOpen(true);
                    }}
                  >
                    Edit
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <p>No events found for the selected date.</p>
      )}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Event</DialogTitle>
            <DialogDescription>Update the volatility metrics for this event.</DialogDescription>
          </DialogHeader>
          {formData && (
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 gap-4">
                <div className="col-span-4">
                  <label htmlFor="totalImpliedVol" className="text-sm font-medium">
                    Total Implied Volatility
                  </label>
                  <Input
                    id="totalImpliedVol"
                    type="number"
                    value={formData.totalImpliedVol || ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        totalImpliedVol: parseFloat(e.target.value) || undefined,
                      })
                    }
                  />
                </div>
                <div className="col-span-4">
                  <label htmlFor="cleanImpliedVol" className="text-sm font-medium">
                    Clean Implied Volatility
                  </label>
                  <Input
                    id="cleanImpliedVol"
                    type="number"
                    value={formData.cleanImpliedVol || ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        cleanImpliedVol: parseFloat(e.target.value) || undefined,
                      })
                    }
                  />
                </div>
                <div className="col-span-4">
                  <label htmlFor="dirtyVolume" className="text-sm font-medium">
                    Dirty Volatility
                  </label>
                  <Input
                    id="dirtyVolume"
                    type="number"
                    value={formData.dirtyVolume || ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        dirtyVolume: parseFloat(e.target.value) || undefined,
                      })
                    }
                  />
                </div>
                <div className="col-span-4">
                  <label htmlFor="vol" className="text-sm font-medium">
                    Volatility
                  </label>
                  <Input
                    id="vol"
                    type="number"
                    value={formData.vol || ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        vol: parseFloat(e.target.value) || undefined,
                      })
                    }
                  />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={handleSaveChanges} disabled={!formData || !formData.id}>
              Update
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminPage;
