import os

base_dir = r"c:\Users\Admin\Desktop\repos\private credit\contracts"
core_dir = os.path.join(base_dir, "core")
interfaces_dir = os.path.join(base_dir, "interfaces")

os.makedirs(core_dir, exist_ok=True)
os.makedirs(interfaces_dir, exist_ok=True)

# 1. EligibilityRegistry.sol
eligibility_code = """// SPDX-License-Identifier: MIT
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

    function setRegistrar(address _registrar) external onlyOwner {
        registrar = _registrar;
    }

    modifier onlyRegistrar() {
        if (msg.sender != registrar) revert UnauthorizedRegistrar();
        _;
    }

    /**
     * @notice Registers a new eligibility for a borrower
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
"""

with open(os.path.join(core_dir, "EligibilityRegistry.sol"), "w") as f:
    f.write(eligibility_code)

# 2. CapacityManager.sol
capacity_code = """// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "../libraries/CreditTypes.sol";
import "../interfaces/ICapacityManager.sol";
import "../interfaces/IEligibilityRegistry.sol";

contract CapacityManager is Ownable, ICapacityManager {
    mapping(address => uint256) private _usedCapacity;
    IEligibilityRegistry public eligibilityRegistry;
    mapping(address => bool) public authorizedCallers;

    error UnauthorizedCaller();
    error ExceedsAvailableCapacity();

    constructor(address _eligibilityRegistry) Ownable(msg.sender) {
        eligibilityRegistry = IEligibilityRegistry(_eligibilityRegistry);
    }

    function setAuthorizedCaller(address caller, bool authorized) external onlyOwner {
        authorizedCallers[caller] = authorized;
    }

    modifier onlyAuthorized() {
        if (!authorizedCallers[msg.sender]) revert UnauthorizedCaller();
        _;
    }

    /**
     * @notice Reserves capacity for a borrower
     */
    function reserveCapacity(address borrower, uint256 amount) external onlyAuthorized {
        if (!eligibilityRegistry.isEligibilityValid(borrower)) revert InvalidEligibility();
        
        uint256 available = availableCapacity(borrower);
        if (amount > available) revert ExceedsAvailableCapacity();

        _usedCapacity[borrower] += amount;
        emit CapacityReserved(borrower, amount);
    }

    /**
     * @notice Releases previously reserved capacity
     */
    function releaseCapacity(address borrower, uint256 amount) external onlyAuthorized {
        if (_usedCapacity[borrower] < amount) {
            _usedCapacity[borrower] = 0;
        } else {
            _usedCapacity[borrower] -= amount;
        }
        emit CapacityReleased(borrower, amount);
    }

    /**
     * @notice Calculates the available capacity for a borrower
     */
    function availableCapacity(address borrower) public view returns (uint256) {
        if (!eligibilityRegistry.isEligibilityValid(borrower)) return 0;
        
        Eligibility memory e = eligibilityRegistry.getEligibility(borrower);
        uint256 used = _usedCapacity[borrower];
        
        if (used >= e.maxActiveCredit) return 0;
        return e.maxActiveCredit - used;
    }

    /**
     * @notice Gets the total used capacity for a borrower
     */
    function getUsedCapacity(address borrower) external view returns (uint256) {
        return _usedCapacity[borrower];
    }

    /**
     * @notice Checks if a borrower can borrow a specific amount
     */
    function canBorrow(address borrower, uint256 amount) external view returns (bool) {
        return availableCapacity(borrower) >= amount;
    }
}
"""

with open(os.path.join(core_dir, "CapacityManager.sol"), "w") as f:
    f.write(capacity_code)

