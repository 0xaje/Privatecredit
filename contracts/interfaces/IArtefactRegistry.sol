// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Artefact, VerificationStatus} from "../libraries/CreditTypes.sol";

interface IArtefactRegistry {
    event ArtefactCommitted(bytes32 indexed artefactId, address indexed creator, bytes32 snapshotCommitment);
    event ArtefactVerified(bytes32 indexed artefactId, VerificationStatus status);

    error ArtefactNotFound(bytes32 artefactId);
    error ArtefactAlreadyExists();

    /**
     * @notice Commits a new artefact to the registry
     * @param snapshotCommitment The snapshot commitment
     * @param eligibilityNonce The associated eligibility nonce
     * @param policyReference The policy reference
     * @param contentReference The IPFS/content URI string
     */
    function commitArtefact(
        bytes32 snapshotCommitment,
        uint256 eligibilityNonce,
        bytes32 policyReference,
        string calldata contentReference
    ) external;

    /**
     * @notice Retrieves an artefact by ID
     * @param artefactId The ID of the artefact
     * @return The Artefact struct
     */
    function getArtefact(bytes32 artefactId) external view returns (Artefact memory);

    /**
     * @notice Updates the verification status of an artefact
     * @param artefactId The ID of the artefact
     * @param snapshotCommitment The verification status
     */
    function verifyArtefact(bytes32 artefactId, bytes32 snapshotCommitment) external view returns (bool);

    /**
     * @notice Retrieves all artefacts committed by a creator
     * @param creator The creator's address
     * @return An array of Artefact structs
     */
    function getArtefactsByCreator(address creator) external view returns (bytes32[] memory);
}
