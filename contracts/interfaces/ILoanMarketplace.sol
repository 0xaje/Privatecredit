// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {BorrowRequest, LenderOffer} from "../libraries/CreditTypes.sol";

interface ILoanMarketplace {
    event RequestCreated(uint256 indexed requestId, address indexed borrower, uint256 amount);
    event RequestCancelled(uint256 indexed requestId);
    event OfferCreated(uint256 indexed offerId, uint256 indexed requestId, address indexed lender);
    event OfferWithdrawn(uint256 indexed offerId);
    event OfferAccepted(uint256 indexed offerId, uint256 indexed requestId);

    error InvalidRequest();
    error RequestNotOpen(uint256 requestId);
    error OfferNotPending(uint256 offerId);
    error NotRequestOwner(address caller, uint256 requestId);
    error NotOfferOwner(address caller, uint256 offerId);
    error InsufficientEligibility(address borrower);

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
    ) external returns (uint256 requestId);

    /**
     * @notice Cancels an open borrow request
     * @param requestId The ID of the request to cancel
     */
    function cancelBorrowRequest(uint256 requestId) external;

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
    ) external payable returns (uint256 offerId);

    /**
     * @notice Withdraws a pending offer
     * @param offerId The ID of the offer to withdraw
     */
    function withdrawOffer(uint256 offerId) external;

    /**
     * @notice Accepts a lender offer for a borrow request
     * @param offerId The ID of the offer to accept
     */
    function acceptOffer(uint256 offerId) external payable;

    /**
     * @notice Gets the details of a borrow request
     * @param requestId The ID of the borrow request
     * @return The BorrowRequest struct
     */
    function getBorrowRequest(uint256 requestId) external view returns (BorrowRequest memory);

    /**
     * @notice Gets the details of a lender offer
     * @param offerId The ID of the offer
     * @return The LenderOffer struct
     */
    function getLenderOffer(uint256 offerId) external view returns (LenderOffer memory);

    /**
     * @notice Retrieves a list of open borrow requests
     * @return An array of BorrowRequest structs
     */
    function getOpenRequests() external view returns (BorrowRequest[] memory);
}
