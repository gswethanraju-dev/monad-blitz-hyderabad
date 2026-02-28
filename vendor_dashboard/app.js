// Setup variables
const CONTRACT_ADDRESS = "0x82aB691cbA54EB95E09aC69Cc170AB14bBf1299e"; // Deployed Monad address
const MONAD_TESTNET_CHAIN_ID = 10143; // Monad Testnet Chain ID
const MONAD_RPC = "https://testnet-rpc.monad.xyz/";
const WALLET_ADDRESS = "0xBB1eE14a27aaBe1F2300B4A76E99eF558F355975"; // Hardcoded Vendor Wallet Address

// Minimal ABI just for the event we care about
const ABI = [
    "event DataRegistered(string cid, bytes32 dataHash, address publisher, uint256 timestamp)"
];

// DOM Elements
const walletAddressDisplay = document.getElementById('walletAddressDisplay');
const monadBalanceDisplay = document.getElementById('monadBalanceDisplay');
const networkStatusDisplay = document.getElementById('networkStatusDisplay');
const totalRecordsDisplay = document.getElementById('totalRecordsDisplay');
const tableBody = document.getElementById('tableBody');
const pulseIndicator = document.querySelector('.pulse-indicator');

let provider;
let contract;
let recordCount = 0;

// DOM Elements for Bridge Control
const startBridgeBtn = document.getElementById('startBridgeBtn');
const bridgeStatusBadge = document.getElementById('bridgeStatusBadge');
const BRIDGE_API = "http://localhost:5000";

// Initialize app with Hardcoded Provider
async function init() {
    try {
        // Setup ethers provider using public Monad RPC directly
        provider = new ethers.JsonRpcProvider(MONAD_RPC, MONAD_TESTNET_CHAIN_ID);

        // Connect automatically using hardcoded user wallet
        await handleConnection(WALLET_ADDRESS);

        // Start Auto-Refresh Timers
        startTimers();

    } catch (err) {
        console.error("Init Error:", err);
    }
}

function startTimers() {
    // 1. Auto-refresh balance every 20 seconds
    setInterval(() => {
        updateBalance(WALLET_ADDRESS);
    }, 20000);

    // 2. Poll Bridge Status every 5 seconds
    setInterval(checkBridgeStatus, 5000);
}

async function checkBridgeStatus() {
    try {
        const resp = await fetch(`${BRIDGE_API}/status`);
        const data = await resp.json();
        updateBridgeUI(data.bridge_running);
    } catch (e) {
        updateBridgeUI(false);
    }
}

function updateBridgeUI(isRunning) {
    if (isRunning) {
        bridgeStatusBadge.innerText = "Registry Online";
        bridgeStatusBadge.className = "badge badge-success";
        startBridgeBtn.disabled = true;
        startBridgeBtn.innerText = "Bridge Running";
        pulseIndicator.classList.add('active');
    } else {
        bridgeStatusBadge.innerText = "Registry Offline";
        bridgeStatusBadge.className = "badge badge-error";
        startBridgeBtn.disabled = false;
        startBridgeBtn.innerText = "Start Registry Bridge";
        pulseIndicator.classList.remove('active');
    }
}

// Start Bridge Logic
if (startBridgeBtn) {
    startBridgeBtn.addEventListener('click', async () => {
        try {
            startBridgeBtn.disabled = true;
            startBridgeBtn.innerText = "Starting...";
            const resp = await fetch(`${BRIDGE_API}/start_bridge`, { method: 'POST' });
            const data = await resp.json();
            alert(data.message);
            checkBridgeStatus();
        } catch (err) {
            console.error("Failed to start bridge:", err);
            alert("Error: Backend bridge not responding. Make sure monad_registry.py is running.");
            startBridgeBtn.disabled = false;
            startBridgeBtn.innerText = "Start Registry Bridge";
        }
    });
}

// Connect Wallet Button click
// This button is no longer functional in this hardcoded setup, but kept for UI consistency if needed.
// It will be hidden by handleConnection.
const connectBtn = document.getElementById('connectWalletBtn');
if (connectBtn) {
    connectBtn.addEventListener('click', () => {
        alert("Wallet connection is hardcoded in this version. No action needed.");
    });
}


