// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract IoTDataRegistry {
    struct DataRecord {
        string cid;
        bytes32 dataHash;
        address publisher;
        uint256 timestamp;
    }

    mapping(string => DataRecord) public records;

    event DataRegistered(
        string cid,
        bytes32 dataHash,
        address publisher,
        uint256 timestamp
    );

    function registerData(string calldata cid, bytes32 dataHash) external {
        records[cid] = DataRecord({
            cid: cid,
            dataHash: dataHash,
            publisher: msg.sender,
            timestamp: block.timestamp
        });
        emit DataRegistered(cid, dataHash, msg.sender, block.timestamp);
    }

    function getHash(string calldata cid) external view returns (bytes32) {
        return records[cid].dataHash;
    }
}
