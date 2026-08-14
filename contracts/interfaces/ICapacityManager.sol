// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface ICapacityManager {
    event CapacityReserved(address indexed borrower, uint256 amount);
    event CapacityReleased(address indexed borrower, uint256 amount);
    event DefaultCapacityLocked(address indexed borrower, uint256 amount);

    error UnauthorizedCaller();
    error ExceedsAvailableCapacity();
    error InvalidEligibility();
    error InvalidCapacityRelease();

    function reserveCapacity(address borrower, uint256 amount) external;
    function releaseCapacity(address borrower, uint256 amount) external;
    function lockDefaultedCapacity(address borrower, uint256 amount) external;
    function availableCapacity(address borrower) external view returns (uint256);
    function getUsedCapacity(address borrower) external view returns (uint256);
    function getDefaultedLockedCapacity(address borrower) external view returns (uint256);
    function getTotalConsumedCapacity(address borrower) external view returns (uint256);
    function canBorrow(address borrower, uint256 amount) external view returns (bool);
}
