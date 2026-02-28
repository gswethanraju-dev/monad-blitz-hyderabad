// Marketplace Constants
const CONTRACT_ADDRESS = "0x82aB691cbA54EB95E09aC69Cc170AB14bBf1299e";
const MONAD_RPC = "https://testnet-rpc.monad.xyz/";
const PROVIDER_ABI = [
    "event DataRegistered(string cid, bytes32 dataHash, address publisher, uint256 timestamp)",
    "function records(string cid) view returns (string, bytes32, address, uint256)"
];

// 10 Companies Listing
const companies = [
    { id: 'montest', name: 'MonTest ev', tags: ['Live', 'IoT', 'Environment'], desc: 'Real-time temperature and humidity streams from active industrial sensors.', type: 'real' },
    { id: 'helios', name: 'Helios Solar Metrics', tags: ['Solar', 'Energy'], desc: 'Precision solar radiation and panel efficiency data for energy optimization.', type: 'sim' },
    { id: 'aqua', name: 'AquaStream Pro', tags: ['Water', 'Level'], desc: 'High-frequency water level and flow metrics for municipal infrastructure.', type: 'sim' },
    { id: 'agritech', name: 'AgriSense CropGuard', tags: ['Agriculture', 'Soil'], desc: 'Micro-climate and soil moisture data for precision farming applications.', type: 'sim' },
    { id: 'urbanlog', name: 'UrbanLog Traffic', tags: ['City', 'IoT'], desc: 'Real-time vehicle count and air quality metrics from urban intersections.', type: 'sim' },
    { id: 'windforce', name: 'WindForce Analytics', tags: ['Wind', 'Renewable'], desc: 'Offshore wind speed and turbine vibration telemetry for maintenance.', type: 'sim' },
    { id: 'coldchain', name: 'ColdChain Guardians', tags: ['Logistics', 'Pharma'], desc: 'End-to-end temperature tracking for pharmaceutical and food logistics.', type: 'sim' },
    { id: 'biome', name: 'Biome Ecology', tags: ['Forest', 'Wildlife'], desc: 'Acoustic monitoring and soil health data from protected forest bio-zones.', type: 'sim' },
    { id: 'deepsea', name: 'DeepSea Explorers', tags: ['Marine', 'Pressure'], desc: 'Oceanographic data including pressure, salinity, and temperature gradients.', type: 'sim' },
    { id: 'gridsecure', name: 'GridSecure Power', tags: ['Grid', 'Utility'], desc: 'Substation load and phase-angle data for regional power grid security.', type: 'sim' }
];

// Hardcoded Wallet Configuration (Headless Mode)
const MARKET_PRIVATE_KEY = "c35a05236bd394e274e1e989b981c2417ef13bcf4f49992e57637ba60af73dd0";

// Wallet state
let provider;
let signer;
let contract;
let userAddress = null;

// DOM elements
const providerGrid = document.getElementById('providerGrid');
const requestModal = document.getElementById('requestModal');
const modalCompanyName = document.getElementById('modalCompanyName');
const confirmRequestBtn = document.getElementById('confirmRequestBtn');
const closeModal = document.getElementById('closeModal');
const purchasedDataSection = document.getElementById('purchasedDataSection');
const monBalanceDisplay = document.getElementById('monBalance');
const userAddressDisplay = document.getElementById('userAddressDisplay');

let selectedCompany = null;

// Initialization
async function init() {
    renderProviders();
    setupEventListeners();
    await initializeSystem();
}

// "Headless" System Initialization
async function initializeSystem() {
    try {
        // 1. Initialize Provider
        provider = new ethers.JsonRpcProvider(MONAD_RPC);

        // 2. Initialize Signer (from private key)
        signer = new ethers.Wallet(MARKET_PRIVATE_KEY, provider);
        userAddress = signer.address;

        // 3. Initialize Contract
        contract = new ethers.Contract(CONTRACT_ADDRESS, PROVIDER_ABI, signer);

        // 4. Update UI
        updateUI();

        // 5. Initial Balance Fetch
        await updateBalance();

        // 6. Set Auto-Refresh (every 20 seconds)
        setInterval(updateBalance, 20000);

        console.log("System Initialized in Headless Mode:", userAddress);
    } catch (e) {
        console.error("Initialization failed:", e);
        if (userAddressDisplay) userAddressDisplay.innerText = "Connection Failed";
    }
}

async function updateBalance() {
    if (!signer || !provider) return;
    try {
        const balance = await provider.getBalance(userAddress);
        monBalanceDisplay.innerText = `${parseFloat(ethers.formatEther(balance)).toFixed(4)} MON`;
    } catch (e) {
        console.error("Balance fetch failed", e);
    }
}

