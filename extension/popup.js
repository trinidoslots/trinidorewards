function formatMoney(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return null
  const num = Number(value)
  return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[c])
}

function renderBonuses(bonuses) {
  const listEl = document.getElementById("bonus-list")
  const summaryEl = document.getElementById("summary")
  listEl.innerHTML = ""

  if (!bonuses || bonuses.length === 0) {
    summaryEl.style.display = "none"
    listEl.innerHTML = '<div class="empty-list">No bonuses added yet</div>'
    return
  }

  const sorted = [...bonuses].sort((a, b) => {
    const ao = a.order ?? Number.MAX_SAFE_INTEGER
    const bo = b.order ?? Number.MAX_SAFE_INTEGER
    return ao - bo
  })

  let totalBet = 0
  let totalWin = 0
  let hasAnyWin = false

  sorted.forEach((bonus) => {
    const hasBet = bonus.betSize !== null && bonus.betSize !== undefined && !Number.isNaN(Number(bonus.betSize))
    const hasPayout = bonus.payout !== null && bonus.payout !== undefined && !Number.isNaN(Number(bonus.payout))

    if (hasBet) totalBet += Number(bonus.betSize)
    if (hasPayout) {
      totalWin += Number(bonus.payout)
      hasAnyWin = true
    }

    const item = document.createElement("div")
    item.className = "bonus-item"

    const metaParts = []
    if (bonus.provider) metaParts.push(escapeHtml(bonus.provider))
    if (hasBet) metaParts.push(`Bet ${formatMoney(bonus.betSize)}`)

    const payoutHtml = hasPayout
      ? `<div class="payout won">${formatMoney(bonus.payout)}</div>`
      : `<div class="payout pending">Pending</div>`

    const badgeHtml = bonus.isSuper
      ? `<span class="badge super">&#128081; Super</span>`
      : bonus.badgeLabel
        ? `<span class="badge">${escapeHtml(bonus.badgeLabel)}</span>`
        : ""

    const thumbHtml = bonus.imageUrl
      ? `<img class="thumb" src="${escapeHtml(bonus.imageUrl)}" alt="" />`
      : `<div class="thumb thumb-placeholder"></div>`

    item.innerHTML = `
      ${thumbHtml}
      <div class="info">
        <div class="name">${escapeHtml(bonus.slotName || "Unknown slot")}${badgeHtml}</div>
        <div class="meta">${metaParts.join(" · ")}</div>
      </div>
      ${payoutHtml}
      ${bonus.id !== null && bonus.id !== undefined ? '<button class="del" title="Remove bonus" data-id="' + escapeHtml(bonus.id) + '">&times;</button>' : ""}
    `

    listEl.appendChild(item)
  })

  const deleteButtons = listEl.querySelectorAll(".del")
  deleteButtons.forEach((btn) => {
    btn.addEventListener("click", async () => {
      btn.disabled = true
      const bonusId = btn.getAttribute("data-id")
      await chrome.runtime.sendMessage({ action: "deleteBonus", data: { bonusId } })
      refreshStatus()
    })
  })

  document.getElementById("summary-count").textContent = String(sorted.length)
  document.getElementById("summary-bet").textContent = totalBet > 0 ? formatMoney(totalBet) : "-"
  document.getElementById("summary-win").textContent = hasAnyWin ? formatMoney(totalWin) : "-"
  summaryEl.style.display = "flex"
}

async function refreshStatus() {
  const statusEl = document.getElementById("status")
  const summaryEl = document.getElementById("summary")
  const listEl = document.getElementById("bonus-list")

  statusEl.textContent = "Checking\u2026"
  statusEl.className = "status"

  try {
    const response = await chrome.runtime.sendMessage({ action: "getHuntStatus" })

    if (!response || !response.success) {
      statusEl.textContent = (response && response.error) || "Error fetching status"
      statusEl.className = "status error"
      summaryEl.style.display = "none"
      listEl.innerHTML = ""
      return
    }

    if (response.huntId) {
      statusEl.textContent = `Active: ${response.streamer || "Unknown"}${response.title ? " \u2014 " + response.title : ""}`
      statusEl.className = "status active"
      renderBonuses(response.bonuses)
    } else {
      statusEl.textContent = "No active hunt"
      statusEl.className = "status inactive"
      summaryEl.style.display = "none"
      listEl.innerHTML = ""
    }
  } catch (err) {
    statusEl.textContent = "Network error"
    statusEl.className = "status error"
    summaryEl.style.display = "none"
    listEl.innerHTML = ""
  }
}

document.getElementById("refresh").addEventListener("click", refreshStatus)
refreshStatus()
