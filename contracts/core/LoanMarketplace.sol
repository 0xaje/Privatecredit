// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "../libraries/CreditTypes.sol";
import "../interfaces/ILoanMarketplace.sol";
import "../interfaces/IEligibilityRegistry.sol";
import "../interfaces/ICapacityManager.sol";
import "../interfaces/ILoanVault.sol";
import "../libraries/PolicyConstants.sol";

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
    error InsufficientCollateral(uint256 required, uint256 provided);

    /**
     * @notice Constructor for LoanMarketplace
     * @param _eligibilityRegistry Address of EligibilityRegistry
     * @param _capacityManager Address of CapacityManager
     * @param _loanVault Address of LoanVault
     */
    constructor(
        address _eligibilityRegistry,
        address _capacityManager,
        address _loanVault
    ) Ownable(msg.sender) {
        eligibilityRegistry = IEligibilityRegistry(_eligibilityRegistry);
        capacityManager = ICapacityManager(_capacityManager);
        loanVault = ILoanVault(_loanVault);
    }

    /**
     * @notice Set Loan Vault address
     * @param _loanVault The loan vault address
     */
    function setLoanVault(address _loanVault) external onlyOwner {
        loanVault = ILoanVault(_loanVault);
    }

    /**
     * @notice Creates a new borrow request
     * @param amount The loan amount requested
     * @param maxAprBps The maximum APR the borrower is willing to accept
     * @param maxDuration The maximum duration of the loan
     * @param collateralAmount The collateral amount offered
     * @return requestId The ID of the created request
     */
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

    /**
     * @notice Cancels an open borrow request
     * @param requestId The ID of the request to cancel
     */
    function cancelBorrowRequest(uint256 requestId) external {
        BorrowRequest storage req = requests[requestId];
        if (req.borrower != msg.sender) revert NotRequestOwner(msg.sender, requestId);
        if (req.status != RequestStatus.OPEN) revert RequestNotOpen(requestId);

        req.status = RequestStatus.CANCELLED;
        emit RequestCancelled(requestId);
    }

    /**
     * @notice Creates an offer for a specific borrow request
     * @param requestId The ID of the borrow request
     * @param aprBps The offered APR in basis points
     * @param duration The loan duration offered
     * @param requiredCollateral The required collateral amount
     * @return offerId The ID of the created offer
     */
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

    /**
     * @notice Withdraws a pending offer
     * @param offerId The ID of the offer to withdraw
     */
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

    /**
     * @notice Accepts a lender offer for a borrow request
     * @param offerId The ID of the offer to accept
     */
    function acceptOffer(uint256 offerId) external payable nonReentrant whenNotPaused {
        LenderOffer storage offer = offers[offerId];
        BorrowRequest storage req = requests[offer.requestId];

        if (req.borrower != msg.sender) revert NotBorrower();
        if (req.status != RequestStatus.OPEN) revert RequestNotOpen(offer.requestId);
        if (offer.status != OfferStatus.PENDING) revert OfferNotPending(offerId);
        if (msg.value != offer.requiredCollateral) revert TermsOutOfBounds();

        // Enforce LTV from the borrower's eligibility record
        uint256 principal = offerDeposits[offerId];
        Eligibility memory elig = eligibilityRegistry.getEligibility(req.borrower);
        if (elig.maxLtvBps > 0) {
            uint256 requiredCollateral = (principal * elig.maxLtvBps) / PolicyConstants.BPS_DENOMINATOR;
            if (msg.value < requiredCollateral) revert InsufficientCollateral(requiredCollateral, msg.value);
        }

        req.status = RequestStatus.FUNDED;
        offer.status = OfferStatus.ACCEPTED;
        offerDeposits[offerId] = 0;
        
        uint256 totalToSend = principal + msg.value;
        loanVault.originateLoan{value: totalToSend}(
            req.borrower,
            offer.lender,
            principal,
            offer.aprBps,
            offer.duration,
            msg.value
        );

        emit OfferAccepted(offerId, offer.requestId);
    }

    /**
     * @notice Gets the details of a borrow request
     * @param requestId The ID of the borrow request
     * @return The BorrowRequest struct
     */
    function getBorrowRequest(uint256 requestId) external view returns (BorrowRequest memory) {
        return requests[requestId];
    }

    /**
     * @notice Gets the details of a lender offer
     * @param offerId The ID of the offer
     * @return The LenderOffer struct
     */
    function getLenderOffer(uint256 offerId) external view returns (LenderOffer memory) {
        return offers[offerId];
    }
    
    /**
     * @notice Retrieves a list of open borrow requests
     * @return An array of BorrowRequest structs
     */
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