function updateUI() {
    if (userAddressDisplay) {
        userAddressDisplay.innerText = `${userAddress.slice(0, 6)}...${userAddress.slice(-4)}`;
    }
}

// Helper to ensure we have a provider even if not connected (for viewing records)
async function getBaseProvider() {
    if (!provider) {
        provider = new ethers.JsonRpcProvider(MONAD_RPC);
        contract = new ethers.Contract(CONTRACT_ADDRESS, PROVIDER_ABI, provider);
    }
    return provider;
}

function renderProviders() {
    providerGrid.innerHTML = companies.map(company => `
        <div class="provider-card glass">
            <span class="badge-top">${company.tags.join(' • ')}</span>
            <h3>${company.name}</h3>
            <p class="desc">${company.desc}</p>
            <div class="price-row">
                <span class="price">0.001 MON</span>
                <button class="btn-request" onclick="openRequestModal('${company.id}')">Request Data</button>
            </div>
        </div>
    `).join('');
}

function setupEventListeners() {
    if (closeModal) closeModal.onclick = () => requestModal.classList.add('hidden');

    confirmRequestBtn.onclick = async () => {
        confirmRequestBtn.innerText = "Processing Transaction...";
        confirmRequestBtn.disabled = true;

        // Simulate a short delay for the "Monad Tx"
        setTimeout(async () => {
            await handlePurchase();
            confirmRequestBtn.innerText = "Purchase Access";
            confirmRequestBtn.disabled = false;
            requestModal.classList.add('hidden');
            purchasedDataSection.classList.remove('hidden');
            window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
        }, 1500);
    };
}

window.openRequestModal = (companyId) => {
    selectedCompany = companies.find(c => c.id === companyId);
    modalCompanyName.innerText = selectedCompany.name;
    requestModal.classList.remove('hidden');
};

async function handlePurchase() {
    const dataType = document.getElementById('dataTypeDropdown').value;

    if (selectedCompany.type === 'real') {
        // Fetch realization from Monad
        await fetchRealMonadData(dataType);
    } else {
        // Generate simulated data
        generateMockData(selectedCompany, dataType);
    }
}

async function fetchRealMonadData(dataType) {
    try {
        await getBaseProvider();
        // We fetch the most recent DataRegistered event from our contract
        const filter = contract.filters.DataRegistered();
        const latestBlock = await provider.getBlockNumber();
        const fromBlock = BigInt(latestBlock) - 99n;
        const events = await contract.queryFilter(filter, fromBlock > 0n ? fromBlock : 0n, 'latest');

        if (events.length > 0) {
            // Take the latest one
            const latest = events[events.length - 1].args;
            const cid = latest.cid;

            // Re-fetch the JSON from IPFS to show the value
            const gateways = ["https://gateway.pinata.cloud/ipfs/", "https://ipfs.io/ipfs/"];
            let content = null;

            for (const gw of gateways) {
                try {
                    const resp = await fetch(gw + cid, { signal: AbortSignal.timeout(5000) });
                    if (resp.ok) {
                        const json = await resp.json();
                        content = json.pinataContent || json;
                        break;
                    }
                } catch (e) { }
            }

            let displayVal = "N/A";
            if (content) {
                if (dataType === 'temperature') displayVal = `${content.temperature}°C`;
                else if (dataType === 'humidity') displayVal = `${content.humidity}%`;
                else displayVal = `${content.temperature}°C / ${content.humidity}%`;
            }

            updateDataDisplay(displayVal, latest.publisher, latest.cid, latest.dataHash, "Pay with MON (0.001)");
        } else {
            alert("No real-time data found in Registry yet. Please start the Registry Bridge.");
        }
    } catch (e) {
        console.error("Failed to fetch real monad data", e);
        alert("Contract fetch failed. Mocking data for MonTest ev instead.");
        generateMockData(selectedCompany, dataType);
    }
}

function generateMockData(company, dataType) {
    const mockValues = {
        temperature: `${20 + Math.floor(Math.random() * 15)}°C`,
        humidity: `${40 + Math.floor(Math.random() * 30)}%`,
        both: `${25}°C / ${55}%`
    };

    updateDataDisplay(
        mockValues[dataType],
        "0x" + Math.random().toString(16).slice(2, 42),
        "Qm" + Math.random().toString(36).slice(2, 48),
        "0x" + Math.random().toString(16).slice(2, 66),
        "Simulated Payment (Credit)"
    );
}

function updateDataDisplay(val, pub, cid, hash, mode) {
    document.getElementById('displayValue').innerText = val;
    document.getElementById('displayPublisher').innerText = pub;
    document.getElementById('displayCid').innerText = cid;
    document.getElementById('displayHash').innerText = hash;
    document.getElementById('displayPayment').innerText = mode;
}

init();
