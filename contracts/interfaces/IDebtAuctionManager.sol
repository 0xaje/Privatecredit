// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IDebtAuctionManager {
    enum AuctionStatus { NONE, ACTIVE, SETTLED, CANCELLED }

    struct DebtAuction {
        uint256 auctionId;
        uint256 loanId;
        address borrower;
        address lender;
        uint256 principal;
        uint256 collateralAmount;
        uint256 reservePrice;
        uint256 highestBid;
        address highestBidder;
        uint256 startTime;
        uint256 endTime;
        AuctionStatus status;
    }

    event AuctionCreated(
        uint256 indexed auctionId,
        uint256 indexed loanId,
        address indexed lender,
        uint256 principal,
        uint256 reservePrice,
        uint256 endTime
    );

    event BidPlaced(
        uint256 indexed auctionId,
        address indexed bidder,
        uint256 amount
    );

    event AuctionSettled(
        uint256 indexed auctionId,
        address indexed winner,
        uint256 winningBid,
        uint256 lenderPayout,
        uint256 collateralClaimed
    );

    event AuctionCancelled(uint256 indexed auctionId);

    function createAuction(
        uint256 loanId,
        address borrower,
        address lender,
        uint256 principal,
        uint256 collateralAmount,
        uint256 reservePrice,
        uint256 duration
    ) external returns (uint256 auctionId);

    function placeBid(uint256 auctionId) external payable;
    function settleAuction(uint256 auctionId) external;
    function getAuction(uint256 auctionId) external view returns (DebtAuction memory);
}
