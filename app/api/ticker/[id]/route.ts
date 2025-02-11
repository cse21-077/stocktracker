import { PrismaClient } from "@prisma/client";
import { NextResponse } from "next/server";

const prisma = new PrismaClient();

export async function PUT(
  req: Request,
  { params }: { params: { id: string } } // Corrected type definition
) {
  try {
    // Validate id
    const id = Number(params.id);
    if (isNaN(id)) {
      return NextResponse.json({ error: "Invalid ID format" }, { status: 400 });
    }

    // Parse request body
    const body = await req.json();
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    // Update only the volume-related fields
    const updatedEvent = await prisma.tickerEvent.update({
      where: { id },
      data: {
        totalImpliedVol: body.totalImpliedVol,
        cleanImpliedVol: body.cleanImpliedVol,
        dirtyVolume: body.dirtyVolume,
        vol: body.vol,
      },
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