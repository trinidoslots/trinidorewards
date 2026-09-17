"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Trash2, Plus } from "lucide-react"
import { createBrowserClient } from "@/lib/supabase/client"

interface Timer {
  id: string
  message: string
  end_time: string
  active: boolean
  boldIcon?: boolean
  boldMessage?: boolean
  boldTime?: boolean
  data_url?: string
}

interface WalletRecord {
  id: string
  deposit_amount: number
  withdraw_amount: number
  created_at: string
}

interface SpotifyConfig {
  clientId: string
  clientSecret: string
  refreshToken: string
}

interface WordStyle {
  index: number
  bold?: boolean
  italic?: boolean
  underline?: boolean
}

interface Info {
  id: string
  message: string
  active: boolean
  word_styles?: WordStyle[]
  data_url?: string
}

export default function ObsWidgetSettings() {
  const [timers, setTimers] = useState<Timer[]>([])
  const [newMessage, setNewMessage] = useState("")
  const [newEndTime, setNewEndTime] = useState("")
  const [saving, setSaving] = useState(false)
  const [boldSettings, setBoldSettings] = useState({
    icon: true,
    message: false,
    time: true,
  })

  const [walletRecords, setWalletRecords] = useState<WalletRecord[]>([])
  const [newDeposit, setNewDeposit] = useState("")
  const [newWithdraw, setNewWithdraw] = useState("")
  const [loadingWallet, setLoadingWallet] = useState(false)

  const [spotifyConfig, setSpotifyConfig] = useState<SpotifyConfig>({
    clientId: "",
    clientSecret: "",
    refreshToken: "",
  })
  const [spotifySaving, setSpotifySaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editMessage, setEditMessage] = useState("")
  const [editEndTime, setEditEndTime] = useState("")
  const [editTimerDataUrl, setEditTimerDataUrl] = useState("")
  const [newTimerDataUrl, setNewTimerDataUrl] = useState("")

  const [infos, setInfos] = useState<Info[]>([])
  const [newInfo, setNewInfo] = useState("")
  const [newInfoDataUrl, setNewInfoDataUrl] = useState("")
  const [savingInfo, setSavingInfo] = useState(false)
  const [selectedWords, setSelectedWords] = useState<number[]>([])
  const [wordStyles, setWordStyles] = useState({
    bold: false,
    italic: false,
    underline: false,
  })
  const [editingInfoId, setEditingInfoId] = useState<string | null>(null)
  const [editInfoMessage, setEditInfoMessage] = useState("")
  const [editInfoDataUrl, setEditInfoDataUrl] = useState("")
  const [editSelectedWords, setEditSelectedWords] = useState<number[]>([])
  const [editWordStyles, setEditWordStyles] = useState({
    bold: false,
    italic: false,
    underline: false,
  })

  const supabase = createBrowserClient()

  useEffect(() => {
    loadTimers()
    loadWalletRecords()
    loadSpotifyConfig()
    loadInfoItems()
  }, [])

  function loadTimers() {
    loadTimersFromDatabase()
  }

  async function loadTimersFromDatabase() {
    try {
      const { data, error } = await supabase
        .from("obs_timers")
        .select("*")
        .order("created_at", { ascending: false })

      if (!error && data) {
        setTimers(data as Timer[])
      }
    } catch (error) {
      console.error("Error loading timers from database:", error)
    }
  }

  async function loadWalletRecords() {
    try {
      setLoadingWallet(true)
      const { data, error } = await supabase
        .from("deposits_withdrawals")
        .select("*")
        .order("created_at", { ascending: false })

      if (!error && data) {
        setWalletRecords(data)
      }
    } catch (error) {
      console.error("Error loading wallet records:", error)
    } finally {
      setLoadingWallet(false)
    }
  }

  async function addWalletRecord() {
    if (!newDeposit && !newWithdraw) {
      alert("Enter either a deposit or withdrawal amount")
      return
    }

    try {
      setLoadingWallet(true)
      const deposit = newDeposit ? parseFloat(newDeposit) : 0
      const withdraw = newWithdraw ? parseFloat(newWithdraw) : 0

      const { data, error } = await supabase
        .from("deposits_withdrawals")
        .insert([{ deposit_amount: deposit, withdraw_amount: withdraw }])
        .select()

      if (!error && data) {
        setWalletRecords([data[0], ...walletRecords])
        setNewDeposit("")
        setNewWithdraw("")
      }
    } catch (error) {
      console.error("Error adding wallet record:", error)
      alert("Failed to add wallet record")
    } finally {
      setLoadingWallet(false)
    }
  }

  async function deleteWalletRecord(id: string) {
    try {
      setLoadingWallet(true)
      const { error } = await supabase
        .from("deposits_withdrawals")
        .delete()
        .eq("id", id)

      if (!error) {
        setWalletRecords(walletRecords.filter((r) => r.id !== id))
      }
    } catch (error) {
      console.error("Error deleting wallet record:", error)
      alert("Failed to delete wallet record")
    } finally {
      setLoadingWallet(false)
    }
  }

  function loadSpotifyConfig() {
    const stored = localStorage.getItem("spotifyConfig")
    if (stored) {
      try {
        setSpotifyConfig(JSON.parse(stored))
      } catch (error) {
        console.error("Error parsing Spotify config:", error)
      }
    }
  }

  function saveSpotifyConfig() {
    try {
      setSpotifySaving(true)
      localStorage.setItem("spotifyConfig", JSON.stringify(spotifyConfig))
      alert("Spotify configuration saved successfully!")
    } catch (error) {
      console.error("Error saving Spotify config:", error)
      alert("Failed to save Spotify configuration")
    } finally {
      setSpotifySaving(false)
    }
  }

  async function saveTimers(updatedTimers: Timer[]) {
    try {
      setTimers(updatedTimers)
    } catch (error) {
      console.error("Error saving timers:", error)
    }
  }

  async function addTimer() {
    if (!newMessage.trim()) {
      alert("Enter a timer message")
      return
    }
    if (!newEndTime) {
      alert("Select an end time for the timer")
      return
    }

    try {
      setSaving(true)
      // Use snake_case for database columns
      const timerData = {
        id: Date.now().toString(),
        message: newMessage,
        end_time: newEndTime,
        active: true,
        bold_icon: boldSettings.icon,
        bold_message: boldSettings.message,
        bold_time: boldSettings.time,
        data_url: newTimerDataUrl || null,
      }

      console.log("[v0] Creating timer:", timerData)
      const { data, error } = await supabase
        .from("obs_timers")
        .insert([timerData])
        .select()

      console.log("[v0] Timer insert response - Data:", data, "Error:", error)

      if (!error && data) {
        // Convert snake_case back to camelCase for state
        const newTimer: Timer = {
          id: data[0].id,
          message: data[0].message,
          end_time: data[0].end_time,
          active: data[0].active,
          boldIcon: data[0].bold_icon,
          boldMessage: data[0].bold_message,
          boldTime: data[0].bold_time,
          data_url: data[0].data_url,
        }
        setTimers([newTimer, ...timers])
        setNewMessage("")
        setNewEndTime("")
        setNewTimerDataUrl("")
        alert("Timer added successfully!")
      } else {
        alert(`Failed to add timer: ${error?.message}`)
      }
    } catch (error) {
      console.error("Error adding timer:", error)
      alert(`Error adding timer: ${error}`)
    } finally {
      setSaving(false)
    }
  }

  async function removeTimer(id: string) {
    try {
      const { error } = await supabase
        .from("obs_timers")
        .delete()
        .eq("id", id)

      if (!error) {
        const updated = timers.filter((t) => t.id !== id)
        setTimers(updated)
      }
    } catch (error) {
      console.error("Error removing timer:", error)
      alert("Failed to remove timer")
    }
  }

  async function toggleTimer(id: string) {
    try {
      const timer = timers.find((t) => t.id === id)
      if (!timer) return

      const { error } = await supabase
        .from("obs_timers")
        .update({ active: !timer.active })
        .eq("id", id)

      if (!error) {
        const updated = timers.map((t) => (t.id === id ? { ...t, active: !t.active } : t))
        setTimers(updated)
      }
    } catch (error) {
      console.error("Error toggling timer:", error)
      alert("Failed to toggle timer")
    }
  }

  async function startTimer(id: string) {
    try {
      const timer = timers.find((t) => t.id === id)
      if (!timer) return

      const { error } = await supabase
        .from("obs_timers")
        .update({ started: true })
        .eq("id", id)

      if (!error) {
        const updated = timers.map((t) => (t.id === id ? { ...t, started: true } : t))
        setTimers(updated)
      }
    } catch (error) {
      console.error("Error starting timer:", error)
      alert("Failed to start timer")
    }
  }

  async function stopTimer(id: string) {
    try {
      const timer = timers.find((t) => t.id === id)
      if (!timer) return

      const { error } = await supabase
        .from("obs_timers")
        .update({ started: false })
        .eq("id", id)

      if (!error) {
        const updated = timers.map((t) => (t.id === id ? { ...t, started: false } : t))
        setTimers(updated)
      }
    } catch (error) {
      console.error("Error stopping timer:", error)
      alert("Failed to stop timer")
    }
  }

  async function editTimer(id: string, newMessage: string, newEndTime: string) {
    try {
      const { error } = await supabase
        .from("obs_timers")
        .update({ message: newMessage, end_time: newEndTime })
        .eq("id", id)

      if (!error) {
        const updated = timers.map((t) =>
          t.id === id ? { ...t, message: newMessage, end_time: newEndTime } : t
        )
        setTimers(updated)
      }
    } catch (error) {
      console.error("Error editing timer:", error)
      alert("Failed to edit timer")
    }
  }

  async function loadInfoItems() {
    try {
      const { data, error } = await supabase
        .from("obs_info")
        .select("*")
        .order("created_at", { ascending: false })

      if (!error && data) {
        setInfos(data as Info[])
      }
    } catch (error) {
      console.error("Error loading info items:", error)
    }
  }

  async function addInfoItem() {
    if (!newInfo.trim()) {
      alert("Enter info text")
      return
    }

    try {
      setSavingInfo(true)
      
      // Build word_styles array from selected words
      const stylesArray: WordStyle[] = selectedWords
        .map((wordIdx) => ({
          index: wordIdx,
          bold: wordStyles.bold,
          italic: wordStyles.italic,
          underline: wordStyles.underline,
        }))
        .filter((s) => s.bold || s.italic || s.underline)
      
      const infoData = {
        id: Date.now().toString(),
        message: newInfo,
        active: true,
        word_styles: stylesArray.length > 0 ? stylesArray : null,
        data_url: newInfoDataUrl || null,
      }

      console.log("[v0] Inserting info item:", infoData)
      const { data, error } = await supabase
        .from("obs_info")
        .insert([infoData])

      console.log("[v0] Insert response - Data:", data, "Error:", error)
      if (!error) {
        setInfos([infoData as Info, ...infos])
        setNewInfo("")
        setNewInfoDataUrl("")
        setSelectedWords([])
        setWordStyles({ bold: false, italic: false, underline: false })
      } else {
        console.error("[v0] Insert error details:", error)
        alert("Failed to add info item: " + error.message)
      }
    } catch (error) {
      console.error("Error adding info item:", error)
      alert("Error adding info item")
    } finally {
      setSavingInfo(false)
    }
  }

  async function removeInfoItem(id: string) {
    try {
      const { error } = await supabase
        .from("obs_info")
        .delete()
        .eq("id", id)

      if (!error) {
        const updated = infos.filter((i) => i.id !== id)
        setInfos(updated)
      }
    } catch (error) {
      console.error("Error removing info item:", error)
      alert("Failed to remove info item")
    }
  }

  async function updateInfoItem(id: string) {
    try {
      const editStylesArray: WordStyle[] = editSelectedWords
        .map((wordIdx) => ({
          index: wordIdx,
          bold: editWordStyles.bold,
          italic: editWordStyles.italic,
          underline: editWordStyles.underline,
        }))
        .filter((s) => s.bold || s.italic || s.underline)

      const { error } = await supabase
        .from("obs_info")
        .update({
          message: editInfoMessage,
          data_url: editInfoDataUrl || null,
          word_styles: editStylesArray.length > 0 ? editStylesArray : null,
        })
        .eq("id", id)

      if (!error) {
        const updated = infos.map((i) =>
          i.id === id
            ? {
                ...i,
                message: editInfoMessage,
                data_url: editInfoDataUrl,
                word_styles: editStylesArray,
              }
            : i
        )
        setInfos(updated)
        setEditingInfoId(null)
      } else {
        alert("Failed to update info item")
      }
    } catch (error) {
      console.error("Error updating info item:", error)
      alert("Failed to update info item")
    }
  }

  function startEditingInfo(info: Info) {
    setEditingInfoId(info.id)
    setEditInfoMessage(info.message)
    setEditInfoDataUrl(info.data_url || "")
    setEditSelectedWords([])
    setEditWordStyles({ bold: false, italic: false, underline: false })
  }

  async function toggleInfoActive(id: string) {
    try {
      const info = infos.find((i) => i.id === id)
      if (!info) return

      const { error } = await supabase
        .from("obs_info")
        .update({ active: !info.active })
        .eq("id", id)

      if (!error) {
        const updated = infos.map((i) => (i.id === id ? { ...i, active: !i.active } : i))
        setInfos(updated)
      }
    } catch (error) {
      console.error("Error toggling info item:", error)
      alert("Failed to toggle info item")
    }
  }

  function formatTime(seconds: number) {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${String(secs).padStart(2, "0")}`
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 to-slate-900 p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-8">OBS Widget Settings</h1>

        {/* Add Timer Form */}
        <Card className="bg-slate-800/50 border-slate-700 mb-8">
          <CardHeader>
            <CardTitle className="text-white">Add Timer</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Timer Message</label>
              <Input
                placeholder="e.g., Stream Raid, Daily Bonus"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                className="bg-slate-700/50 border-slate-600 text-white placeholder-slate-400"
                onKeyPress={(e) => e.key === "Enter" && addTimer()}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">End Time</label>
              <div className="flex gap-2">
                <Input
                  type="datetime-local"
                  value={newEndTime}
                  onChange={(e) => setNewEndTime(e.target.value)}
                  className="bg-slate-700/50 border-slate-600 text-white flex-1"
                />
                <Button
                  onClick={addTimer}
                  className="bg-cyan-600 hover:bg-cyan-700 text-white whitespace-nowrap"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Timer
                </Button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Data URL (emoji/icon image)</label>
              <Input
                placeholder="Paste data URL with emoji image (e.g., data:image/png;base64,...)"
                value={newTimerDataUrl}
                onChange={(e) => setNewTimerDataUrl(e.target.value)}
                className="bg-slate-700/50 border-slate-600 text-white placeholder-slate-400 text-sm"
              />
            </div>

            <div className="border-t border-slate-700 pt-4">
              <label className="block text-sm font-medium text-slate-300 mb-3">Bold Elements</label>
              <div className="space-y-2">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={boldSettings.icon}
                    onChange={(e) => setBoldSettings({ ...boldSettings, icon: e.target.checked })}
                    className="w-4 h-4 accent-cyan-600"
                  />
                  <span className="text-sm text-slate-300">Bold Timer Icon (⏱)</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={boldSettings.message}
                    onChange={(e) => setBoldSettings({ ...boldSettings, message: e.target.checked })}
                    className="w-4 h-4 accent-cyan-600"
                  />
                  <span className="text-sm text-slate-300">Bold Message</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={boldSettings.time}
                    onChange={(e) => setBoldSettings({ ...boldSettings, time: e.target.checked })}
                    className="w-4 h-4 accent-cyan-600"
                  />
                  <span className="text-sm text-slate-300">Bold Countdown Time</span>
                </label>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Active Timers */}
        {timers.length > 0 ? (
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white">Active Timers ({timers.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {timers.map((timer) => (
                  <div key={timer.id}>
                    {editingId === timer.id ? (
                      <div className="p-3 bg-slate-700/50 rounded-lg border border-slate-600/50 space-y-3">
                        <div>
                          <label className="block text-xs font-medium text-slate-300 mb-1">Message</label>
                          <Input
                            value={editMessage}
                            onChange={(e) => setEditMessage(e.target.value)}
                            className="bg-slate-700 border-slate-600 text-white text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-300 mb-1">End Time</label>
                          <Input
                            type="datetime-local"
                            value={editEndTime}
                            onChange={(e) => setEditEndTime(e.target.value)}
                            className="bg-slate-700 border-slate-600 text-white text-sm"
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button
                            onClick={() => {
                              editTimer(timer.id, editMessage, editEndTime)
                              setEditingId(null)
                            }}
                            size="sm"
                            className="bg-cyan-600 hover:bg-cyan-700 text-white flex-1"
                          >
                            Save
                          </Button>
                          <Button
                            onClick={() => setEditingId(null)}
                            size="sm"
                            variant="outline"
                            className="border-slate-600 text-slate-400"
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg border border-slate-600/50">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={timer.active}
                              onChange={() => toggleTimer(timer.id)}
                              className="w-4 h-4 accent-cyan-600"
                            />
                            <span className="text-white font-medium">{timer.message}</span>
                            <span className="text-xs text-slate-400">
                              {new Date(timer.end_time) > new Date() ? "● Active" : "● Expired"}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={`text-xs ${timer.active ? "text-green-400" : "text-slate-400"}`}>
                              {timer.active ? "Enabled" : "Disabled"}
                            </span>
                            <span className="text-xs text-slate-400">
                              Ends: {new Date(timer.end_time).toLocaleString()}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            onClick={() => {
                              setEditingId(timer.id)
                              setEditMessage(timer.message)
                              setEditEndTime(timer.end_time)
                            }}
                            size="sm"
                            variant="outline"
                            className="border-slate-600 hover:bg-slate-600/50 text-slate-300"
                          >
                            Edit
                          </Button>
                          <Button
                            onClick={() => removeTimer(timer.id)}
                            variant="outline"
                            size="sm"
                            className="border-red-700/50 hover:bg-red-900/20 text-red-400"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="py-8">
              <p className="text-center text-slate-400">No timers configured. Add one to get started!</p>
            </CardContent>
          </Card>
        )}

        {/* Info */}
        <div className="mt-8 p-4 bg-slate-800/30 border border-slate-700/50 rounded-lg">
          <p className="text-sm text-slate-400">
            <strong>Info:</strong> Timers added here will automatically appear on the OBS widget bar at{" "}
            <code className="bg-slate-900 px-2 py-1 rounded text-cyan-400">/obs-widget</code>
          </p>
        </div>

        {/* Deposits & Withdrawals Section */}
        <div className="mt-12 pt-8 border-t border-slate-700">
          <h2 className="text-2xl font-bold text-white mb-6">Info Settings</h2>

          {/* Add Info Form */}
          <Card className="bg-slate-800/50 border-slate-700 mb-8">
            <CardHeader>
              <CardTitle className="text-white">Add Info Item</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Info Text</label>
                <div className="flex gap-2 mb-3">
                  <Input
                    placeholder="e.g., Raid incoming!, Special event live"
                    value={newInfo}
                    onChange={(e) => setNewInfo(e.target.value)}
                    className="bg-slate-700/50 border-slate-600 text-white placeholder-slate-400"
                    onKeyPress={(e) => e.key === "Enter" && addInfoItem()}
                  />
                  <Button
                    onClick={addInfoItem}
                    disabled={savingInfo}
                    className="bg-cyan-600 hover:bg-cyan-700 text-white whitespace-nowrap"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Info
                  </Button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Data URL (emoji/icon image)</label>
                <Input
                  placeholder="Paste data URL with emoji image (e.g., data:image/png;base64,...)"
                  value={newInfoDataUrl}
                  onChange={(e) => setNewInfoDataUrl(e.target.value)}
                  className="bg-slate-700/50 border-slate-600 text-white placeholder-slate-400 text-sm"
                />
              </div>
              {newInfo && (
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Select Words to Format</label>
                  <div className="bg-slate-700/30 p-3 rounded-lg mb-3 flex flex-wrap gap-2">
                    {newInfo.split(" ").map((word, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          setSelectedWords(
                            selectedWords.includes(idx)
                              ? selectedWords.filter((i) => i !== idx)
                              : [...selectedWords, idx]
                          )
                        }}
                        className={`px-3 py-1 rounded transition-colors ${
                          selectedWords.includes(idx)
                            ? "bg-cyan-600 text-white"
                            : "bg-slate-600 text-slate-300 hover:bg-slate-500"
                        }`}
                      >
                        {word}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Apply Formatting {selectedWords.length > 0 && `(${selectedWords.length} word${selectedWords.length !== 1 ? "s" : ""} selected)`}
                </label>
                <div className="flex gap-2">
                  <Button
                    onClick={() => setWordStyles({ ...wordStyles, bold: !wordStyles.bold })}
                    className={`px-3 py-2 rounded font-bold ${
                      wordStyles.bold
                        ? "bg-cyan-600 text-white"
                        : "bg-slate-700/50 text-slate-300 border border-slate-600"
                    }`}
                  >
                    B
                  </Button>
                  <Button
                    onClick={() => setWordStyles({ ...wordStyles, italic: !wordStyles.italic })}
                    className={`px-3 py-2 rounded italic ${
                      wordStyles.italic
                        ? "bg-cyan-600 text-white"
                        : "bg-slate-700/50 text-slate-300 border border-slate-600"
                    }`}
                  >
                    I
                  </Button>
                  <Button
                    onClick={() => setWordStyles({ ...wordStyles, underline: !wordStyles.underline })}
                    className={`px-3 py-2 rounded underline ${
                      wordStyles.underline
                        ? "bg-cyan-600 text-white"
                        : "bg-slate-700/50 text-slate-300 border border-slate-600"
                    }`}
                  >
                    U
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Active Info Items */}
          {infos.length > 0 ? (
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white">Info Items ({infos.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {infos.map((info) => (
                    <div key={info.id}>
                      {editingInfoId === info.id ? (
                        <div className="p-3 bg-slate-700/50 rounded-lg border border-slate-600/50 space-y-3">
                          <div>
                            <label className="block text-xs font-medium text-slate-300 mb-1">Message</label>
                            <Input
                              value={editInfoMessage}
                              onChange={(e) => setEditInfoMessage(e.target.value)}
                              className="bg-slate-700 border-slate-600 text-white text-sm"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-300 mb-1">Data URL (emoji/icon)</label>
                            <Input
                              value={editInfoDataUrl}
                              onChange={(e) => setEditInfoDataUrl(e.target.value)}
                              className="bg-slate-700 border-slate-600 text-white text-sm"
                              placeholder="Paste data URL..."
                            />
                          </div>
                          {editInfoMessage && (
                            <div>
                              <label className="block text-xs font-medium text-slate-300 mb-1">Select Words to Format</label>
                              <div className="bg-slate-700/30 p-2 rounded flex flex-wrap gap-1">
                                {editInfoMessage.split(" ").map((word, idx) => (
                                  <button
                                    key={idx}
                                    onClick={() => {
                                      setEditSelectedWords(
                                        editSelectedWords.includes(idx)
                                          ? editSelectedWords.filter((i) => i !== idx)
                                          : [...editSelectedWords, idx]
                                      )
                                    }}
                                    className={`px-2 py-0.5 text-xs rounded transition-colors ${
                                      editSelectedWords.includes(idx)
                                        ? "bg-cyan-600 text-white"
                                        : "bg-slate-600 text-slate-300"
                                    }`}
                                  >
                                    {word}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                          <div className="flex gap-1">
                            <Button
                              onClick={() => setEditWordStyles({ ...editWordStyles, bold: !editWordStyles.bold })}
                              className={`px-2 py-1 text-xs rounded font-bold ${
                                editWordStyles.bold
                                  ? "bg-cyan-600 text-white"
                                  : "bg-slate-600 text-slate-300"
                              }`}
                            >
                              B
                            </Button>
                            <Button
                              onClick={() => setEditWordStyles({ ...editWordStyles, italic: !editWordStyles.italic })}
                              className={`px-2 py-1 text-xs rounded italic ${
                                editWordStyles.italic
                                  ? "bg-cyan-600 text-white"
                                  : "bg-slate-600 text-slate-300"
                              }`}
                            >
                              I
                            </Button>
                            <Button
                              onClick={() => setEditWordStyles({ ...editWordStyles, underline: !editWordStyles.underline })}
                              className={`px-2 py-1 text-xs rounded underline ${
                                editWordStyles.underline
                                  ? "bg-cyan-600 text-white"
                                  : "bg-slate-600 text-slate-300"
                              }`}
                            >
                              U
                            </Button>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              onClick={() => updateInfoItem(info.id)}
                              size="sm"
                              className="bg-cyan-600 hover:bg-cyan-700 text-white flex-1"
                            >
                              Save
                            </Button>
                            <Button
                              onClick={() => setEditingInfoId(null)}
                              size="sm"
                              variant="outline"
                              className="border-slate-600 text-slate-400"
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg border border-slate-600/50">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={info.active}
                                onChange={() => toggleInfoActive(info.id)}
                                className="w-4 h-4 accent-cyan-600"
                              />
                              {info.data_url && (
                                <img src={info.data_url} alt="info icon" className="w-4 h-4" style={{ filter: "brightness(0) saturate(100%) invert(1)" }} />
                              )}
                              <div className="flex flex-wrap items-center gap-1">
                                {info.message.split(" ").map((word, idx) => {
                                  const style = (info.word_styles || []).find((s) => s.index === idx)
                                  return (
                                    <span
                                      key={idx}
                                      className={`text-white text-sm ${style?.bold ? "font-bold" : ""} ${
                                        style?.italic ? "italic" : ""
                                      } ${style?.underline ? "underline" : ""}`}
                                    >
                                      {word}
                                    </span>
                                  )
                                })}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <div className={`text-xs ${info.active ? "text-green-400" : "text-slate-400"}`}>
                                {info.active ? "● Active" : "● Inactive"}
                              </div>
                              {(info.word_styles || []).length > 0 && (
                                <div className="flex gap-1 text-xs">
                                  {(info.word_styles || []).some((s) => s.bold) && (
                                    <span className="bg-slate-600 px-1.5 py-0.5 rounded font-bold text-slate-300">B</span>
                                  )}
                                  {(info.word_styles || []).some((s) => s.italic) && (
                                    <span className="bg-slate-600 px-1.5 py-0.5 rounded italic text-slate-300">I</span>
                                  )}
                                  {(info.word_styles || []).some((s) => s.underline) && (
                                    <span className="bg-slate-600 px-1.5 py-0.5 rounded underline text-slate-300">U</span>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <Button
                              onClick={() => startEditingInfo(info)}
                              size="sm"
                              className="bg-blue-600 hover:bg-blue-700 text-white"
                            >
                              Edit
                            </Button>
                            <Button
                              onClick={() => removeInfoItem(info.id)}
                              variant="outline"
                              size="sm"
                              className="border-red-700/50 hover:bg-red-900/20 text-red-400"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="bg-slate-800/50 border-slate-700">
              <CardContent className="py-8">
                <p className="text-center text-slate-400">No info items configured. Add one to get started!</p>
              </CardContent>
            </Card>
          )}

          {/* Info */}
          <div className="mt-4 p-4 bg-slate-800/30 border border-slate-700/50 rounded-lg">
            <p className="text-sm text-slate-400">
              <strong>Info:</strong> Info items added here will automatically appear on the OBS widget bar at{" "}
              <code className="bg-slate-900 px-2 py-1 rounded text-cyan-400">/obs-widget</code> in the right column next to the timers.
            </p>
          </div>
        </div>

        {/* Spotify Section */}
        <div className="mt-12 pt-8 border-t border-slate-700">
          <h2 className="text-2xl font-bold text-white mb-6">Spotify Configuration</h2>

          {/* Spotify API Setup */}
          <Card className="bg-slate-800/50 border-slate-700 mb-8">
            <CardHeader>
              <CardTitle className="text-white">Spotify API Credentials</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-slate-700/30 border border-slate-600/50 p-4 rounded-lg mb-4">
                <p className="text-sm text-slate-300 mb-2">
                  <strong>How to get your credentials:</strong>
                </p>
                <ol className="text-xs text-slate-400 list-decimal list-inside space-y-1">
                  <li>Go to <a href="https://developer.spotify.com/dashboard" target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline">Spotify Developer Dashboard</a></li>
                  <li>Create a new app and get your Client ID and Client Secret</li>
                  <li>Use the Spotify Authorization flow to generate a Refresh Token</li>
                  <li>Paste them here to enable live track display on the OBS widget</li>
                </ol>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Client ID</label>
                <Input
                  type="password"
                  placeholder="Your Spotify Client ID"
                  value={spotifyConfig.clientId}
                  onChange={(e) => setSpotifyConfig({ ...spotifyConfig, clientId: e.target.value })}
                  className="bg-slate-700/50 border-slate-600 text-white placeholder-slate-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Client Secret</label>
                <Input
                  type="password"
                  placeholder="Your Spotify Client Secret"
                  value={spotifyConfig.clientSecret}
                  onChange={(e) => setSpotifyConfig({ ...spotifyConfig, clientSecret: e.target.value })}
                  className="bg-slate-700/50 border-slate-600 text-white placeholder-slate-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Refresh Token</label>
                <Input
                  type="password"
                  placeholder="Your Spotify Refresh Token"
                  value={spotifyConfig.refreshToken}
                  onChange={(e) => setSpotifyConfig({ ...spotifyConfig, refreshToken: e.target.value })}
                  className="bg-slate-700/50 border-slate-600 text-white placeholder-slate-400"
                />
              </div>
              <Button
                onClick={saveSpotifyConfig}
                disabled={spotifySaving}
                className="w-full bg-cyan-600 hover:bg-cyan-700 text-white"
              >
                Save Spotify Configuration
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Wallet Tracker Section */}
        <div className="mt-12 pt-8 border-t border-slate-700">
          <h2 className="text-2xl font-bold text-white mb-6">Wallet Tracker</h2>

          {/* Add Wallet Record Form */}
          <Card className="bg-slate-800/50 border-slate-700 mb-8">
            <CardHeader>
              <CardTitle className="text-white">Add Deposit / Withdrawal</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Deposit Amount</label>
                  <Input
                    type="number"
                    placeholder="0.00"
                    value={newDeposit}
                    onChange={(e) => setNewDeposit(e.target.value)}
                    className="bg-slate-700/50 border-slate-600 text-white placeholder-slate-400"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Withdrawal Amount</label>
                  <Input
                    type="number"
                    placeholder="0.00"
                    value={newWithdraw}
                    onChange={(e) => setNewWithdraw(e.target.value)}
                    className="bg-slate-700/50 border-slate-600 text-white placeholder-slate-400"
                  />
                </div>
              </div>
              <Button
                onClick={addWalletRecord}
                disabled={loadingWallet}
                className="w-full bg-cyan-600 hover:bg-cyan-700 text-white"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Record
              </Button>
            </CardContent>
          </Card>

          {/* Wallet Records */}
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white">All Records ({walletRecords.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {walletRecords.length > 0 ? (
                <div className="space-y-3 max-h-80 overflow-y-auto">
                  {walletRecords.map((record) => (
                    <div key={record.id} className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg border border-slate-600/50">
                      <div className="flex-1">
                        <div className="flex gap-4 text-sm">
                          {record.deposit_amount > 0 && (
                            <span className="text-green-400">
                              Deposit: <strong>${record.deposit_amount.toFixed(2)}</strong>
                            </span>
                          )}
                          {record.withdraw_amount > 0 && (
                            <span className="text-red-400">
                              Withdraw: <strong>${record.withdraw_amount.toFixed(2)}</strong>
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-slate-400">
                          {new Date(record.created_at).toLocaleString()}
                        </span>
                      </div>
                      <Button
                        onClick={() => deleteWalletRecord(record.id)}
                        disabled={loadingWallet}
                        variant="outline"
                        size="sm"
                        className="border-red-700/50 hover:bg-red-900/20 text-red-400"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-slate-400 py-4">No records yet</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
