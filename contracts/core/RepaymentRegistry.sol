// SPDX-License-Identifier: MIT
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

    /**
     * @notice Sets the authorized recorder address
     * @param _recorder The authorized recorder address
     */
    function setAuthorizedRecorder(address _recorder) external onlyOwner {
        authorizedRecorder = _recorder;
    }

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

    /**
     * @notice Retrieves a specific repayment record
     * @param loanId The ID of the loan
     * @return The repayment record
     */
    function getRepayment(uint256 loanId) external view returns (RepaymentRecord memory) {
        return records[loanId];
    }

    /**
     * @notice Retrieves all repayment loan IDs for a borrower
     * @param borrower The borrower address
     * @return Array of loan IDs
     */
    function getBorrowerRepayments(address borrower) external view returns (uint256[] memory) {
        return borrowerRepayments[borrower];
    }

    /**
     * @notice Gets the total number of repayments for a borrower
     * @param borrower The borrower address
     * @return The count of repayments
     */
    function getBorrowerRepaymentCount(address borrower) external view returns (uint256) {
        return borrowerRepayments[borrower].length;
    }
}
