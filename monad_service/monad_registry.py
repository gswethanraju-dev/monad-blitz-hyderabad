import json
import requests
import time
import os
import threading
from flask import Flask, jsonify
from flask_cors import CORS
from web3 import Web3

# Configuration
PINATA_JWT = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySW5mb3JtYXRpb24iOnsiaWQiOiJmOTI4NGQ5ZS0wMWQzLTQyMTEtOGVjNi0zNzdjZDdhNDUyMDYiLCJlbWFpbCI6Imp1aWNlcnRlY2hub2xvZ3lAZ21haWwuY29tIiwiZW1haWxfdmVyaWZpZWQiOnRydWUsInBpbl9wb2xpY3kiOnsicmVnaW9ucyI6W3siZGVzaXJlZFJlcGxpY2F0aW9uQ291bnQiOjEsImlkIjoiRlJBMSJ9LHsiZGVzaXJlZFJlcGxpY2F0aW9uQ291bnQiOjEsImlkIjoiTllDMSJ9XSwidmVyc2lvbiI6MX0sIm1mYV9lbmFibGVkIjpmYWxzZSwic3RhdHVzIjoiQUNUSVZFIn0sImF1dGhlbnRpY2F0aW9uVHlwZSI6InNjb3BlZEtleSIsInNjb3BlZEtleUtleSI6IjIyNmZjMGZiNmEwYjA1MmU0ODA2Iiwic2NvcGVkS2V5U2VjcmV0IjoiYWZmNThiMjBiN2FmMjQwZDEyNTY3OWUzOTFlYTNkOTgwYzUwZTg3ZDcxNzYxOTA1YWFiZjk5ZmVhNGZhYzVjNyIsImV4cCI6MTgwMzgxMDY3OX0.qVMModn1FLyPWwsKbFEhAEHUIlXkuVRamtShGdsXrKU"
PINATA_GATEWAY = "https://gateway.pinata.cloud/ipfs/"
MONAD_RPC = "https://testnet-rpc.monad.xyz/"
CONTRACT_ADDRESS = "0x82aB691cbA54EB95E09aC69Cc170AB14bBf1299e"
AGENT_PRIVATE_KEY = "e8fce17fbc173907242ed66a6e32f35691e76a64800a11419ccdbd6431bf098b"
AGENT_ADDRESS = "0xBB1eE14a27aaBe1F2300B4A76E99eF558F355975"

w3 = Web3(Web3.HTTPProvider(MONAD_RPC))

# Fallback gateways for better reliability
GATEWAYS = [
    "https://gateway.pinata.cloud/ipfs/",
    "https://ipfs.io/ipfs/",
    "https://cloudflare-ipfs.com/ipfs/",
    "https://dweb.link/ipfs/"
]

# Flask App Setup
app = Flask(__name__)
CORS(app)

# Bridge State
bridge_running = False
bridge_thread = None

# Load the ABI
abi_paths = [
    os.path.join(os.path.dirname(__file__), "contract_abi.json"),
    os.path.join(os.path.dirname(os.path.dirname(__file__)), "contract_abi.json"),
    "contract_abi.json"
]

CONTRACT_ABI = None
for path in abi_paths:
    if os.path.exists(path):
        with open(path, "r") as f:
            CONTRACT_ABI = json.load(f)
        break

if not CONTRACT_ABI:
    raise Exception("contract_abi.json not found in any expected location.")

contract = w3.eth.contract(address=CONTRACT_ADDRESS, abi=CONTRACT_ABI)

def compute_hash(data):
    core_data = data.get("pinataContent", data)
    canonical = json.dumps(core_data, sort_keys=True)
    return Web3.keccak(text=canonical)

def get_recent_pins():
    url = "https://api.pinata.cloud/data/pinList?status=pinned&pageLimit=10"
    headers = {"Authorization": f"Bearer {PINATA_JWT}"}
    response = requests.get(url, headers=headers)
    if response.status_code == 200:
        return response.json().get("rows", [])
    return []

def is_registered(cid):
    try:
        record = contract.functions.records(cid).call()
        return record[0] != ""
    except Exception:
        return False

def register_cid(cid):
    print(f"Attempting to register new CID: {cid}")
    data = None
    for gateway in GATEWAYS:
        try:
            resp = requests.get(gateway + cid, timeout=12)
            if resp.status_code == 200:
                data = resp.json()
                break
        except Exception:
            continue
            
    if not data:
        return
    
    try:
        hash_bytes = compute_hash(data)
        nonce = w3.eth.get_transaction_count(AGENT_ADDRESS)
        tx = contract.functions.registerData(cid, hash_bytes).build_transaction({
            "from": AGENT_ADDRESS,
            "nonce": nonce,
            "gas": 300000,
            "gasPrice": w3.eth.gas_price
        })
        signed = w3.eth.account.sign_transaction(tx, AGENT_PRIVATE_KEY)
        tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
        print(f"Successfully registered {cid}. Tx: {tx_hash.hex()}")
    except Exception as e:
        print(f"Error registering {cid}: {e}")

def bridge_loop():
    global bridge_running
    print("Bridge worker thread started.")
    while bridge_running:
        try:
            pins = get_recent_pins()
            for pin in pins:
                cid = pin.get("ipfs_pin_hash")
                if cid and not is_registered(cid):
                    register_cid(cid)
            time.sleep(30)
        except Exception as e:
            print(f"Bridge loop error: {e}")
            time.sleep(10)

@app.route('/status', methods=['GET'])
def get_status():
    return jsonify({"status": "online", "bridge_running": bridge_running})

@app.route('/start_bridge', methods=['POST'])
def start_bridge():
    global bridge_running, bridge_thread
    if not bridge_running:
        bridge_running = True
        bridge_thread = threading.Thread(target=bridge_loop, daemon=True)
        bridge_thread.start()
        return jsonify({"message": "Bridge started successfully"})
    return jsonify({"message": "Bridge is already running"})

@app.route('/stop_bridge', methods=['POST'])
def stop_bridge():
    global bridge_running
    bridge_running = False
    return jsonify({"message": "Bridge stopping..."})

if __name__ == "__main__":
    print(f"Starting Monad-Pinata Control API on port 5000...")
    app.run(host='0.0.0.0', port=5000)