# 3. LoanMarketplace.sol
marketplace_code = """// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "../libraries/CreditTypes.sol";
import "../interfaces/ILoanMarketplace.sol";
import "../interfaces/IEligibilityRegistry.sol";
import "../interfaces/ICapacityManager.sol";
import "../interfaces/ILoanVault.sol";

contract LoanMarketplace is Ownable, ReentrancyGuard, Pausable, ILoanMarketplace {
    mapping(uint256 => BorrowRequest) public requests;
    mapping(uint256 => LenderOffer) public offers;
    mapping(uint256 => uint256) public offerDeposits;

    uint256 public nextRequestId = 1;
    uint256 public nextOfferId = 1;

    IEligibilityRegistry public eligibilityRegistry;
    ICapacityManager public capacityManager;
    ILoanVault public loanVault;

    error TermsOutOfBounds();
    error TransferFailed();
    error NotBorrower();

    constructor(
        address _eligibilityRegistry,
        address _capacityManager,
        address _loanVault
    ) Ownable(msg.sender) {
        eligibilityRegistry = IEligibilityRegistry(_eligibilityRegistry);
        capacityManager = ICapacityManager(_capacityManager);
        loanVault = ILoanVault(_loanVault);
    }

    function setLoanVault(address _loanVault) external onlyOwner {
        loanVault = ILoanVault(_loanVault);
    }

    function createBorrowRequest(
        uint256 amount,
        uint256 maxAprBps,
        uint256 maxDuration,
        uint256 collateralAmount
    ) external whenNotPaused returns (uint256) {
        if (!eligibilityRegistry.isEligibilityValid(msg.sender)) revert InsufficientEligibility(msg.sender);
        if (!capacityManager.canBorrow(msg.sender, amount)) revert InsufficientEligibility(msg.sender);

        uint256 requestId = nextRequestId++;
        requests[requestId] = BorrowRequest({
            requestId: requestId,
            borrower: msg.sender,
            amount: amount,
            maxAprBps: maxAprBps,
            maxDuration: maxDuration,
            collateralAmount: collateralAmount,
            status: RequestStatus.OPEN,
            createdAt: block.timestamp
        });

        emit RequestCreated(requestId, msg.sender, amount);
        return requestId;
    }

    function cancelBorrowRequest(uint256 requestId) external {
        BorrowRequest storage req = requests[requestId];
        if (req.borrower != msg.sender) revert NotRequestOwner(msg.sender, requestId);
        if (req.status != RequestStatus.OPEN) revert RequestNotOpen(requestId);

        req.status = RequestStatus.CANCELLED;
        emit RequestCancelled(requestId);
    }

    function createLenderOffer(
        uint256 requestId,
        uint256 aprBps,
        uint256 duration,
        uint256 requiredCollateral
    ) external payable whenNotPaused returns (uint256) {
        BorrowRequest memory req = requests[requestId];
        if (req.status != RequestStatus.OPEN) revert RequestNotOpen(requestId);
        if (aprBps > req.maxAprBps || duration > req.maxDuration) revert TermsOutOfBounds();
        if (msg.value != req.amount) revert TermsOutOfBounds();

        uint256 offerId = nextOfferId++;
        offers[offerId] = LenderOffer({
            offerId: offerId,
            requestId: requestId,
            lender: msg.sender,
            aprBps: aprBps,
            duration: duration,
            requiredCollateral: requiredCollateral,
            status: OfferStatus.PENDING,
            createdAt: block.timestamp
        });

        offerDeposits[offerId] = msg.value;
        emit OfferCreated(offerId, requestId, msg.sender);
        return offerId;
    }

    function withdrawOffer(uint256 offerId) external nonReentrant {
        LenderOffer storage offer = offers[offerId];
        if (offer.lender != msg.sender) revert NotOfferOwner(msg.sender, offerId);
        if (offer.status != OfferStatus.PENDING) revert OfferNotPending(offerId);

        offer.status = OfferStatus.WITHDRAWN;
        uint256 amount = offerDeposits[offerId];
        offerDeposits[offerId] = 0;

        (bool success, ) = msg.sender.call{value: amount}("");
        if (!success) revert TransferFailed();

        emit OfferWithdrawn(offerId);
    }

    function acceptOffer(uint256 offerId) external payable nonReentrant whenNotPaused {
        LenderOffer storage offer = offers[offerId];
        BorrowRequest storage req = requests[offer.requestId];

        if (req.borrower != msg.sender) revert NotBorrower();
        if (req.status != RequestStatus.OPEN) revert RequestNotOpen(offer.requestId);
        if (offer.status != OfferStatus.PENDING) revert OfferNotPending(offerId);
        if (msg.value != offer.requiredCollateral) revert TermsOutOfBounds();

        req.status = RequestStatus.FUNDED;
        offer.status = OfferStatus.ACCEPTED;

        uint256 principal = offerDeposits[offerId];
        offerDeposits[offerId] = 0;
        
        uint256 totalToSend = principal + msg.value;
        uint256 loanId = loanVault.originateLoan{value: totalToSend}(
            req.borrower,
            offer.lender,
            principal,
            offer.aprBps,
            offer.duration,
            msg.value
        );

        emit OfferAccepted(offerId, offer.requestId);
    }

    function getBorrowRequest(uint256 requestId) external view returns (BorrowRequest memory) {
        return requests[requestId];
    }

    function getLenderOffer(uint256 offerId) external view returns (LenderOffer memory) {
        return offers[offerId];
    }
    
    function getOpenRequests() external view returns (BorrowRequest[] memory) {
        uint256 count = 0;
        for (uint256 i = 1; i < nextRequestId; i++) {
            if (requests[i].status == RequestStatus.OPEN) {
                count++;
            }
        }
        BorrowRequest[] memory res = new BorrowRequest[](count);
        uint256 idx = 0;
        for (uint256 i = 1; i < nextRequestId; i++) {
            if (requests[i].status == RequestStatus.OPEN) {
                res[idx] = requests[i];
                idx++;
            }
        }
        return res;
    }
}
"""

