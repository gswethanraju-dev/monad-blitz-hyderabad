# IoT Data Registry on Monad (Part 1)

This project contains the complete code for Part 1: Registering IoT (DHT11) data from an ESP8266 to IPFS (via Pinata) and securely anchoring the data hash onto the Monad blockchain.

## Project Structure

- `IoTDataRegistry.sol`: The Solidity Smart Contract to be deployed on the Monad network. It stores the IPFS CID and the cryptographic hash of the sensor data.
- `esp8266_firmware/`: Contains the Arduino (C++) code for the ESP8266 NodeMCU.
  - Reads temperature and humidity from a DHT11 sensor.
  - Connects to WiFi.
  - Uploads the JSON data payload directly to IPFS using the Pinata API.
- `monad_service/`: Contains the Python bridge script.
  - `monad_registry.py`: Fetches the JSON data from IPFS using the generated CID, computes the Keccak-256 hash, and submits a transaction to the `IoTDataRegistry` smart contract on Monad.
  - `requirements.txt`: Python dependencies (`web3`, `requests`).

## Setup Instructions

### 1. Smart Contract
1. Deploy `IoTDataRegistry.sol` to the Monad network.
2. Save the deployed **Contract Address** and **ABI**.

### 2. ESP8266 Setup
1. Open `esp8266_firmware/esp8266_firmware.ino` in the Arduino IDE.
2. Install the necessary libraries: `ESP8266WiFi`, `ESP8266HTTPClient`, `ArduinoJson`, and `DHT sensor library`.
3. Update the WiFi credentials (`ssid`, `password`) and your Pinata JWT (`pinataJWT`).
4. Flash the code to your ESP8266 and monitor the Serial output to get the Pinata CID (`IpfsHash`).

### 3. Python Service
1. Navigate to the `monad_service` directory.
2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. Open `monad_registry.py` and configure the constants:
   - `MONAD_RPC`
   - `CONTRACT_ADDRESS`
   - `CONTRACT_ABI` (Paste the ABI array from your deployment)
   - `AGENT_PRIVATE_KEY` and `AGENT_ADDRESS`
   - `cid` (The CID printed by the ESP8266)
4. Run the script to calculate the Keccak-256 hash and register the data on Monad:
   ```bash
   python monad_registry.py
   ```
