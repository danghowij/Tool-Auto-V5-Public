const PC_LIST_URL = "https://tool-auto-v5-root-default-rtdb.asia-southeast1.firebasedatabase.app/list-pc.json";
let pcList = {};
let selectedPc = localStorage.getItem('selected-pc-name') || null;
let refreshInterval = null;
let countdown = 30;
let currentSelectedButton = null;

async function fetchPcList() {
  const res = await fetch(PC_LIST_URL);
  pcList = await res.json();
  const pcSelector = document.getElementById('pcSelector');
  pcSelector.innerHTML = '';

  Object.keys(pcList).forEach(pc => {
    const option = document.createElement('option');
    option.value = pc;
    option.textContent = pc;
    if (selectedPc === pc) option.selected = true;
    pcSelector.appendChild(option);
  });

  if (!pcList[selectedPc]) {
    selectedPc = Object.keys(pcList)[0];
    localStorage.setItem('selected-pc-name', selectedPc);
  }

  pcSelector.onchange = () => {
    selectedPc = pcSelector.value;
    localStorage.setItem('selected-pc-name', selectedPc);
    fetchLatest();
  };

  fetchLatest();
}

async function fetchLatest() {
  if (!selectedPc || !pcList[selectedPc]) return;
  const url = `${pcList[selectedPc]}/${selectedPc}/latest.json`;
  const res = await fetch(url);
  const data = await res.json();

  showOverview(data.overview);
  showMiniapps(data.miniapp);
  showRecentRuns(data.recent_run || []);
  showMetricsChart(data.metrics);
  updateTimeInfo(data.start_time, data.update_time);
}

function showOverview(overview) {
  const block = document.getElementById('overviewBlock');
  block.innerHTML = `
    <p>
      <strong>Total:</strong> ${overview.total}  |  <strong>Miniapps:</strong> ${overview.miniapp}  |  <strong>Success:</strong> ${overview.success}  |  <strong>Failed:</strong> ${overview.failed}  |  <strong>CPU:</strong> ${overview.cpu}%  |  <strong>RAM:</strong> ${overview.ram}%
    </p>
  `;
}

function showMiniapps(apps) {
  const table = document.getElementById('miniappTable');
  table.innerHTML = `<tr><th>#</th><th>Miniapp</th><th>Total</th><th>Success</th><th>Failed</th></tr>`;
  apps.forEach((a, i) => {
    table.innerHTML += `<tr><td>${i + 1}</td><td>${a.miniapp}</td><td>${a.total}</td><td>${a.success}</td><td>${a.failed}</td></tr>`;
  });
}

function showRecentRuns(runs) {
  const table = document.getElementById('recentRunTable');
  table.innerHTML = `<tr><th>#</th><th>Miniapp</th><th>Name</th><th>Result</th><th>Detail</th></tr>`;
  runs.forEach((r, i) => {
    table.innerHTML += `<tr><td>${i + 1}</td><td>${r.miniapp}</td><td>${r.name}</td><td>${r.result}</td><td>${r.detail?.slice(0, 40)}...</td></tr>`;
  });
}

let latestChart = null;
function showMetricsChart(metrics) {
  const labels = Object.keys(metrics);
  const cpu = labels.map(t => metrics[t].cpu);
  const ram = labels.map(t => metrics[t].ram);

  const ctx = document.getElementById('metricsChart').getContext('2d');
  if (latestChart) latestChart.destroy();
  latestChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label: 'CPU %', data: cpu, borderColor: 'red', fill: false },
        { label: 'RAM %', data: ram, borderColor: 'blue', fill: false }
      ]
    }
  });
}

function updateTimeInfo(startTime, updateTime) {
  // Helper function to format date as YYYY-MM-DD HH:MM:SS
  function formatDateTime(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');

    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  }

  const startElem = document.getElementById('startTime');
  const startDate = new Date(startTime);
  startElem.textContent = formatDateTime(startDate);

  const updateElem = document.getElementById('lastUpdated');
  const agoElem = document.getElementById('timeAgo');
  const updatedDate = new Date(updateTime);
  updateElem.textContent = formatDateTime(updatedDate);

  const diffMs = new Date() - updatedDate;
  const mins = Math.floor(diffMs / 60000);
  const hrs = Math.floor(mins / 60);
  const days = Math.floor(hrs / 24);

  agoElem.textContent =
    days > 0 ? `${days} day(s)` :
      hrs > 0 ? `${hrs} hour(s)` :
        `${mins} minute(s)`;
}

