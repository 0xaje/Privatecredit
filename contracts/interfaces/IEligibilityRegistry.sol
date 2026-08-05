// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Eligibility, RiskTier} from "../libraries/CreditTypes.sol";

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
     * @param borrower The borrower address
     * @param riskTier The risk tier assigned
     * @param maxActiveCredit The max credit available
     * @param maxLtvBps The max LTV in basis points
     * @param policyVersion The policy version
     * @param evidenceCommitment The evidence commitment
     * @param attestcoinContext The attestcoin context
     */
    function registerEligibility(
        address borrower,
        RiskTier riskTier,
        uint256 maxActiveCredit,
        uint256 maxLtvBps,
        uint256 validUntil,
        uint256 policyVersion,
        bytes32 evidenceCommitment,
        bytes32 attestcoinContext
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
