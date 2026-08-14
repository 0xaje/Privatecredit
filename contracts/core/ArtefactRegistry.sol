// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../libraries/CreditTypes.sol";
import "../interfaces/IArtefactRegistry.sol";
import "../interfaces/IEligibilityRegistry.sol";

contract ArtefactRegistry is IArtefactRegistry {
    mapping(bytes32 => Artefact) public artefacts;
    mapping(address => bytes32[]) public creatorArtefacts;
    IEligibilityRegistry public immutable eligibilityRegistry;

    error InvalidArtefact();
    error EligibilityNonceMismatch(uint256 expected, uint256 provided);
    error EligibilityRequired();

    constructor(address _eligibilityRegistry) {
        require(_eligibilityRegistry != address(0), "zero eligibility registry");
        eligibilityRegistry = IEligibilityRegistry(_eligibilityRegistry);
    }

    function commitArtefact(
        bytes32 snapshotCommitment,
        uint256 eligibilityNonce,
        bytes32 policyReference,
        string calldata contentReference
    ) external {
        if (snapshotCommitment == bytes32(0) || policyReference == bytes32(0) || bytes(contentReference).length == 0) {
            revert InvalidArtefact();
        }
        Eligibility memory eligibility = eligibilityRegistry.getEligibility(msg.sender);
        if (!eligibility.active || block.timestamp >= eligibility.validUntil) revert EligibilityRequired();
        if (eligibility.nonce != eligibilityNonce) revert EligibilityNonceMismatch(eligibility.nonce, eligibilityNonce);

        bytes32 artefactId = keccak256(abi.encode(
            msg.sender,
            snapshotCommitment,
            eligibilityNonce,
            policyReference,
            contentReference
        ));
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
