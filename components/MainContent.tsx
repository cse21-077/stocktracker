"use client";

import { useState } from "react";
import useSWR from "swr";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import DailyView from "./DailyView";
import WeeklyView from "./WeeklyView";
import MonthlyView from "./MonthlyView";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// A simple fetcher function for SWR
const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function MainContent() {
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [view, setView] = useState<string>("daily");
  const [selectedStock, setSelectedStock] = useState<string>("TSLA");
  const [searchTerm, setSearchTerm] = useState<string>("");

  const stocks = ["TSLA", "AAPL", "GOOGL", "MSFT", "AMZN", "NVDA"];

  /**
   * Determine which endpoint to call:
   * - When the search bar is empty, fetch events for the selected stock.
   * - When there is a search term, fetch events for all stocks.
   */
  const swrUrl = searchTerm.trim()
    ? `/api/ticker`
    : `/api/ticker?ticker=${selectedStock}`;

  const { data, error, isLoading, mutate } = useSWR(swrUrl, fetcher, {
    refreshInterval: 30000, // revalidate every 30 seconds
    dedupingInterval: 60000, // re-use data if fetched within the last minute
  });

  // Extract stock events from the fetched data.
  const stockData = data?.events || [];

  // Filter events using the search term if one exists.
  let filteredData = stockData;
  if (searchTerm.trim()) {
    const lowerSearch = searchTerm.toLowerCase();
    filteredData = stockData.filter(
      (event: any) =>
        event.ticker.toLowerCase().includes(lowerSearch) ||
        event.eventName.toLowerCase().includes(lowerSearch)
    );
  }

  // When search is active, ignore the dropdown's selected stock by setting activeStock to an empty string.
  // Otherwise, use the selected stock.
  const activeStock: string = searchTerm.trim() ? "" : selectedStock;

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Stock Market Tracker</h1>
        <div className="flex items-center gap-2">
          <Select
            value={selectedStock}
            onValueChange={setSelectedStock}
            disabled={!!searchTerm.trim()}
          >
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Select stock" />
            </SelectTrigger>
            <SelectContent>
              {stocks.map((stock) => (
                <SelectItem key={stock} value={stock}>
                  {stock}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            placeholder="Search stocks..."
            className="w-[200px]"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <Button
            size="icon"
            onClick={() => {
              // Optional: manually trigger revalidation if needed.
              // mutate();
            }}
          >
            <Search className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Tabs Section */}
      <Tabs value={view} onValueChange={setView} className="space-y-4">
        <TabsList>
          <TabsTrigger value="daily">Daily</TabsTrigger>
          <TabsTrigger value="weekly">Weekly</TabsTrigger>
          <TabsTrigger value="monthly">Monthly</TabsTrigger>
        </TabsList>

        {/* Daily Tab */}
        <TabsContent value="daily" className="space-y-4">
          {isLoading ? (
            <p>Loading...</p>
          ) : filteredData.length > 0 ? (
            <DailyView
              // Pass activeStock (always a string) to DailyView.
              selectedStock={activeStock}
              stockData={filteredData}
            />
          ) : (
            <p>
              No stock data{" "}
              {searchTerm
                ? "matching your search."
                : `for ${selectedStock}.`}
            </p>
          )}
        </TabsContent>

        {/* Weekly Tab */}
        <TabsContent value="weekly">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Calendar
              mode="single"
              selected={date}
              onSelect={setDate}
              className="rounded-md border"
            />
            <Card>
              <CardContent className="pt-6">
                <WeeklyView selectedStock={selectedStock} selectedDate={date} />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Monthly Tab */}
        <TabsContent value="monthly">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Calendar
              mode="single"
              selected={date}
              onSelect={setDate}
              className="rounded-md border"
            />
            <Card>
              <CardContent className="pt-6">
                <MonthlyView selectedStock={selectedStock} selectedDate={date} />
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
