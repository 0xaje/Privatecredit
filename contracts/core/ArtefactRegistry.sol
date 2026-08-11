// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../libraries/CreditTypes.sol";
import "../interfaces/IArtefactRegistry.sol";

contract ArtefactRegistry is IArtefactRegistry {
    mapping(bytes32 => Artefact) public artefacts;
    mapping(address => bytes32[]) public creatorArtefacts;

    function commitArtefact(
        bytes32 snapshotCommitment,
        uint256 eligibilityNonce,
        bytes32 policyReference,
        string calldata contentReference
    ) external {
        bytes32 artefactId = keccak256(abi.encodePacked(msg.sender, snapshotCommitment, block.timestamp));
        
        if (artefacts[artefactId].timestamp != 0) revert ArtefactAlreadyExists();

        artefacts[artefactId] = Artefact({
            artefactId: artefactId,
            creator: msg.sender,
            snapshotCommitment: snapshotCommitment,
            eligibilityNonce: eligibilityNonce,
            policyReference: policyReference,
            timestamp: block.timestamp,
            contentReference: contentReference
        });

        creatorArtefacts[msg.sender].push(artefactId);
        
        emit ArtefactCommitted(artefactId, msg.sender, snapshotCommitment);
    }

    function getArtefact(bytes32 artefactId) external view returns (Artefact memory) {
        return artefacts[artefactId];
    }

    function verifyArtefact(bytes32 artefactId, bytes32 snapshotCommitment) external view returns (bool) {
        return artefacts[artefactId].snapshotCommitment == snapshotCommitment;
    }

    function getArtefactsByCreator(address creator) external view returns (bytes32[] memory) {
        return creatorArtefacts[creator];
    }
}
