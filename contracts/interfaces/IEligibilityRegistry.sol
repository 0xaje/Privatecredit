// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Eligibility, RiskTier, EligibilityParams, AttestcoinProof} from "../libraries/CreditTypes.sol";

interface IEligibilityRegistry {
    event EligibilityRegistered(address indexed borrower, uint256 nonce);
    event EligibilityRevoked(address indexed borrower, uint256 nonce);
    event EligibilityExpired(address indexed borrower, uint256 nonce);

    error EligibilityNotFound(address borrower);
    error EligibilityExpiredError(address borrower);
    error EligibilityAlreadyActive(address borrower);
    error UnauthorizedRegistrar();

    /**
     * @notice Registers a new eligibility for a borrower
     * @param params The eligibility parameters
     * @param v ECDSA signature v
     * @param r ECDSA signature r
     * @param s ECDSA signature s
     * @param proof The Attestcoin proof data
     */
    function registerEligibility(
        EligibilityParams calldata params,
        uint8 v, bytes32 r, bytes32 s,
        AttestcoinProof calldata proof
    ) external;

    /**
     * @notice Revokes an active eligibility
     * @param borrower The borrower address
     */
    function revokeEligibility(address borrower) external;

    /**
     * @notice Retrieves the eligibility data for a borrower
     * @param borrower The borrower address
     * @return The Eligibility struct
     */
    function getEligibility(address borrower) external view returns (Eligibility memory);

    /**
     * @notice Checks if the eligibility for a borrower is valid
     * @param borrower The borrower address
     * @return True if valid, false otherwise
     */
    function isEligibilityValid(address borrower) external view returns (bool);

    /**
     * @notice Retrieves the current eligibility nonce for a borrower
     * @param borrower The borrower address
     * @return The nonce
     */
    function getEligibilityNonce(address borrower) external view returns (uint256);
}
