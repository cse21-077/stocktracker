import { PrismaClient } from "@prisma/client";
import { NextResponse } from "next/server";

const prisma = new PrismaClient();

export async function PUT(
  req: Request,
  context: { params: { id: string } } // Explicitly define the context type
) {
  try {
    // Validate id
    const id = Number(context.params.id); // Access params via context
    if (isNaN(id)) {
      return NextResponse.json({ error: "Invalid ID format" }, { status: 400 });
    }

    // Parse request body
    const body = await req.json();
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    // Ensure only allowed fields are updated
    const allowedFields = ["totalImpliedVol", "cleanImpliedVol", "dirtyVolume", "vol"];
    const dataToUpdate = Object.keys(body)
      .filter((key) => allowedFields.includes(key))
      .reduce((acc, key) => ({ ...acc, [key]: body[key] }), {});

    if (Object.keys(dataToUpdate).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    // Update the TickerEvent record
    const updatedEvent = await prisma.tickerEvent.update({
      where: { id },
      data: dataToUpdate,
    });

    return NextResponse.json({ event: updatedEvent }, { status: 200 });
  } catch (error: unknown) {
    console.error("Error updating event:", error);

    if (error instanceof Error && "code" in error && error.code === "P2025") {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}