// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {RepaymentRecord, RepaymentOutcome} from "../libraries/CreditTypes.sol";

interface IRepaymentRegistry {
    event RepaymentRecorded(uint256 indexed loanId, address indexed borrower, uint256 amount, RepaymentOutcome outcome);

    /**
     * @notice Records a repayment outcome
     * @param loanId The ID of the loan
     * @param borrower The borrower address
     * @param amount The repayment amount
     * @param outcome The outcome of the repayment
     */
    function recordRepayment(
        uint256 loanId,
        address borrower,
        uint256 amount,
        RepaymentOutcome outcome
    ) external;

    /**
     * @notice Retrieves a specific repayment record
     * @param loanId The ID of the loan
     * @return The repayment record
     */
    function getRepayment(uint256 loanId) external view returns (RepaymentRecord memory);

    /**
     * @notice Retrieves all repayment loan IDs for a borrower
     * @param borrower The borrower address
     * @return Array of loan IDs
     */
    function getBorrowerRepayments(address borrower) external view returns (uint256[] memory);

    /**
     * @notice Gets the total number of repayments for a borrower
     * @param borrower The borrower address
     * @return The count of repayments
     */
    function getBorrowerRepaymentCount(address borrower) external view returns (uint256);
}