function startAutoRefresh() {
  if (refreshInterval) clearInterval(refreshInterval);
  countdown = 30;
  refreshInterval = setInterval(() => {
    countdown--;
    document.getElementById('countdown').textContent = `⏳ Next refresh in ${countdown}s`;
    if (countdown <= 0) {
      fetchLatest();
      countdown = 30;
    }
  }, 1000);
}

// ===== History =====

function openHistoryDialog() {
  document.getElementById('historyModal').showModal();
  loadHistory();
}

function closeHistoryDialog() {
  document.getElementById('historyModal').close();
  document.getElementById('historyList').innerHTML = '';
  document.getElementById('historyMeta').innerHTML = '';
  document.getElementById('historyMiniappTable').innerHTML = '';
  document.getElementById('historyRecentRunTable').innerHTML = '';
  if (historyChart) {
    historyChart.destroy();
    historyChart = null;
  }
}

async function loadHistory() {
  const url = `${pcList[selectedPc]}/${selectedPc}/history.json`;
  const res = await fetch(url);
  const history = await res.json();
  const listElem = document.getElementById('historyList');
  listElem.innerHTML = '';
  currentSelectedButton = null;
  const keys = Object.keys(history).reverse();

  keys.forEach((key, index) => {
    const btn = document.createElement('button');
    btn.textContent = key;
    btn.onclick = () => {
      if (currentSelectedButton) currentSelectedButton.classList.remove('selected-history');
      btn.classList.add('selected-history');
      currentSelectedButton = btn;
      showHistoryDetail(history[key], key);
    };
    listElem.appendChild(btn);

    if (index === 0) {
      btn.click(); // Tự động chọn dòng đầu tiên
    }
  });
}

function showHistoryDetail(data, key) {
  document.getElementById('historyMeta').innerHTML = `
    <p><strong>Start:</strong> ${data.start_time}<br>
       <strong>End:</strong> ${data.update_time}</p>
    <p><strong>Total:</strong> ${data.overview.total}, <strong>Miniapp:</strong> ${data.overview.miniapp}, <strong>Success:</strong> ${data.overview.success}, <strong>Failed:</strong> ${data.overview.failed}</p>
  `;

  showHistoryMiniapps(data.miniapp);
  showHistoryRecentRuns(data.recent_run || []);
  showHistoryMetricsChart(data.metrics);
}

function showHistoryMiniapps(apps) {
  const table = document.getElementById('historyMiniappTable');
  table.innerHTML = `<tr><th>#</th><th>Miniapp</th><th>Total</th><th>Success</th><th>Failed</th></tr>`;
  apps.forEach((a, i) => {
    table.innerHTML += `<tr><td>${i + 1}</td><td>${a.miniapp}</td><td>${a.total}</td><td>${a.success}</td><td>${a.failed}</td></tr>`;
  });
}

function showHistoryRecentRuns(runs) {
  const table = document.getElementById('historyRecentRunTable');
  table.innerHTML = `<tr><th>#</th><th>Miniapp</th><th>Name</th><th>Result</th><th>Detail</th></tr>`;
  runs.forEach((r, i) => {
    table.innerHTML += `<tr><td>${i + 1}</td><td>${r.miniapp}</td><td>${r.name}</td><td>${r.result}</td><td>${r.detail?.slice(0, 40)}...</td></tr>`;
  });
}

let historyChart = null;
function showHistoryMetricsChart(metrics) {
  const labels = Object.keys(metrics);
  const cpu = labels.map(t => metrics[t].cpu);
  const ram = labels.map(t => metrics[t].ram);

  const ctx = document.getElementById('historyMetricsChart').getContext('2d');
  if (historyChart) historyChart.destroy();
  historyChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label: 'CPU %', data: cpu, borderColor: 'red', fill: false },
        { label: 'RAM %', data: ram, borderColor: 'blue', fill: false }
      ]
    }
  });
}

window.onload = () => {
  fetchPcList();
  startAutoRefresh();
};
