const PC_LIST_URL = "https://tool-auto-v5-root-default-rtdb.asia-southeast1.firebasedatabase.app/list-pc.json";
let pcList = {};
let selectedGroup = localStorage.getItem('selected-group') || null;
let selectedPc = localStorage.getItem('selected-pc-name') || null;
let refreshInterval = null;
let countdown = 30;
let currentSelectedButton = null;
let currentRecentRunsData = null;
let currentRecentRunsFilter = 'all';
let currentHistoryData = null;
let currentHistoryFilter = 'all';

async function fetchPcList() {
  const res = await fetch(PC_LIST_URL);
  pcList = await res.json();

  const groups = Object.keys(pcList);
  if (groups.length === 0) return;

  // If saved group is invalid, use first group
  if (!selectedGroup || !pcList[selectedGroup]) {
    selectedGroup = groups[0];
    localStorage.setItem('selected-group', selectedGroup);
  }

  // Populate group selector
  const groupSelector = document.getElementById('groupSelector');
  groupSelector.innerHTML = '';
  groups.forEach(group => {
    const option = document.createElement('option');
    option.value = group;
    option.textContent = group;
    if (selectedGroup === group) option.selected = true;
    groupSelector.appendChild(option);
  });

  groupSelector.onchange = () => {
    selectedGroup = groupSelector.value;
    localStorage.setItem('selected-group', selectedGroup);
    // Reset PC selection for new group
    selectedPc = null;
    localStorage.removeItem('selected-pc-name');
    populatePcSelector();
    fetchLatest();
  };

  populatePcSelector();
  fetchLatest();
}

function populatePcSelector() {
  const pcSelector = document.getElementById('pcSelector');
  pcSelector.innerHTML = '';

  if (!selectedGroup || !pcList[selectedGroup]) return;

  const pcs = Object.keys(pcList[selectedGroup]);
  if (pcs.length === 0) return;

  // If saved PC is invalid for this group, use first PC
  if (!selectedPc || !pcList[selectedGroup][selectedPc]) {
    selectedPc = pcs[0];
    localStorage.setItem('selected-pc-name', selectedPc);
  }

  pcs.forEach(pc => {
    const option = document.createElement('option');
    option.value = pc;
    option.textContent = pc;
    if (selectedPc === pc) option.selected = true;
    pcSelector.appendChild(option);
  });

  pcSelector.onchange = () => {
    selectedPc = pcSelector.value;
    localStorage.setItem('selected-pc-name', selectedPc);
    fetchLatest();
  };
}

async function fetchLatest() {
  if (!selectedGroup || !selectedPc || !pcList[selectedGroup] || !pcList[selectedGroup][selectedPc]) return;
  const workerEndpoint = pcList[selectedGroup][selectedPc];
  const url = `${workerEndpoint}/${selectedGroup}/${selectedPc}/latest.json`;
  const res = await fetch(url);
  const data = await res.json();

  showOverview(data.overview);
  showPlugins(data.plugins);
  currentRecentRunsData = data.recent_run || {};
  showRecentRuns(currentRecentRunsFilter);
  showMetricsChart(data.metrics);
  updateTimeInfo(data.start_time, data.update_time);
}

function showOverview(overview) {
  const block = document.getElementById('overviewBlock');
  block.innerHTML = `
    <p>
      <strong>Total:</strong> ${overview.total}  |  <strong>Plugins:</strong> ${overview.plugin}  |  <strong>Success:</strong> ${overview.success}  |  <strong>Failed:</strong> ${overview.failed}  |  <strong>CPU:</strong> ${overview.cpu}%  |  <strong>RAM:</strong> ${overview.ram}%  |  <strong>GPU:</strong> ${overview.gpu}%
    </p>
  `;
}

function showPlugins(plugins) {
  const table = document.getElementById('pluginTable');
  table.innerHTML = `<tr><th>#</th><th>Plugin</th><th>Engines</th><th>Total</th><th>Success</th><th>Failed</th></tr>`;
  plugins.forEach((p, i) => {
    const engines = (p.engines && p.engines.length > 0) ? p.engines.join(', ') : '-';
    table.innerHTML += `<tr><td>${i + 1}</td><td>${p.plugin}</td><td>${engines}</td><td>${p.total}</td><td>${p.success}</td><td>${p.failed}</td></tr>`;
  });
}

function filterRecentRuns(filter) {
  currentRecentRunsFilter = filter;

  // Update button states
  document.getElementById('allBtn').classList.remove('active');
  document.getElementById('successBtn').classList.remove('active');
  document.getElementById('failedBtn').classList.remove('active');
  document.getElementById(filter + 'Btn').classList.add('active');

  showRecentRuns(filter);
}

function showRecentRuns(filter = 'all') {
  const table = document.getElementById('recentRunTable');
  table.innerHTML = `<tr><th>#</th><th>Plugin</th><th>Name</th><th>Result</th><th>Time</th></tr>`;

  if (!currentRecentRunsData || !currentRecentRunsData[filter]) {
    table.innerHTML += `<tr><td colspan="5">No record found</td></tr>`;
    return;
  }

  const runs = currentRecentRunsData[filter];
  runs.forEach((r, i) => {
    table.innerHTML += `<tr><td>${i + 1}</td><td>${r.plugin}</td><td>${r.name}</td><td>${r.result}</td><td>${r.run_time}</td></tr>`;
  });
}

