import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import csvParser from 'csv-parser';
import axios from 'axios';
import { PrismaClient } from '@prisma/client';
import { parse } from 'date-fns';

const prisma = new PrismaClient();

// Define a Stock interface.
interface Stock {
  symbol: string;
  name: string;
  currency: string;
}

// Popular stocks constant
const POPULAR_STOCKS: string[] = ["TSLA", "AAPL", "GOOGL", "MSFT", "AMZN", "NVDA"];

// Fetch the full stock list from the FMP General Search API
async function fetchStockList(): Promise<Stock[]> {
  const BASE_URL = process.env.FMP_API_BASE_URL || 'https://financialmodelingprep.com/api/v3';
  const FMP_API_KEY = process.env.FMP_API_KEY;

  if (!FMP_API_KEY) {
    console.error('Missing API key for Financial Modeling Prep.');
    return [];
  }

  try {
    const responses = await Promise.all(
      POPULAR_STOCKS.map(async (ticker) => {
        const response = await axios.get(`${BASE_URL}/search?query=${ticker}&apikey=${FMP_API_KEY}`);
        return response.data;
      })
    );

    const stockList = responses
      .flat()
      .filter((stock: any) => {
        if (!stock.symbol || !stock.currency) {
          console.log('Skipping stock with missing data:', stock);
          return false;
        }
        // Ensure the symbol is exactly one of our popular stocks
        return POPULAR_STOCKS.includes(stock.symbol);
      })
      .map((stock: any): Stock => ({
        symbol: stock.symbol,
        name: stock.name || stock.symbol,
        currency: stock.currency.toUpperCase().trim(), // normalize currency
      }));

    console.log('Fetched stock list:', stockList);
    return stockList;
  } catch (error: any) {
    console.error(`Error fetching stock list: ${error.response?.status} - ${error.message}`);
    return [];
  }
}

// Parse the CSV file and extract the data
async function parseCSV(filePath: string): Promise<any[]> {
  const results: any[] = [];
  return new Promise((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(csvParser())
      .on('data', (data) => {
        // Skip rows that are completely empty
        if (Object.values(data).every(value => value === '')) {
          return;
        }
        results.push(data);
      })
      .on('end', () => resolve(results))
      .on('error', (error: Error) => reject(error));
  });
}

// Process economic events for a given stock by matching the stock's currency with the event's country
function processEconomicEventsForStock(stock: Stock, economicEvents: any[]): any[] {
  console.log(`Processing events for stock: ${stock.symbol} with currency: ${stock.currency}`);
  
  if (!Array.isArray(economicEvents)) {
    console.error('Economic events is not an array:', economicEvents);
    return [];
  }
  
  const matchedEvents = economicEvents
    .filter((event: any) => {
      if (!event || !event.Country || !stock.currency) {
        console.log(`Skipping event due to missing country/currency:`, event);
        return false;
      }
      // Compare normalized (uppercase and trimmed) values
      const isMatch = event.Country.toUpperCase().trim() === stock.currency;
      return isMatch;
    })
    .map((event: any) => {
      try {
        if (!event.Date) {
          console.error('Missing date in event:', event);
          return null;
        }
        
        // Parse the event date (ensure the date is valid)
        const parsedDate = parse(event.Date, 'MM-dd-yyyy', new Date());
        if (isNaN(parsedDate.getTime())) {
          console.error('Invalid date in event:', event.Date, 'for event:', event.Title);
          return null;
        }
        
        return {
          ticker: stock.symbol,
          eventDate: parsedDate,
          eventName: event.Title || 'Unnamed Event',
          eventType: 'Economic',
          impact: event.Impact || 'Unknown',
          details: JSON.stringify(event), // Convert to string to avoid nested object issues
        };
      } catch (error) {
        console.error(`Error processing event:`, error, event);
        return null;
      }
    })
    .filter(event => event !== null); // filter out any null events from failed parsing

  console.log(`Processed ${matchedEvents.length} events for ${stock.symbol}`);
  return matchedEvents;
}

