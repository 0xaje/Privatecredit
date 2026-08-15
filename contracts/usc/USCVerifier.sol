// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./EvmV1Decoder.sol";
import "../core/EligibilityRegistry.sol";
import "../libraries/CreditTypes.sol";
import "./VerifierInterface.sol";

/**
 * @title USCVerifier
 * @notice Creditcoin Attestcoin Protocol ASC for verified EVM evidence.
 * @dev Proof inclusion is verified synchronously by the native 0x0FD2 precompile.
 *      The decoded receipt and Transfer event are then checked before eligibility is written.
 */
contract USCVerifier is Ownable, ReentrancyGuard {
    using EvmV1Decoder for EvmV1Decoder.ReceiptFields;

    bytes32 public constant TRANSFER_EVENT_SIGNATURE = keccak256("Transfer(address,address,uint256)");
    uint256 public constant BPS_DENOMINATOR = 10_000;
    uint256 public constant POLICY_VERSION = 1;

    INativeQueryVerifier public immutable verifier;
    EligibilityRegistry public immutable eligibilityRegistry;

    struct VerifiedEvidence {
        address borrower;
        uint8 evidenceType;
        uint64 chainKey;
        uint64 blockHeight;
        address token;
        address sender;
        uint256 amount;
        bytes32 transactionHash;
        bool active;
    }

    mapping(bytes32 => bool) public processedQueries;
    mapping(bytes32 => bool) public processedEvidence;
    mapping(bytes32 => VerifiedEvidence) public verifiedEvidence;
    mapping(bytes32 => bool) public evidenceUsedForEligibility;
    mapping(address => uint256) public borrowerEvidenceNonces;

    address public sourceToken;
    uint256 public sourceChainId;
    uint64 public sourceChainKey;

    error InvalidProof();
    error InvalidTransaction();
    error UnsupportedSourceChain(uint64 chainKey);
    error SourceChainMismatch(uint256 expected, uint256 actual);
    error SourceTokenNotConfigured();
    error WrongToken(address actual);
    error WrongReceiver(address actual, address expected);
    error WrongSender(address actual, address expected);
    error InvalidTransferAmount();
    error QueryAlreadyProcessed(bytes32 queryId);
    error EvidenceAlreadyProcessed(bytes32 evidenceId);
    error EvidenceAlreadyUsed(bytes32 evidenceId);
    error EligibilityRejected();
    error ZeroAddress();

    event SourceTokenConfigured(uint256 indexed sourceChainId, uint64 indexed sourceChainKey, address indexed sourceToken);
    event EvidenceVerified(
        bytes32 indexed queryId,
        bytes32 indexed evidenceId,
        address indexed borrower,
        uint64 chainKey,
        uint64 blockHeight,
        address token,
        address sender,
        uint256 amount,
        uint8 evidenceType,
        bytes32 transactionHash
    );
    event EligibilityRegisteredFromEvidence(
        address indexed borrower,
        uint256 indexed nonce,
        bytes32 evidenceCommitment,
        bytes32 attestcoinContext
    );

    constructor(address _eligibilityRegistry) Ownable(msg.sender) {
        if (_eligibilityRegistry == address(0)) revert ZeroAddress();
        verifier = NativeQueryVerifierLib.getVerifier();
        eligibilityRegistry = EligibilityRegistry(_eligibilityRegistry);
    }

    function setSourceToken(uint256 _sourceChainId, address _sourceToken) external onlyOwner {
        if (_sourceToken == address(0)) revert ZeroAddress();
        sourceChainId = _sourceChainId;
        sourceToken = _sourceToken;
        emit SourceTokenConfigured(_sourceChainId, sourceChainKey, _sourceToken);
    }

    function setSourceChainKey(uint64 _sourceChainKey) external onlyOwner {
        if (_sourceChainKey == 0) revert UnsupportedSourceChain(_sourceChainKey);
        sourceChainKey = _sourceChainKey;
        emit SourceTokenConfigured(sourceChainId, _sourceChainKey, sourceToken);
    }

    /**
     * @notice Verify one source-chain transaction and record its Transfer semantics.
     * @param evidenceType 0 = INFLOW, 1 = REPAYMENT.
     */
    function verifyEvidence(
        uint8 evidenceType,
        address borrower,
        uint64 chainKey,
        uint64 blockHeight,
        bytes calldata encodedTransaction,
        bytes32 merkleRoot,
        INativeQueryVerifier.MerkleProofEntry[] calldata siblings,
        bytes32 lowerEndpointDigest,
        bytes32[] calldata continuityRoots
    ) external nonReentrant returns (bytes32 evidenceId, uint256 amount, bytes32 transactionHash) {
        if (borrower == address(0)) revert ZeroAddress();
        if (evidenceType > 1) revert InvalidTransaction();
        if (sourceToken == address(0)) revert SourceTokenNotConfigured();
        if (sourceChainId == 0 || sourceChainKey == 0) revert SourceChainMismatch(sourceChainId, chainKey);
        if (chainKey != sourceChainKey) revert UnsupportedSourceChain(chainKey);

        INativeQueryVerifier.MerkleProof memory merkleProof = INativeQueryVerifier.MerkleProof({
            root: merkleRoot,
            siblings: siblings
        });
        bytes32 transactionIdentity = keccak256(encodedTransaction);
        bytes32 queryId = keccak256(abi.encode(chainKey, blockHeight, transactionIdentity, merkleRoot));
        if (processedQueries[queryId]) revert QueryAlreadyProcessed(queryId);

        bool verified = verifier.verify(
            chainKey,
            blockHeight,
            encodedTransaction,
            merkleProof,
            INativeQueryVerifier.ContinuityProof({
                lowerEndpointDigest: lowerEndpointDigest,
                roots: continuityRoots
            })
        );
        if (!verified) revert InvalidProof();

        EvmV1Decoder.ReceiptFields memory receipt = EvmV1Decoder.decodeReceiptFields(encodedTransaction);
        if (receipt.receiptStatus != 1) revert InvalidTransaction();

        EvmV1Decoder.CommonTxFields memory txFields = EvmV1Decoder.decodeCommonTxFields(encodedTransaction);
        EvmV1Decoder.LogEntry[] memory transfers = EvmV1Decoder.getLogsByEventSignature(
            receipt,
            TRANSFER_EVENT_SIGNATURE
        );
        if (transfers.length == 0) revert InvalidTransaction();

        bool found;
        address sender;
        uint256 transferAmount;
        for (uint256 i = 0; i < transfers.length; i++) {
            EvmV1Decoder.LogEntry memory log = transfers[i];
            if (log.address_ != sourceToken || log.topics.length != 3 || log.data.length != 32) continue;

            address from = address(uint160(uint256(log.topics[1])));
            address to = address(uint160(uint256(log.topics[2])));
            uint256 value = abi.decode(log.data, (uint256));
            if (value == 0) continue;

            if (evidenceType == 0) {
                if (to != borrower) continue;
                if (from != txFields.from) revert WrongSender(from, txFields.from);
            } else {
                if (from != borrower) continue;
                if (to != txFields.to && txFields.to != sourceToken) continue;
            }

            found = true;
            sender = from;
            transferAmount = value;
            break;
        }
        if (!found) revert InvalidTransaction();
        if (transferAmount == 0) revert InvalidTransferAmount();

        amount = transferAmount;
        transactionHash = transactionIdentity;
        evidenceId = keccak256(abi.encode(
            sourceChainId,
            chainKey,
            transactionHash,
            borrower,
            evidenceType,
            address(this)
        ));
        if (processedEvidence[evidenceId]) revert EvidenceAlreadyProcessed(evidenceId);

        processedQueries[queryId] = true;
        processedEvidence[evidenceId] = true;
        verifiedEvidence[evidenceId] = VerifiedEvidence({
            borrower: borrower,
            evidenceType: evidenceType,
            chainKey: chainKey,
            blockHeight: blockHeight,
            token: sourceToken,
            sender: sender,
            amount: transferAmount,
            transactionHash: transactionHash,
            active: true
        });
        borrowerEvidenceNonces[borrower] += 1;

        emit EvidenceVerified(
            queryId,
            evidenceId,
            borrower,
            chainKey,
            blockHeight,
            sourceToken,
            sender,
            transferAmount,
            evidenceType,
            transactionHash
        );
    }

    /**
     * @notice Register official eligibility using a verified evidence commitment.
     * @dev This is the only production path that can write eligibility from this ASC.
     */
    function registerEligibilityFromEvidence(
        address borrower,
        RiskTier riskTier,
        uint256 maxActiveCredit,
        uint256 maxLtvBps,
        uint256 validUntil,
        bytes32[] calldata evidenceIds
    ) external nonReentrant {
        if (borrower == address(0)) revert ZeroAddress();
        if (evidenceIds.length == 0) revert EligibilityRejected();
        if (maxActiveCredit == 0 || maxLtvBps > BPS_DENOMINATOR || validUntil <= block.timestamp) {
            revert EligibilityRejected();
        }

        bytes32 evidenceCommitment = keccak256(abi.encode(borrower, POLICY_VERSION, evidenceIds));
        bytes32 attestcoinContext = keccak256(abi.encode(address(this), borrower, evidenceIds));
        bytes32 previous;
        for (uint256 i = 0; i < evidenceIds.length; i++) {
            bytes32 evidenceId = evidenceIds[i];
            if (i > 0 && evidenceId <= previous) revert EligibilityRejected();
            VerifiedEvidence memory evidence = verifiedEvidence[evidenceId];
            if (!evidence.active || evidence.borrower != borrower) revert EligibilityRejected();
            if (evidenceUsedForEligibility[evidenceId]) revert EvidenceAlreadyUsed(evidenceId);
            evidenceUsedForEligibility[evidenceId] = true;
            previous = evidenceId;
        }

        eligibilityRegistry.registerEligibility(
            borrower,
            riskTier,
            maxActiveCredit,
            maxLtvBps,
            validUntil,
            POLICY_VERSION,
            evidenceCommitment,
            attestcoinContext
        );

        emit EligibilityRegisteredFromEvidence(
            borrower,
            eligibilityRegistry.getEligibilityNonce(borrower),
            evidenceCommitment,
            attestcoinContext
        );
    }
}
