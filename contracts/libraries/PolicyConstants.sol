// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

library PolicyConstants {
    uint256 public constant LOW_RISK_MAX_CREDIT = 10000e18;
    uint256 public constant MEDIUM_RISK_MAX_CREDIT = 5000e18;
    uint256 public constant HIGH_RISK_MAX_CREDIT = 2000e18;

    uint256 public constant LOW_RISK_MAX_LTV_BPS = 6500;
    uint256 public constant MEDIUM_RISK_MAX_LTV_BPS = 5000;
    uint256 public constant HIGH_RISK_MAX_LTV_BPS = 3500;

    uint256 public constant DEFAULT_ELIGIBILITY_DURATION = 30 days;
    uint256 public constant MIN_COLLATERAL_BPS = 1000;
    uint256 public constant BPS_DENOMINATOR = 10000;
    uint256 public constant MAX_APR_BPS = 5000;
    uint256 public constant MAX_LOAN_DURATION = 365 days;
}
