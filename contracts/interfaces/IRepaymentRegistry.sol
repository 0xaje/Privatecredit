// SPDX-License-Identifier: MIT
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
