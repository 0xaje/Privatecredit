// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "../libraries/CreditTypes.sol";
import "../libraries/PolicyConstants.sol";
import "../interfaces/IEligibilityRegistry.sol";

contract EligibilityRegistry is Ownable, Pausable, IEligibilityRegistry {
    mapping(address => Eligibility) public eligibilities;
    mapping(address => uint256) public nonces;
    address public registrar;

    error InvalidPolicy();
    error ZeroBorrower();

    constructor() Ownable(msg.sender) {}

    function setRegistrar(address _registrar) external onlyOwner {
        require(_registrar != address(0), "zero registrar");
        registrar = _registrar;
    }

    modifier onlyRegistrar() {
        if (msg.sender != registrar) revert UnauthorizedRegistrar();
        _;
    }

    function registerEligibility(
        address borrower,
        RiskTier riskTier,
        uint256 maxActiveCredit,
        uint256 maxLtvBps,
        uint256 validUntil,
        uint256 policyVersion,
        bytes32 evidenceCommitment,
        bytes32 attestcoinContext
    ) external onlyRegistrar whenNotPaused {
        if (borrower == address(0)) revert ZeroBorrower();
        if (maxActiveCredit == 0 || maxLtvBps > PolicyConstants.BPS_DENOMINATOR || validUntil <= block.timestamp) revert InvalidPolicy();
        if (policyVersion == 0 || evidenceCommitment == bytes32(0) || attestcoinContext == bytes32(0)) revert InvalidPolicy();

        if (riskTier == RiskTier.LOW) {
            if (maxActiveCredit > PolicyConstants.LOW_RISK_MAX_CREDIT || maxLtvBps > PolicyConstants.LOW_RISK_MAX_LTV_BPS) revert InvalidPolicy();
        } else if (riskTier == RiskTier.MEDIUM) {
            if (maxActiveCredit > PolicyConstants.MEDIUM_RISK_MAX_CREDIT || maxLtvBps > PolicyConstants.MEDIUM_RISK_MAX_LTV_BPS) revert InvalidPolicy();
        } else if (riskTier == RiskTier.HIGH) {
            if (maxActiveCredit > PolicyConstants.HIGH_RISK_MAX_CREDIT || maxLtvBps > PolicyConstants.HIGH_RISK_MAX_LTV_BPS) revert InvalidPolicy();
        } else {
            revert InvalidPolicy();
        }

        uint256 nonce = ++nonces[borrower];
        eligibilities[borrower] = Eligibility({
            borrower: borrower,
            riskTier: riskTier,
            maxActiveCredit: maxActiveCredit,
            maxLtvBps: maxLtvBps,
            validUntil: validUntil,
            policyVersion: policyVersion,
            evidenceCommitment: evidenceCommitment,
            attestcoinContext: attestcoinContext,
            nonce: nonce,
            active: true
        });
        emit EligibilityRegistered(borrower, nonce);
    }

    function revokeEligibility(address borrower) external {
        if (msg.sender != registrar && msg.sender != owner()) revert UnauthorizedRegistrar();
        eligibilities[borrower].active = false;
        emit EligibilityRevoked(borrower, eligibilities[borrower].nonce);
    }

    function getEligibility(address borrower) external view returns (Eligibility memory) {
        return eligibilities[borrower];
    }

    function isEligibilityValid(address borrower) external view returns (bool) {
        Eligibility storage e = eligibilities[borrower];
        return e.active && block.timestamp < e.validUntil;
    }

    function getEligibilityNonce(address borrower) external view returns (uint256) {
        return nonces[borrower];
    }
}