let latestChart = null;
function showMetricsChart(metrics) {
  const labels = Object.keys(metrics);
  const cpu = labels.map(t => metrics[t].cpu);
  const ram = labels.map(t => metrics[t].ram);
  const gpu = labels.map(t => metrics[t].gpu || 0.0);

  const ctx = document.getElementById('metricsChart').getContext('2d');
  if (latestChart) latestChart.destroy();
  latestChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label: 'CPU %', data: cpu, borderColor: 'red', fill: false },
        { label: 'RAM %', data: ram, borderColor: 'blue', fill: false },
        { label: 'GPU %', data: gpu, borderColor: 'green', fill: false }
      ]
    }
  });
}

function updateTimeInfo(startTime, updateTime) {
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
  document.getElementById('historyPluginTable').innerHTML = '';
  document.getElementById('historyRecentRunTable').innerHTML = '';
  if (historyChart) {
    historyChart.destroy();
    historyChart = null;
  }
}

async function loadHistory() {
  if (!selectedGroup || !selectedPc || !pcList[selectedGroup] || !pcList[selectedGroup][selectedPc]) return;
  const workerEndpoint = pcList[selectedGroup][selectedPc];
  const url = `${workerEndpoint}/${selectedGroup}/${selectedPc}/history.json`;
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
      btn.click();
    }
  });
}

function showHistoryDetail(data, key) {
  document.getElementById('historyMeta').innerHTML = `
    <p><strong>Start:</strong> ${data.start_time}<br>
       <strong>End:</strong> ${data.update_time}</p>
    <p><strong>Total:</strong> ${data.overview.total}, <strong>Plugins:</strong> ${data.overview.plugin}, <strong>Success:</strong> ${data.overview.success}, <strong>Failed:</strong> ${data.overview.failed}</p>
  `;

  showHistoryPlugins(data.plugins);
  currentHistoryData = data.recent_run || {};
  currentHistoryFilter = 'all';
  // Reset history filter buttons
  document.getElementById('historyAllBtn').classList.add('active');
  document.getElementById('historySuccessBtn').classList.remove('active');
  document.getElementById('historyFailedBtn').classList.remove('active');
  showHistoryRecentRuns(currentHistoryFilter);
  showHistoryMetricsChart(data.metrics);
}

function showHistoryPlugins(plugins) {
  const table = document.getElementById('historyPluginTable');
  table.innerHTML = `<tr><th>#</th><th>Plugin</th><th>Engines</th><th>Total</th><th>Success</th><th>Failed</th></tr>`;
  plugins.forEach((p, i) => {
    const engines = (p.engines && p.engines.length > 0) ? p.engines.join(', ') : '-';
    table.innerHTML += `<tr><td>${i + 1}</td><td>${p.plugin}</td><td>${engines}</td><td>${p.total}</td><td>${p.success}</td><td>${p.failed}</td></tr>`;
  });
}

function filterHistoryRecentRuns(filter) {
  currentHistoryFilter = filter;

  // Update button states
  document.getElementById('historyAllBtn').classList.remove('active');
  document.getElementById('historySuccessBtn').classList.remove('active');
  document.getElementById('historyFailedBtn').classList.remove('active');
  document.getElementById('history' + filter.charAt(0).toUpperCase() + filter.slice(1) + 'Btn').classList.add('active');

  showHistoryRecentRuns(filter);
}

function showHistoryRecentRuns(filter = 'all') {
  const table = document.getElementById('historyRecentRunTable');
  table.innerHTML = `<tr><th>#</th><th>Plugin</th><th>Name</th><th>Result</th><th>Time</th></tr>`;

  if (!currentHistoryData || !currentHistoryData[filter]) {
    table.innerHTML += `<tr><td colspan="5">No record found</td></tr>`;
    return;
  }

  const runs = currentHistoryData[filter];
  runs.forEach((r, i) => {
    table.innerHTML += `<tr><td>${i + 1}</td><td>${r.plugin}</td><td>${r.name}</td><td>${r.result}</td><td>${r.run_time}</td></tr>`;
  });
}

let historyChart = null;
function showHistoryMetricsChart(metrics) {
  const labels = Object.keys(metrics);
  const cpu = labels.map(t => metrics[t].cpu);
  const ram = labels.map(t => metrics[t].ram);
  const gpu = labels.map(t => metrics[t].gpu || 0.0);

  const ctx = document.getElementById('historyMetricsChart').getContext('2d');
  if (historyChart) historyChart.destroy();
  historyChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label: 'CPU %', data: cpu, borderColor: 'red', fill: false },
        { label: 'RAM %', data: ram, borderColor: 'blue', fill: false },
        { label: 'GPU %', data: gpu, borderColor: 'green', fill: false }
      ]
    }
  });
}

window.onload = () => {
  fetchPcList();
  startAutoRefresh();
};
