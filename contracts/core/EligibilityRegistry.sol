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

    constructor() Ownable(msg.sender) {}

    /**
     * @notice Sets the registrar address
     * @param _registrar The new registrar address
     */
    function setRegistrar(address _registrar) external onlyOwner {
        registrar = _registrar;
    }

    modifier onlyRegistrar() {
        if (msg.sender != registrar) revert UnauthorizedRegistrar();
        _;
    }

    /**
     * @notice Registers a new eligibility for a borrower
     * @param borrower The borrower address
     * @param riskTier The risk tier assigned
     * @param maxActiveCredit The max credit available
     * @param maxLtvBps The max LTV in basis points
     * @param validUntil The validity expiration timestamp
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
    ) external onlyRegistrar whenNotPaused {
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

    /**
     * @notice Revokes an active eligibility
     * @param borrower The borrower address
     */
    function revokeEligibility(address borrower) external {
        if (msg.sender != registrar && msg.sender != owner()) revert UnauthorizedRegistrar();
        
        eligibilities[borrower].active = false;
        emit EligibilityRevoked(borrower, eligibilities[borrower].nonce);
    }

    /**
     * @notice Retrieves the eligibility data for a borrower
     * @param borrower The borrower address
     * @return The Eligibility struct
     */
    function getEligibility(address borrower) external view returns (Eligibility memory) {
        return eligibilities[borrower];
    }

    /**
     * @notice Checks if the eligibility for a borrower is valid
     * @param borrower The borrower address
     * @return True if valid, false otherwise
     */
    function isEligibilityValid(address borrower) external view returns (bool) {
        Eligibility storage e = eligibilities[borrower];
        return e.active && block.timestamp < e.validUntil;
    }

    /**
     * @notice Retrieves the current eligibility nonce for a borrower
     * @param borrower The borrower address
     * @return The nonce
     */
    function getEligibilityNonce(address borrower) external view returns (uint256) {
        return nonces[borrower];
    }
}