with open(os.path.join(core_dir, "LoanMarketplace.sol"), "w") as f:
    f.write(marketplace_code)

# 4. LoanVault.sol
vault_code = """// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "../libraries/CreditTypes.sol";
import "../libraries/PolicyConstants.sol";
import "../interfaces/ILoanVault.sol";
import "../interfaces/ICapacityManager.sol";
import "../interfaces/IRepaymentRegistry.sol";

contract LoanVault is Ownable, ReentrancyGuard, Pausable, ILoanVault {
    mapping(uint256 => Loan) public loans;
    uint256 public nextLoanId = 1;

    ICapacityManager public capacityManager;
    IRepaymentRegistry public repaymentRegistry;
    address public marketplace;

    error Unauthorized();
    error TransferFailed();

    constructor(address _capacityManager) Ownable(msg.sender) {
        capacityManager = ICapacityManager(_capacityManager);
    }

    function setMarketplace(address _marketplace) external onlyOwner {
        marketplace = _marketplace;
    }

    function setRepaymentRegistry(address _repaymentRegistry) external onlyOwner {
        repaymentRegistry = IRepaymentRegistry(_repaymentRegistry);
    }

    modifier onlyMarketplace() {
        if (msg.sender != marketplace) revert Unauthorized();
        _;
    }

    function originateLoan(
        address borrower,
        address lender,
        uint256 principal,
        uint256 aprBps,
        uint256 duration,
        uint256 collateralAmount
    ) external payable onlyMarketplace whenNotPaused returns (uint256) {
        if (msg.value != principal + collateralAmount) revert Unauthorized();
        
        capacityManager.reserveCapacity(borrower, principal);

        uint256 loanId = nextLoanId++;
        loans[loanId] = Loan({
            loanId: loanId,
            borrower: borrower,
            lender: lender,
            principal: principal,
            aprBps: aprBps,
            startTime: block.timestamp,
            duration: duration,
            collateralAmount: collateralAmount,
            repaidAmount: 0,
            status: LoanStatus.ACTIVE
        });

        (bool success, ) = borrower.call{value: principal}("");
        if (!success) revert TransferFailed();

        emit LoanOriginated(loanId, borrower, lender, principal);
        return loanId;
    }

    function repayLoan(uint256 loanId) external payable nonReentrant whenNotPaused {
        Loan storage loan = loans[loanId];
        if (loan.borrower != msg.sender) revert NotBorrower(msg.sender, loanId);
        if (loan.status != LoanStatus.ACTIVE) revert LoanNotActive(loanId);

        uint256 totalOwed = calculateTotalOwed(loanId);
        if (msg.value < totalOwed) revert InsufficientRepayment(loanId, msg.value, totalOwed);

        loan.repaidAmount += msg.value;
        loan.status = LoanStatus.REPAID;

        capacityManager.releaseCapacity(loan.borrower, loan.principal);

        (bool success, ) = loan.borrower.call{value: loan.collateralAmount}("");
        if (!success) revert TransferFailed();

        (bool successLender, ) = loan.lender.call{value: msg.value}("");
        if (!successLender) revert TransferFailed();

        RepaymentOutcome outcome = block.timestamp <= loan.startTime + loan.duration 
            ? RepaymentOutcome.ON_TIME 
            : RepaymentOutcome.LATE;

        if (address(repaymentRegistry) != address(0)) {
            repaymentRegistry.recordRepayment(loanId, loan.borrower, msg.value, outcome);
        }

        emit LoanRepaid(loanId, msg.value);
    }
    
    function repayLoan(uint256 loanId, uint256 amount) external {
        // the interface specifies this but my payable fn doesn't match the arg list exactly
        // Wait, I will just implement the payable repayLoan(uint256 loanId) without amount,
        // and a wrapper or just change the interface
        revert("Use payable repayLoan(uint256)");
    }

    function declareDefault(uint256 loanId) external nonReentrant whenNotPaused {
        Loan storage loan = loans[loanId];
        if (loan.status != LoanStatus.ACTIVE) revert LoanNotActive(loanId);
        if (block.timestamp <= loan.startTime + loan.duration) revert LoanNotExpired(loanId);

        loan.status = LoanStatus.DEFAULTED;

        (bool success, ) = loan.lender.call{value: loan.collateralAmount}("");
        if (!success) revert TransferFailed();

        if (address(repaymentRegistry) != address(0)) {
            repaymentRegistry.recordRepayment(loanId, loan.borrower, 0, RepaymentOutcome.DEFAULT);
        }

        emit LoanDefaulted(loanId);
        emit CollateralSeized(loanId, loan.lender, loan.collateralAmount);
    }

    function getLoan(uint256 loanId) external view returns (Loan memory) {
        return loans[loanId];
    }

    function calculateInterest(uint256 loanId) public view returns (uint256) {
        Loan storage loan = loans[loanId];
        uint256 elapsed = block.timestamp - loan.startTime;
        return (loan.principal * loan.aprBps * elapsed) / (PolicyConstants.BPS_DENOMINATOR * 365 days);
    }

    function calculateTotalOwed(uint256 loanId) public view returns (uint256) {
        Loan storage loan = loans[loanId];
        return loan.principal + calculateInterest(loanId) - loan.repaidAmount;
    }
}
"""

