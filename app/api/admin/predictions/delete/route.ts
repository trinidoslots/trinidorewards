import { createClient } from "@/lib/supabase/server"
import { createClient as createSupabaseClient } from "@supabase/supabase-js"

function createServiceClient() {
  return createSupabaseClient(process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.HUNT_SUPABASE_SERVICE_ROLE_KEY!)
}

export async function DELETE(request: Request) {
  const supabase = await createClient()
  const serviceSupabase = createServiceClient()
  const { searchParams } = new URL(request.url)
  const id = searchParams.get("id")

  if (!id) {
    return Response.json({ error: "Prediction ID is required" }, { status: 400 })
  }

  try {
    // Delete the prediction using server client (has service role permissions)
    const { error } = await serviceSupabase
      .from("hunt_predictions")
      .delete()
      .eq("id", id)

    if (error) {
      console.error("[v0] Error deleting prediction:", error)
      return Response.json({ error: error.message || "Failed to delete prediction" }, { status: 500 })
    }

    return Response.json({ success: true, id })
  } catch (error) {
    console.error("[v0] Error deleting prediction:", error)
    return Response.json({ error: "Internal server error" }, { status: 500 })
  }
}