// Upsert events into the database
async function storeEvents(events: any[]): Promise<void> {
  if (!Array.isArray(events)) {
    console.error('Invalid events data (not an array):', events);
    return;
  }

  if (events.length === 0) {
    console.log('No events to store.');
    return;
  }

  const validEvents = events.filter(event => {
    if (!event) {
      console.error('Null or undefined event found');
      return false;
    }
    if (typeof event !== 'object') {
      console.error('Invalid event data (not an object):', event);
      return false;
    }
    if (!event.ticker || !event.eventDate || !event.eventName) {
      console.error('Missing required fields in event:', JSON.stringify(event));
      return false;
    }
    if (isNaN(new Date(event.eventDate).getTime())) {
      console.error('Invalid event date for event:', JSON.stringify(event));
      return false;
    }
    return true;
  });

  console.log(`Found ${validEvents.length} valid events out of ${events.length} total`);

  try {
    for (const event of validEvents) {
      // First check if the record exists
      const existingRecord = await prisma.tickerEvent.findFirst({
        where: {
          ticker: String(event.ticker),
          eventDate: new Date(event.eventDate)
        }
      });

      const processedEvent = {
        ticker: String(event.ticker),
        eventDate: new Date(event.eventDate),
        eventName: String(event.eventName),
        eventType: String(event.eventType || 'Economic'),
        impact: String(event.impact || 'Unknown'),
        details: typeof event.details === 'string' ? event.details : JSON.stringify(event.details),
      };

      if (existingRecord) {
        // Update existing record
        await prisma.tickerEvent.update({
          where: { id: existingRecord.id },
          data: processedEvent
        });
      } else {
        // Create new record
        await prisma.tickerEvent.create({
          data: processedEvent
        });
      }
    }
    console.log(`Stored ${validEvents.length} events successfully.`);
  } catch (error: any) {
    console.error('Error storing events:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

// Weekly update: fetch and store events for popular stocks
async function weeklyUpdate(): Promise<void> {
  try {
    const stockList = await fetchStockList();
    if (stockList.length === 0) {
      console.warn('No stocks fetched. Weekly update aborted.');
      return;
    }
    
    const filePath = path.join(process.cwd(), 'public', 'economic_calendar.csv');
    
    if (!fs.existsSync(filePath)) {
      console.error(`CSV file not found at path: ${filePath}`);
      return;
    }
    
    const economicEvents = await parseCSV(filePath);
    
    if (economicEvents.length === 0) {
      console.warn('No economic events parsed. Weekly update aborted.');
      return;
    }
    
    console.log(`Parsed ${economicEvents.length} economic events`);

    let allEvents: any[] = [];
    for (const stock of stockList) {
      const stockEvents = processEconomicEventsForStock(stock, economicEvents);
      console.log(`Found ${stockEvents.length} events for ${stock.symbol}`);
      allEvents = [...allEvents, ...stockEvents];
    }
    
    if (allEvents.length === 0) {
      console.log('No events to store after processing.');
      return;
    }
    
    await storeEvents(allEvents);
    console.log('Weekly update completed successfully.');
  } catch (error: any) {
    console.error(`Error in weekly update: ${error.message}`);
    console.error('Stack trace:', error.stack);
  }
}

// GET: Retrieve ticker events (optionally filtered by a query parameter ?ticker=...)
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const ticker = searchParams.get('ticker');

    if (ticker) {
      const events = await prisma.tickerEvent.findMany({ where: { ticker } });
      return events.length
        ? NextResponse.json({ events })
        : NextResponse.json({ events: await fetchAndStoreEventsForStock(ticker) });
    } else {
      return NextResponse.json({ events: await prisma.tickerEvent.findMany() });
    }
  } catch (error: any) {
    console.error('GET API error:', error.message);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}

// POST: Trigger weekly fetching/upserting of events for popular stocks
export async function POST(req: Request) {
  try {
    await weeklyUpdate();
    return NextResponse.json({ message: 'Weekly popular stocks events update completed successfully.' });
  } catch (error: any) {
    console.error('POST API error:', error.message);
    console.error('Stack trace:', error.stack);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}

// Helper function to fetch and store events for a specific stock
async function fetchAndStoreEventsForStock(tickerSymbol: string): Promise<any[]> {
  try {
    const stockList = await fetchStockList();
    const stockInfo = stockList.find((stock) => stock.symbol === tickerSymbol);

    if (!stockInfo) {
      console.log(`Stock ${tickerSymbol} not found.`);
      return [];
    }

    const filePath = path.join(process.cwd(), 'public', 'economic_calendar.csv');
    if (!fs.existsSync(filePath)) {
      console.error(`CSV file not found at path: ${filePath}`);
      return [];
    }
    
    const economicEvents = await parseCSV(filePath);
    if (economicEvents.length === 0) {
      console.log(`No economic events found for ${tickerSymbol}.`);
      return [];
    }
    
    const events = processEconomicEventsForStock(stockInfo, economicEvents);
    if (events.length === 0) {
      console.log(`No matching events found for ${tickerSymbol}.`);
      return [];
    }

    await storeEvents(events);
    console.log(`Fetched and stored events for ${tickerSymbol}.`);
    return events;
  } catch (error: any) {
    console.error(`Error fetching events for ${tickerSymbol}: ${error.message}`);
    console.error('Stack trace:', error.stack);
    return [];
  }
}