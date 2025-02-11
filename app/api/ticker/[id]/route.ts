// File: app/api/ticker/[id]/route.ts

import { PrismaClient } from "@prisma/client";
import { NextResponse } from "next/server";

const prisma = new PrismaClient();

/**
 * Updates a ticker event.
 *
 * Note: The second argument is typed to match the expected type,
 *       i.e. an object with a promise for its params.
 */
export async function PUT(
  req: Request,
  context: { params: Promise<{ id: string | string[] }> } // Updated type: params is a Promise
) {
  try {
    // Await the params since they are provided as a Promise.
    const { id: idParam } = await context.params;

    // If idParam is an array, use the first element (normally it should be a string)
    const idValue = Array.isArray(idParam) ? idParam[0] : idParam;

    // Convert the id to a number and validate
    const id = Number(idValue);
    if (isNaN(id)) {
      return NextResponse.json({ error: "Invalid ID format" }, { status: 400 });
    }

    // Parse the request body
    const body = await req.json();
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    // Only allow certain fields to be updated
    const allowedFields = ["totalImpliedVol", "cleanImpliedVol", "dirtyVolume", "vol"];
    const dataToUpdate = Object.keys(body)
      .filter((key) => allowedFields.includes(key))
      .reduce((acc, key) => ({ ...acc, [key]: body[key] }), {});

    if (Object.keys(dataToUpdate).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    // Update the ticker event in the database
    const updatedEvent = await prisma.tickerEvent.update({
      where: { id },
      data: dataToUpdate,
    });

    return NextResponse.json({ event: updatedEvent }, { status: 200 });
  } catch (error: unknown) {
    console.error("Error updating event:", error);

    // Handle the Prisma "not found" error code
    if (error instanceof Error && "code" in error && error.code === "P2025") {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
