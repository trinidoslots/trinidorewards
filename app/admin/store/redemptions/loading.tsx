export default function Loading() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-[#0B0B0D]">
      <div className="text-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-[#5B8DEF] border-r-transparent"></div>
        <p className="mt-4 text-white/40">Loading redemptions...</p>
      </div>
    </div>
  )
}
