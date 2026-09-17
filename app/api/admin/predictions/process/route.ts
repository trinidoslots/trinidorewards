export async function POST() {
  return Response.json({ error: "Prediction resolution is managed by the live KPI results." }, { status: 410 })
}
