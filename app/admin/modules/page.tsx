"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Card } from "@/components/ui/card"

type Module = {
  id: string
  module_name: string
  display_name: string
  description?: string
  category: string
  is_enabled: boolean
  created_at?: string
  updated_at?: string
}

export default function ModulesPage() {
  const [modules, setModules] = useState<Module[]>([])
  const [loading, setLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const supabase = createClient()
  const { toast } = useToast()

  const categories = [
    { key: 'main', label: 'Main Features' },
    { key: 'bonus_hunt', label: 'Bonus Hunt' },
  ]

  useEffect(() => {
    loadModules()
  }, [])

  async function loadModules() {
    try {
      const { data, error } = await supabase
        .from('modules')
        .select('id, module_name, display_name, description, category, is_enabled, created_at, updated_at')
        .order('category, module_name')

      if (error) throw error
      setModules(data || [])
    } catch (error) {
      console.error('[v0] Error loading modules:', error)
      toast({
        title: 'Error',
        description: 'Failed to load modules',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  async function toggleModule(moduleId: string, is_enabled: boolean) {
    try {
      const { error } = await supabase
        .from('modules')
        .update({ is_enabled, updated_at: new Date().toISOString() })
        .eq('id', moduleId)

      if (error) throw error

      setModules(modules.map(m => (m.id === moduleId ? { ...m, is_enabled } : m)))
      
      const moduleName = modules.find(m => m.id === moduleId)?.display_name || 'Module'
      toast({
        title: 'Success',
        description: `${moduleName} ${is_enabled ? 'enabled' : 'disabled'}`,
      })
    } catch (error) {
      console.error('[v0] Error toggling module:', error)
      toast({
        title: 'Error',
        description: 'Failed to update module',
        variant: 'destructive',
      })
    }
  }

  const groupedModules = categories.map(cat => ({
    ...cat,
    modules: modules.filter(m => m.category === cat.key),
  }))

  if (loading) {
    return <div className="p-8 text-center text-white/40">Loading modules...</div>
  }

  return (
    <div className="flex-1 p-8">
      <div className="max-w-4xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Feature Modules</h1>
          <p className="text-white/40">Enable or disable features across the platform</p>
        </div>

        <div className="space-y-8">
          {groupedModules.map(category => (
            <div key={category.key}>
              <h2 className="text-lg font-semibold text-white/80 mb-4">{category.label}</h2>
              
              {category.modules.length === 0 ? (
                <p className="text-white/30 text-sm">No modules in this category</p>
              ) : (
                <div className="grid gap-3">
                  {category.modules.map(module => (
                    <Card
                      key={module.id}
                      className="p-4 bg-[#101014] border-white/[0.06] hover:border-white/[0.10] transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <h3 className="font-medium text-white">{module.display_name}</h3>
                          <p className="text-sm text-white/40 mt-1">{module.description}</p>
                        </div>
                        <Switch
                          checked={module.is_enabled}
                          onCheckedChange={checked => toggleModule(module.id, checked)}
                          className="ml-4"
                        />
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
