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
     * @notice Registers a new eligibility through the USCVerifier registrar.
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

    function revokeEligibility(address borrower) external;
    function getEligibility(address borrower) external view returns (Eligibility memory);
    function isEligibilityValid(address borrower) external view returns (bool);
    function getEligibilityNonce(address borrower) external view returns (uint256);
}