// Handle Wallet Connection
async function handleConnection(address) {
    try {
        // Update UI for Connected State
        walletAddressDisplay.innerText = `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
        walletAddressDisplay.title = address;

        // Hide connect button as it's hardcoded
        if (connectBtn) {
            connectBtn.style.display = "none";
        }

        // Fetch Balance
        await updateBalance(address);

        // Setup Contract Listener
        setupContract(address);
    } catch (err) {
        console.error("Account processing error:", err);
        alert("Account processing error: " + (err.message || err));
    }
}

// Fetch MON balance
async function updateBalance(address) {
    try {
        const balanceWei = await provider.getBalance(address);
        const balanceMon = ethers.formatEther(balanceWei);
        monadBalanceDisplay.innerText = `${parseFloat(balanceMon).toFixed(4)} MON`;
    } catch (err) {
        console.error("Failed to fetch balance:", err);
    }
}

// Setup Smart Contract Listener
function setupContract(walletAddress) {
    contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);
    updateNetworkStatus(true);
    pulseIndicator.classList.add('active');

    // Fetch past events
    fetchHistoricalEvents();

    // Start periodic polling for new events every 5 seconds
    setInterval(fetchNewEvents, 5000);
}

let lastFetchedBlock = 0;

async function fetchNewEvents() {
    try {
        const currentBlock = await provider.getBlockNumber();
        if (lastFetchedBlock === 0) {
            lastFetchedBlock = currentBlock - 10; // Start from recent past on first run
        }

        if (currentBlock <= lastFetchedBlock) return;

        const filter = contract.filters.DataRegistered();
        const events = await contract.queryFilter(filter, lastFetchedBlock + 1, 'latest');

        if (events.length > 0) {
            events.forEach(evt => {
                const { cid, dataHash, publisher, timestamp } = evt.args;
                // Only add if not already in UI (simple deduplication by CID)
                if (!document.getElementById(`row-${cid}`)) {
                    addRecordToTable(cid, dataHash, publisher, timestamp, true);
                }
            });
            // Refresh balance if we found new transactions
            updateBalance(WALLET_ADDRESS);
        }

        lastFetchedBlock = currentBlock;
    } catch (err) {
        console.error("Polled event fetch failed:", err);
    }
}

async function fetchHistoricalEvents() {
    try {
        // Query last 1000 blocks for events (or suitable range)
        const currentBlock = await provider.getBlockNumber();
        const fromBlock = currentBlock > 99 ? currentBlock - 99 : 0;

        const filter = contract.filters.DataRegistered();
        const events = await contract.queryFilter(filter, fromBlock, 'latest');

        // Clear loading or existing
        tableBody.innerHTML = '';

        // Sort reverse chronological
        events.sort((a, b) => Number(b.args.timestamp) - Number(a.args.timestamp));

        events.forEach(evt => {
            const { cid, dataHash, publisher, timestamp } = evt.args;
            addRecordToTable(cid, dataHash, publisher, timestamp, false);
        });

        if (events.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 2rem;">No data registered yet.</td></tr>';
        }

    } catch (err) {
        console.error("Failed to fetch history:", err);
    }
}

// Add row to UI
async function addRecordToTable(cid, dataHash, publisher, timestamp, isNew = false) {
    // Remove "No data" message if present
    if (recordCount === 0 && tableBody.firstChild && tableBody.firstChild.innerText.includes('No data')) {
        tableBody.innerHTML = '';
    }

    const date = new Date(Number(timestamp) * 1000).toLocaleString();
    const shortPub = `${publisher.substring(0, 6)}...${publisher.substring(publisher.length - 4)}`;
    const shortHash = `${dataHash.substring(0, 10)}...${dataHash.substring(dataHash.length - 8)}`;
    const pinataLink = `https://gateway.pinata.cloud/ipfs/${cid}`;
    const explorerLink = `https://testnet.monadexplorer.com/address/${publisher}`;

    const tr = document.createElement('tr');
    tr.id = `row-${cid}`;
    if (isNew) tr.className = 'new-row';

    // Placeholder while fetching
    tr.innerHTML = `
        <td>${date}</td>
        <td class="data-val temp-val">...</td>
        <td class="data-val hum-val">...</td>
        <td><a href="${explorerLink}" target="_blank">${shortPub}</a></td>
        <td><a href="${pinataLink}" target="_blank">${cid.substring(0, 10)}...</a></td>
        <td title="${dataHash}">${shortHash}</td>
    `;

    // Add to top of table
    tableBody.insertBefore(tr, tableBody.firstChild);

    // Update count
    recordCount++;
    totalRecordsDisplay.innerText = recordCount;

    // Fetch IPFS content for this CID
    fetchIpfsData(cid, tr);
}

async function fetchIpfsData(cid, rowElement) {
    const gateways = [
        "https://gateway.pinata.cloud/ipfs/",
        "https://ipfs.io/ipfs/",
        "https://cloudflare-ipfs.com/ipfs/"
    ];

    let data = null;
    for (const gw of gateways) {
        try {
            const resp = await fetch(gw + cid, { signal: AbortSignal.timeout(8000) });
            if (resp.ok) {
                data = await resp.json();
                break;
            }
        } catch (e) { }
    }

    if (data) {
        const content = data.pinataContent || data;
        const tempTd = rowElement.querySelector('.temp-val');
        const humTd = rowElement.querySelector('.hum-val');

        if (tempTd && content.temperature !== undefined) {
            tempTd.innerHTML = `<span class="temp-badge">${content.temperature}°C</span>`;
        }
        if (humTd && content.humidity !== undefined) {
            humTd.innerHTML = `<span class="hum-badge">${content.humidity}%</span>`;
        }
    } else {
        rowElement.querySelector('.temp-val').innerText = "N/A";
        rowElement.querySelector('.hum-val').innerText = "N/A";
    }
}

function updateNetworkStatus(isConnected) {
    if (isConnected) {
        networkStatusDisplay.innerText = '● Connected to Monad';
        networkStatusDisplay.className = 'status-indicator connected';
    } else {
        networkStatusDisplay.innerText = '● Disconnected';
        networkStatusDisplay.className = 'status-indicator';
        pulseIndicator.classList.remove('active');
    }
}

// Start - wait for UI to load before init
window.addEventListener('load', init);
