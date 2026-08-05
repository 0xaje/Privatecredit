// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface ICapacityManager {
    event CapacityReserved(address indexed borrower, uint256 amount);
    event CapacityReleased(address indexed borrower, uint256 amount);

    error UnauthorizedCaller();
    error ExceedsAvailableCapacity();
    error InvalidEligibility();

    /**
     * @notice Reserves capacity for a borrower
     * @param borrower The borrower address
     * @param amount The amount to reserve
     */
    function reserveCapacity(address borrower, uint256 amount) external;

    /**
     * @notice Releases capacity for a borrower
     * @param borrower The borrower address
     * @param amount The amount to release
     */
    function releaseCapacity(address borrower, uint256 amount) external;

    /**
     * @notice Retrieves the available capacity for a borrower
     * @param borrower The borrower address
     * @return The available capacity
     */
    function availableCapacity(address borrower) external view returns (uint256);

    /**
     * @notice Retrieves the used capacity for a borrower
     * @param borrower The borrower address
     * @return The used capacity
     */
    function getUsedCapacity(address borrower) external view returns (uint256);

    /**
     * @notice Checks if a borrower can borrow a specific amount
     * @param borrower The borrower address
     * @param amount The amount to check
     * @return True if can borrow, false otherwise
     */
    function canBorrow(address borrower, uint256 amount) external view returns (bool);
}
