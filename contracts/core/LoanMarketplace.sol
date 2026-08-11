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
