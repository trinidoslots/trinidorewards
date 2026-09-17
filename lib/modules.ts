import { createClient } from "@/lib/supabase/server"

const MODULE_CACHE = new Map<string, { enabled: boolean; timestamp: number }>()
const CACHE_TTL = 60000 // 1 minute

export async function isModuleEnabled(moduleName: string): Promise<boolean> {
  // Check cache first
  const cached = MODULE_CACHE.get(moduleName)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.enabled
  }

  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('modules')
      .select('is_enabled')
      .eq('module_name', moduleName)
      .maybeSingle()

    if (error) {
      console.error(`[v0] Error checking module ${moduleName}:`, error)
      return true // Default to enabled if error
    }

    const enabled = data?.is_enabled ?? true
    MODULE_CACHE.set(moduleName, { enabled, timestamp: Date.now() })
    return enabled
  } catch (error) {
    console.error(`[v0] Error checking module ${moduleName}:`, error)
    return true // Default to enabled if error
  }
}

export function clearModuleCache() {
  MODULE_CACHE.clear()
}
