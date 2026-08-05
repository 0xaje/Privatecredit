// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Loan} from "../libraries/CreditTypes.sol";

interface ILoanVault {
    event LoanOriginated(uint256 indexed loanId, address indexed borrower, address indexed lender, uint256 principal);
    event LoanRepaid(uint256 indexed loanId, uint256 amount);
    event LoanDefaulted(uint256 indexed loanId);
    event CollateralSeized(uint256 indexed loanId, address indexed lender, uint256 amount);

    error LoanNotActive(uint256 loanId);
    error NotBorrower(address caller, uint256 loanId);
    error NotLender(address caller, uint256 loanId);
    error InsufficientRepayment(uint256 loanId, uint256 amount, uint256 required);
    error LoanNotDefaulted(uint256 loanId);
    error LoanNotExpired(uint256 loanId);

    /**
     * @notice Originates a new loan
     * @param borrower The borrower address
     * @param lender The lender address
     * @param principal The loan principal amount
     * @param aprBps The APR in basis points
     * @param duration The loan duration
     * @param collateralAmount The collateral amount
     * @return loanId The ID of the originated loan
     */
    function originateLoan(
        address borrower,
        address lender,
        uint256 principal,
        uint256 aprBps,
        uint256 duration,
        uint256 collateralAmount
    ) external payable returns (uint256 loanId);

    /**
     * @notice Repays an active loan
     * @param loanId The ID of the loan to repay
     */
    function repayLoan(uint256 loanId) external payable;

    /**
     * @notice Declares a loan as defaulted
     * @param loanId The ID of the loan
     */
    function declareDefault(uint256 loanId) external;

    /**
     * @notice Retrieves loan details
     * @param loanId The ID of the loan
     * @return The Loan struct
     */
    function getLoan(uint256 loanId) external view returns (Loan memory);

    /**
     * @notice Calculates the interest owed on a loan
     * @param loanId The ID of the loan
     * @return The calculated interest
     */
    function calculateInterest(uint256 loanId) external view returns (uint256);

    /**
     * @notice Calculates the total amount owed (principal + interest - repaid)
     * @param loanId The ID of the loan
     * @return The total amount owed
     */
    function calculateTotalOwed(uint256 loanId) external view returns (uint256);
}