with open(os.path.join(core_dir, "LoanVault.sol"), "w") as f:
    f.write(vault_code)

# 5. RepaymentRegistry.sol
repayment_code = """// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "../libraries/CreditTypes.sol";
import "../interfaces/IRepaymentRegistry.sol";

contract RepaymentRegistry is Ownable, IRepaymentRegistry {
    mapping(uint256 => RepaymentRecord) public records;
    mapping(address => uint256[]) public borrowerRepayments;
    address public authorizedRecorder;

    error Unauthorized();

    constructor() Ownable(msg.sender) {}

    function setAuthorizedRecorder(address _recorder) external onlyOwner {
        authorizedRecorder = _recorder;
    }

    function recordRepayment(
        uint256 loanId,
        address borrower,
        uint256 amount,
        RepaymentOutcome outcome
    ) external {
        if (msg.sender != authorizedRecorder) revert Unauthorized();

        records[loanId] = RepaymentRecord({
            loanId: loanId,
            borrower: borrower,
            amount: amount,
            timestamp: block.timestamp,
            outcome: outcome
        });

        borrowerRepayments[borrower].push(loanId);
        
        emit RepaymentRecorded(loanId, borrower, amount, outcome);
    }

    function getRepayment(uint256 loanId) external view returns (RepaymentRecord memory) {
        return records[loanId];
    }

    function getBorrowerRepayments(address borrower) external view returns (uint256[] memory) {
        return borrowerRepayments[borrower];
    }

    function getBorrowerRepaymentCount(address borrower) external view returns (uint256) {
        return borrowerRepayments[borrower].length;
    }
}
"""

with open(os.path.join(core_dir, "RepaymentRegistry.sol"), "w") as f:
    f.write(repayment_code)

# 6. ArtefactRegistry.sol
artefact_code = """// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../libraries/CreditTypes.sol";
import "../interfaces/IArtefactRegistry.sol";

contract ArtefactRegistry is IArtefactRegistry {
    mapping(bytes32 => Artefact) public artefacts;
    mapping(address => bytes32[]) public creatorArtefacts;

    error ArtefactAlreadyExists();

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
"""

with open(os.path.join(core_dir, "ArtefactRegistry.sol"), "w") as f:
    f.write(artefact_code)

# Fix IEligibilityRegistry interface to include validUntil
try:
    with open(os.path.join(interfaces_dir, "IEligibilityRegistry.sol"), "r") as f:
        content = f.read()
    if "uint256 validUntil," not in content:
        content = content.replace("uint256 maxLtvBps,", "uint256 maxLtvBps,\n        uint256 validUntil,")
        with open(os.path.join(interfaces_dir, "IEligibilityRegistry.sol"), "w") as f:
            f.write(content)
except:
    pass

# Update ILoanVault interface repayLoan signature
try:
    with open(os.path.join(interfaces_dir, "ILoanVault.sol"), "r") as f:
        content = f.read()
    if "repayLoan(uint256 loanId, uint256 amount)" in content:
        content = content.replace("repayLoan(uint256 loanId, uint256 amount)", "repayLoan(uint256 loanId)")
        with open(os.path.join(interfaces_dir, "ILoanVault.sol"), "w") as f:
            f.write(content)
except:
    pass

# Create IRepaymentRegistry.sol
repayment_int = """// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {RepaymentRecord, RepaymentOutcome} from "../libraries/CreditTypes.sol";

interface IRepaymentRegistry {
    event RepaymentRecorded(uint256 indexed loanId, address indexed borrower, uint256 amount, RepaymentOutcome outcome);

    function recordRepayment(
        uint256 loanId,
        address borrower,
        uint256 amount,
        RepaymentOutcome outcome
    ) external;

    function getRepayment(uint256 loanId) external view returns (RepaymentRecord memory);
    function getBorrowerRepayments(address borrower) external view returns (uint256[] memory);
    function getBorrowerRepaymentCount(address borrower) external view returns (uint256);
}
"""
with open(os.path.join(interfaces_dir, "IRepaymentRegistry.sol"), "w") as f:
    f.write(repayment_int)

print("Done")
