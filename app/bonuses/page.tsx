import { createServerClient } from "@/lib/supabase/server"
import { PageTransition } from "@/components/page-transition"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Gift, ExternalLink, Star, AlertCircle } from "lucide-react"
import Link from "next/link"

interface Bonus {
  id: string
  title: string
  description: string | null
  code: string | null
  terms: string | null
  value: string | null
  casino_name: string | null
  casino_url: string | null
  image_url: string | null
  is_active: boolean
  featured: boolean
  created_at: string
}

async function fetchBonuses() {
  const supabase = await createServerClient()

  const { data, error } = await supabase
    .from("bonuses")
    .select("*")
    .eq("is_active", true)
    .order("featured", { ascending: false })
    .order("created_at", { ascending: false })

  if (error) {
    console.error("[v0] Error fetching bonuses:", error)
    if (error.code === "PGRST205" || error.code === "PGRST204" || error.code === "42703") {
      throw new Error("TABLE_NOT_FOUND")
    }
    return []
  }

  return data as Bonus[]
}

export default async function BonusesPage() {
  let bonuses: Bonus[] = []
  let tableNotFound = false

  try {
    bonuses = await fetchBonuses()
  } catch (error) {
    if (error instanceof Error && error.message === "TABLE_NOT_FOUND") {
      tableNotFound = true
    }
  }

  if (tableNotFound) {
    return (
      <PageTransition>
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6">
          <div className="max-w-3xl mx-auto">
            <Card className="bg-slate-900/60 backdrop-blur border-slate-700/50 p-8">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                  <AlertCircle className="w-6 h-6 text-amber-400" />
                </div>
                <div className="flex-1">
                  <h2 className="text-white text-xl font-bold mb-2">Database Setup Required</h2>
                  <p className="text-slate-300 mb-4">
                    The bonuses table hasn't been created yet. Please run the database setup script to enable the
                    bonuses feature.
                  </p>
                  <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 mb-4">
                    <p className="text-slate-400 text-sm mb-2">Run this script in your Supabase SQL editor:</p>
                    <code className="text-cyan-400 text-sm font-mono">scripts/017_create_bonuses.sql</code>
                  </div>
                  <Link href="/admin/bonuses">
                    <Button className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white">
                      Go to Admin Panel
                    </Button>
                  </Link>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </PageTransition>
    )
  }

  return (
    <PageTransition>
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
                <Gift className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white">Exclusive Bonuses</h1>
                <p className="text-slate-400 text-sm">Claim your rewards and start winning</p>
              </div>
            </div>
          </div>

          {/* Bonuses Grid */}
          {bonuses.length === 0 ? (
            <Card className="bg-slate-900/60 backdrop-blur border-slate-700/50 p-12">
              <div className="text-center">
                <Gift className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                <h3 className="text-white text-lg font-medium mb-2">No Bonuses Available</h3>
                <p className="text-slate-400 text-sm">Check back soon for exclusive bonus offers!</p>
              </div>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {bonuses.map((bonus) => (
                <Card
                  key={bonus.id}
                  className="bg-slate-900/60 backdrop-blur border-slate-700/50 p-4 hover:border-cyan-500/50 transition-all duration-200"
                >
                  {/* Featured Badge */}
                  {bonus.featured && (
                    <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 mb-3">
                      <Star className="w-3 h-3 mr-1" />
                      Featured
                    </Badge>
                  )}

                  {/* Casino Name */}
                  {bonus.casino_name && <h3 className="text-white font-bold text-lg mb-2">{bonus.casino_name}</h3>}

                  {/* Title */}
                  <h4 className="text-cyan-400 font-semibold text-base mb-2">{bonus.title}</h4>

                  {/* Value */}
                  {bonus.value && (
                    <div className="bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/30 rounded-lg p-3 mb-3">
                      <p className="text-amber-400 font-bold text-xl text-center">{bonus.value}</p>
                    </div>
                  )}

                  {/* Description */}
                  {bonus.description && <p className="text-slate-300 text-sm mb-3 line-clamp-3">{bonus.description}</p>}

                  {/* Bonus Code */}
                  {bonus.code && (
                    <div className="bg-slate-800/50 border border-slate-700 rounded p-2 mb-3">
                      <p className="text-slate-400 text-xs mb-1">Bonus Code:</p>
                      <p className="text-white font-mono font-bold text-sm">{bonus.code}</p>
                    </div>
                  )}

                  {/* Terms */}
                  {bonus.terms && <p className="text-slate-500 text-xs mb-4 line-clamp-2">{bonus.terms}</p>}

                  {/* Claim Button */}
                  {bonus.casino_url && (
                    <a href={bonus.casino_url} target="_blank" rel="noopener noreferrer">
                      <Button className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white">
                        Claim Bonus
                        <ExternalLink className="w-4 h-4 ml-2" />
                      </Button>
                    </a>
                  )}
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </PageTransition>
  )
}
