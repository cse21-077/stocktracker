import axios from 'axios';
import { PrismaClient } from '@prisma/client';
import { NextResponse } from 'next/server';

const prisma = new PrismaClient();
const FMP_API_KEY = process.env.FMP_API_KEY;
const BASE_URL = 'https://financialmodelingprep.com/api/v3';

if (!FMP_API_KEY) {
    throw new Error('FMP_API_KEY environment variable is not set.');
}

// -------------------- Helper Functions --------------------

// Fetch all tickers from the external API
async function fetchTickers() {
    try {
        const response = await axios.get(`${BASE_URL}/stock/list?apikey=${FMP_API_KEY}`);
        return response.data
            .filter((ticker: any) => ticker.symbol && ticker.currency)
            .map((ticker: any) => ({
                symbol: ticker.symbol,
                currency: ticker.currency,
            }));
    } catch (error: any) {
        console.error(`Error fetching tickers: ${error.response?.status} - ${error.message}`);
        return [];
    }
}

// Fetch economic events from the external API
async function fetchEconomicEvents() {
    try {
        const response = await axios.get(`${BASE_URL}/economic_calendar?apikey=${FMP_API_KEY}`);
        return response.data || [];
    } catch (error: any) {
        console.error(`Error fetching economic events: ${error.response?.status} - ${error.message}`);
        return [];
    }
}

// Fetch stock-specific events (dividends, earnings, splits, mergers) for each ticker
async function fetchAllStockEvents(tickers: { symbol: string }[]) {
    const stockEvents: { [key: string]: any } = {};

    await Promise.all(
        tickers.map(async (ticker) => {
            try {
                const [dividends, earnings, splits, mergers] = await Promise.all([
                    axios
                        .get(`${BASE_URL}/historical/stock_dividend/${ticker.symbol}?apikey=${FMP_API_KEY}`)
                        .catch(() => ({ data: [] })),
                    axios
                        .get(`${BASE_URL}/historical/earnings_calendar/${ticker.symbol}?apikey=${FMP_API_KEY}`)
                        .catch(() => ({ data: [] })),
                    axios
                        .get(`${BASE_URL}/stock_split_calendar/${ticker.symbol}?apikey=${FMP_API_KEY}`)
                        .catch(() => ({ data: [] })),
                    axios
                        .get(`${BASE_URL}/merger_acquisition?apikey=${FMP_API_KEY}`)
                        .catch(() => ({ data: [] })),
                ]);

                stockEvents[ticker.symbol] = {
                    dividends: dividends.data || [],
                    earnings: earnings.data || [],
                    splits: splits.data || [],
                    // Only include mergers for the current ticker.
                    mergers: mergers.data.filter((m: any) => m.symbol === ticker.symbol),
                };
            } catch (error) {
                console.error(`Error fetching stock events for ${ticker.symbol}:`, error);
            }
        })
    );

    return stockEvents;
}

// Simple impact calculation helper
function determineImpact(value: any): string {
    if (typeof value === 'number') {
        return value > 1 ? 'High' : value > 0.5 ? 'Medium' : 'Low';
    }
    return value === 'High' ? 'High' : 'Medium';
}

