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
