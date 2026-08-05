// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../libraries/CreditTypes.sol";
import "../interfaces/IArtefactRegistry.sol";

contract ArtefactRegistry is IArtefactRegistry {
    mapping(bytes32 => Artefact) public artefacts;
    mapping(address => bytes32[]) public creatorArtefacts;



    /**
     * @notice Commits a new artefact
     * @param snapshotCommitment The snapshot commitment
     * @param eligibilityNonce The eligibility nonce
     * @param policyReference The policy reference
     * @param contentReference The content reference string
     */
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

    /**
     * @notice Retrieves an artefact by its ID
     * @param artefactId The ID of the artefact
     * @return The Artefact struct
     */
    function getArtefact(bytes32 artefactId) external view returns (Artefact memory) {
        return artefacts[artefactId];
    }

    /**
     * @notice Verifies if a snapshot commitment matches the artefact's
     * @param artefactId The ID of the artefact
     * @param snapshotCommitment The commitment to verify
     * @return True if matches, false otherwise
     */
    function verifyArtefact(bytes32 artefactId, bytes32 snapshotCommitment) external view returns (bool) {
        return artefacts[artefactId].snapshotCommitment == snapshotCommitment;
    }

    /**
     * @notice Retrieves all artefacts created by a specific address
     * @param creator The creator's address
     * @return Array of artefact IDs
     */
    function getArtefactsByCreator(address creator) external view returns (bytes32[] memory) {
        return creatorArtefacts[creator];
    }
}