// Combine economic and stock events into a unified array
function processEvents(tickers: { symbol: string; currency: string }[], economicEvents: any[], stockEvents: { [key: string]: any }) {
    return tickers.flatMap((ticker) => {
        const events: any[] = [];

        // Process economic events for matching currency
        economicEvents
            .filter((event) => event.currency === ticker.currency)
            .forEach((event) => {
                events.push({
                    ticker: ticker.symbol,
                    eventDate: new Date(event.date),
                    eventName: event.event,
                    eventType: 'Economic',
                    impact: event.impact || determineImpact(event.importance),
                    details: {
                        currency: ticker.currency,
                        event: event.event
                    }
                });
            });

        // Process stock-specific events
        const stockData = stockEvents[ticker.symbol];
        if (stockData) {
            // Process dividends
            events.push(
                ...stockData.dividends.map((dividend: any) => ({
                    ticker: ticker.symbol,
                    eventDate: new Date(dividend.date),
                    eventName: `Dividend Payment: ${dividend.dividend}`,
                    eventType: 'Dividend',
                    impact: determineImpact(dividend.dividend),
                    details: dividend
                })),
                // Process earnings
                ...stockData.earnings.map((earning: any) => ({
                    ticker: ticker.symbol,
                    eventDate: new Date(earning.date),
                    eventName: `Earnings Report`,
                    eventType: 'Earnings',
                    impact: determineImpact(earning.eps - earning.epsEstimated),
                    details: {
                        eps: earning.eps,
                        epsEstimated: earning.epsEstimated,
                        revenue: earning.revenue,
                        revenueEstimated: earning.revenueEstimated,
                    }
                })),
                // Process splits
                ...stockData.splits.map((split: any) => ({
                    ticker: ticker.symbol,
                    eventDate: new Date(split.date),
                    eventName: `Stock Split ${split.numerator}:${split.denominator}`,
                    eventType: 'Split',
                    impact: determineImpact(split.numerator / split.denominator),
                    details: split
                })),
                // Process mergers
                ...stockData.mergers.map((merger: any) => ({
                    ticker: ticker.symbol,
                    eventDate: new Date(merger.date),
                    eventName: merger.title,
                    eventType: 'M&A',
                    impact: 'High',
                    details: merger
                }))
            );
        }

        return events;
    });
}

// Upsert events into the database
async function storeEvents(events: any[]) {
    await Promise.all(
        events.map((event) =>
            prisma.tickerEvent.upsert({
                where: { ticker_eventDate: { ticker: event.ticker, eventDate: event.eventDate } },
                update: {
                    eventName: event.eventName,
                    eventType: event.eventType,
                    impact: event.impact,
                    details: event.details,
                    cleanImpliedVol: event.cleanImpliedVol,
                    dirtyVolume: event.dirtyVolume,
                    totalImpliedVol: event.totalImpliedVol,
                    vol: event.vol
                },
                create: {
                    ticker: event.ticker,
                    eventDate: event.eventDate,
                    eventName: event.eventName,
                    eventType: event.eventType,
                    impact: event.impact,
                    details: event.details,
                    cleanImpliedVol: event.cleanImpliedVol,
                    dirtyVolume: event.dirtyVolume,
                    totalImpliedVol: event.totalImpliedVol,
                    vol: event.vol
                },
            })
        )
    );
}

// Main function to fetch data from external APIs and store into the DB
async function fetchAndStoreEvents() {
    try {
        const tickers = await fetchTickers();
        if (!tickers.length) {
            console.warn('No tickers retrieved. Skipping event fetching.');
            return;
        }

        const [economicEvents, allStockEvents] = await Promise.all([
            fetchEconomicEvents(),
            fetchAllStockEvents(tickers),
        ]);

        const processedEvents = processEvents(tickers, economicEvents, allStockEvents);
        await storeEvents(processedEvents);
        console.log('Events successfully stored in the database.');
    } catch (error) {
        console.error('Error in fetchAndStoreEvents:', error);
        throw error;
    }
}

// -------------------- API Route Handlers --------------------

// GET: Retrieve ticker events (optionally filtered by a query parameter ?ticker=...)
export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const ticker = searchParams.get('ticker');

        const events = ticker
            ? await prisma.tickerEvent.findMany({ where: { ticker } })
            : await prisma.tickerEvent.findMany();

        return NextResponse.json({ events });
    } catch (error) {
        console.error('Error retrieving ticker events:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

// POST: Trigger fetching/upserting events from external APIs
export async function POST(req: Request) {
    try {
        await fetchAndStoreEvents();
        return NextResponse.json({ message: 'Events fetched and stored successfully.' });
    } catch (error) {
        console.error('Error in POST fetchAndStoreEvents:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}