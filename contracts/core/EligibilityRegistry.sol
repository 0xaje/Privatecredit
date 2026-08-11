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
     * @notice Registers a new eligibility for a borrower. Verifies Attestcoin Proof on-chain.
     * @param params The eligibility parameters assigned by the registrar
     * @param v ECDSA signature v
     * @param r ECDSA signature r
     * @param s ECDSA signature s
     * @param proof The Attestcoin proof data
     */
    function registerEligibility(
        EligibilityParams calldata params,
        uint8 v, bytes32 r, bytes32 s,
        AttestcoinProof calldata proof
    ) external whenNotPaused {
        address borrower = msg.sender;
        
        // 1. Verify Registrar Signature
        require(registrar != address(0), "Registrar not set");
        
        uint256 nonce = nonces[borrower] + 1;
        bytes32 messageHash = keccak256(abi.encodePacked(
            borrower, params.riskTier, params.maxActiveCredit, params.maxLtvBps, params.validUntil, params.policyVersion, params.evidenceCommitment, nonce, block.chainid, address(this)
        ));
        bytes32 ethSignedMessageHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", messageHash));
        address signer = ecrecover(ethSignedMessageHash, v, r, s);
        if (signer != registrar) revert UnauthorizedRegistrar();

        // 2. Verify Attestcoin Proof On-Chain via Precompile (if provided)
        if (proof.txBytes.length > 0) {
            (bool success, bytes memory result) = address(0x0FD2).staticcall(
                abi.encode(proof.chainKey, proof.headerNumber, proof.txBytes, proof.merkleProof, proof.continuityProof)
            );
            require(success, "Attestcoin on-chain precompile verification failed");
            bool isProofValid = abi.decode(result, (bool));
            require(isProofValid, "Attestcoin proof is invalid");
        }

        nonces[borrower] = nonce;
        
        eligibilities[borrower] = Eligibility({
            borrower: borrower,
            riskTier: params.riskTier,
            maxActiveCredit: params.maxActiveCredit,
            maxLtvBps: params.maxLtvBps,
            validUntil: params.validUntil,
            policyVersion: params.policyVersion,
            evidenceCommitment: params.evidenceCommitment,
            attestcoinContext: keccak256(proof.txBytes),
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
