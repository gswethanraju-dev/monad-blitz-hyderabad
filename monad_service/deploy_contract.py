import json
import os
from web3 import Web3
from solcx import compile_standard, install_solc

# Configuration
MONAD_RPC = "https://testnet-rpc.monad.xyz/"  # Replace with actual Monad RPC URL (e.g., testnet RPC)
AGENT_PRIVATE_KEY = "e8fce17fbc173907242ed66a6e32f35691e76a64800a11419ccdbd6431bf098b"
AGENT_ADDRESS = "0xBB1eE14a27aaBe1F2300B4A76E99eF558F355975"

# Resolve the absolute path to IoTDataRegistry.sol relative to this script
current_dir = os.path.dirname(os.path.abspath(__file__))
CONTRACT_FILE = os.path.join(current_dir, "..", "IoTDataRegistry.sol")

def deploy():
    # Connect to Monad
    w3 = Web3(Web3.HTTPProvider(MONAD_RPC))
    if not w3.is_connected():
        print("Failed to connect to Monad RPC. Please check your MONAD_RPC URL.")
        return

    print("Connected to Monad.")

    # Install specific solc version required by the contract
    print("Installing Solidity compiler (solc 0.8.20)...")
    install_solc("0.8.20")

    # Read Solidity source code
    with open(CONTRACT_FILE, "r") as file:
        contract_source_code = file.read()

    # Compile the contract
    print("Compiling IoTDataRegistry.sol...")
    compiled_sol = compile_standard(
        {
            "language": "Solidity",
            "sources": {"IoTDataRegistry.sol": {"content": contract_source_code}},
            "settings": {
                "outputSelection": {
                    "*": {
                        "*": ["abi", "metadata", "evm.bytecode", "evm.sourceMap"]
                    }
                }
            },
        },
        solc_version="0.8.20",
    )

    # Extract ABI and Bytecode
    bytecode = compiled_sol["contracts"]["IoTDataRegistry.sol"]["IoTDataRegistry"]["evm"]["bytecode"]["object"]
    abi = compiled_sol["contracts"]["IoTDataRegistry.sol"]["IoTDataRegistry"]["abi"]

    # Save ABI to a file so it can be easily loaded by monad_registry.py
    abi_path = "contract_abi.json"
    with open(abi_path, "w") as f:
        json.dump(abi, f, indent=4)
    print(f"Saved contract ABI to {abi_path}")

    # Build the transaction
    try:
        IoTDataRegistry = w3.eth.contract(abi=abi, bytecode=bytecode)
        nonce = w3.eth.get_transaction_count(AGENT_ADDRESS)
        
        # Get dynamic chain ID
        chain_id = w3.eth.chain_id
        
        # Estimate gas price
        gas_price = w3.eth.gas_price

        print("Building deployment transaction...")
        transaction = IoTDataRegistry.constructor().build_transaction(
            {
                "chainId": chain_id,
                "gasPrice": gas_price,
                "from": AGENT_ADDRESS,
                "nonce": nonce,
            }
        )

        # Sign the transaction
        print("Signing transaction...")
        signed_txn = w3.eth.account.sign_transaction(transaction, private_key=AGENT_PRIVATE_KEY)

        # Send the transaction
        print("Sending deployment transaction to the network...")
        tx_hash = w3.eth.send_raw_transaction(signed_txn.raw_transaction)
        print(f"Deploy transaction hash: {tx_hash.hex()}")

        # Wait for the transaction to be mined
        print("Waiting for transaction to be mined...")
        tx_receipt = w3.eth.wait_for_transaction_receipt(tx_hash)
        print(f"\n--- SUCCESS ---")
        print(f"Contract deployed at address: {tx_receipt.contractAddress}")
        print(f"Please copy this address and update CONTRACT_ADDRESS in monad_registry.py")

    except Exception as e:
        print(f"\nError during deployment: {e}")

if __name__ == "__main__":
    deploy()
