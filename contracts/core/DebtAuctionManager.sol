// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "../interfaces/IDebtAuctionManager.sol";

/**
 * @title DebtAuctionManager
 * @notice On-chain secondary recovery auction engine for defaulted PrivateCredit loans.
 * Lenders can list defaulted debt notes to recover liquidity from liquidators/investors.
 */
contract DebtAuctionManager is Ownable, ReentrancyGuard, Pausable, IDebtAuctionManager {
    uint256 public nextAuctionId = 1;
    mapping(uint256 => DebtAuction) public auctions;
    mapping(uint256 => uint256) public loanToAuction;

    address public loanVault;

    error Unauthorized();
    error TransferFailed();
    error AuctionNotActive(uint256 auctionId);
    error AuctionAlreadyExists(uint256 loanId);
    error BidTooLow(uint256 minimumBid, uint256 providedBid);
    error AuctionStillOngoing(uint256 auctionId, uint256 endTime);
    error AuctionExpired(uint256 auctionId);
    error InvalidAuctionTerms();

    modifier onlyVaultOrOwner() {
        if (msg.sender != loanVault && msg.sender != owner()) revert Unauthorized();
        _;
    }

    constructor(address _loanVault) Ownable(msg.sender) {
        loanVault = _loanVault;
    }

    function setLoanVault(address _loanVault) external onlyOwner {
        require(_loanVault != address(0), "zero loan vault");
        loanVault = _loanVault;
    }

    /**
     * @notice Creates an on-chain liquidation/debt recovery auction for a defaulted loan.
     */
    function createAuction(
        uint256 loanId,
        address borrower,
        address lender,
        uint256 principal,
        uint256 collateralAmount,
        uint256 reservePrice,
        uint256 duration
    ) external onlyVaultOrOwner whenNotPaused returns (uint256 auctionId) {
        if (principal == 0 || duration == 0 || lender == address(0)) revert InvalidAuctionTerms();
        if (loanToAuction[loanId] != 0 && auctions[loanToAuction[loanId]].status == AuctionStatus.ACTIVE) {
            revert AuctionAlreadyExists(loanId);
        }

        auctionId = nextAuctionId++;
        uint256 endTime = block.timestamp + duration;

        auctions[auctionId] = DebtAuction({
            auctionId: auctionId,
            loanId: loanId,
            borrower: borrower,
            lender: lender,
            principal: principal,
            collateralAmount: collateralAmount,
            reservePrice: reservePrice,
            highestBid: 0,
            highestBidder: address(0),
            startTime: block.timestamp,
            endTime: endTime,
            status: AuctionStatus.ACTIVE
        });

        loanToAuction[loanId] = auctionId;

        emit AuctionCreated(auctionId, loanId, lender, principal, reservePrice, endTime);
    }

    /**
     * @notice Places a bid on an active debt recovery auction.
     */
    function placeBid(uint256 auctionId) external payable nonReentrant whenNotPaused {
        DebtAuction storage auction = auctions[auctionId];
        if (auction.status != AuctionStatus.ACTIVE) revert AuctionNotActive(auctionId);
        if (block.timestamp > auction.endTime) revert AuctionExpired(auctionId);

        uint256 minBid = auction.highestBid == 0 ? auction.reservePrice : auction.highestBid + (auction.highestBid * 5 / 100);
        if (msg.value < minBid) revert BidTooLow(minBid, msg.value);

        // Refund previous highest bidder
        if (auction.highestBidder != address(0)) {
            (bool refundSuccess, ) = auction.highestBidder.call{value: auction.highestBid}("");
            if (!refundSuccess) revert TransferFailed();
        }

        auction.highestBid = msg.value;
        auction.highestBidder = msg.sender;

        emit BidPlaced(auctionId, msg.sender, msg.value);
    }

    /**
     * @notice Settles an ended auction, paying the lender the recovery proceeds and transferring rights.
     */
    function settleAuction(uint256 auctionId) external nonReentrant whenNotPaused {
        DebtAuction storage auction = auctions[auctionId];
        if (auction.status != AuctionStatus.ACTIVE) revert AuctionNotActive(auctionId);
        if (block.timestamp <= auction.endTime) revert AuctionStillOngoing(auctionId, auction.endTime);

        auction.status = AuctionStatus.SETTLED;

        if (auction.highestBidder != address(0)) {
            uint256 payout = auction.highestBid;
            (bool paidLender, ) = auction.lender.call{value: payout}("");
            if (!paidLender) revert TransferFailed();

            emit AuctionSettled(
                auctionId,
                auction.highestBidder,
                auction.highestBid,
                payout,
                auction.collateralAmount
            );
        } else {
            // No bids received: auction closes without bids
            auction.status = AuctionStatus.CANCELLED;
            emit AuctionCancelled(auctionId);
        }
    }

    function getAuction(uint256 auctionId) external view returns (DebtAuction memory) {
        return auctions[auctionId];
    }

    function getOpenAuctions() external view returns (DebtAuction[] memory) {
        uint256 count = 0;
        for (uint256 i = 1; i < nextAuctionId; i++) {
            if (auctions[i].status == AuctionStatus.ACTIVE) {
                count++;
            }
        }
        DebtAuction[] memory openList = new DebtAuction[](count);
        uint256 idx = 0;
        for (uint256 i = 1; i < nextAuctionId; i++) {
            if (auctions[i].status == AuctionStatus.ACTIVE) {
                openList[idx] = auctions[i];
                idx++;
            }
        }
        return openList;
    }
}
