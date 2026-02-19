import { NextResponse } from "next/server"
import { getChargeViewingInfo } from "@/lib/services/asaas-api"

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const paymentId = params.id

    if (!paymentId) {
      return NextResponse.json(
        { error: "Payment ID is required" },
        { status: 400 }
      )
    }

    console.log("[v0] Fetching viewing info for payment:", paymentId)

    const response = await getChargeViewingInfo(paymentId)

    if (response.error) {
      console.error("[v0] Error from Asaas API:", response.error)
      return NextResponse.json(
        { error: response.error },
        { status: 500 }
      )
    }

    return NextResponse.json(response.data)
  } catch (error) {
    console.error("[v0] Error in viewing-info API:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
