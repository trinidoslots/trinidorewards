async function refreshStatus() {
  const statusEl = document.getElementById("status")
  statusEl.textContent = "Checking\u2026"
  statusEl.className = "status"

  try {
    const res = await fetch(`${CONFIG.BASE_URL}/api/extension/add-bonus`, {
      headers: { Authorization: `Bearer ${CONFIG.API_KEY}` },
    })
    const data = await res.json().catch(() => ({}))

    if (!res.ok) {
      statusEl.textContent = data.error || `Error (${res.status})`
      statusEl.className = "status error"
      return
    }

    if (data.hunt) {
      statusEl.textContent = `Active: ${data.hunt.streamer}${data.hunt.title ? " \u2014 " + data.hunt.title : ""}`
      statusEl.className = "status active"
    } else {
      statusEl.textContent = "No active hunt"
      statusEl.className = "status inactive"
    }
  } catch (err) {
    statusEl.textContent = "Network error"
    statusEl.className = "status error"
  }
}

document.getElementById("refresh").addEventListener("click", refreshStatus)
refreshStatus()
