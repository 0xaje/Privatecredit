// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "../libraries/CreditTypes.sol";
import "../interfaces/ICapacityManager.sol";
import "../interfaces/IEligibilityRegistry.sol";

contract CapacityManager is Ownable, ICapacityManager {
    mapping(address => uint256) private _usedCapacity;
    IEligibilityRegistry public eligibilityRegistry;
    mapping(address => bool) public authorizedCallers;

    constructor(address _eligibilityRegistry) Ownable(msg.sender) {
        eligibilityRegistry = IEligibilityRegistry(_eligibilityRegistry);
    }

    function setAuthorizedCaller(address caller, bool authorized) external onlyOwner {
        authorizedCallers[caller] = authorized;
    }

    modifier onlyAuthorized() {
        if (!authorizedCallers[msg.sender]) revert UnauthorizedCaller();
        _;
    }

    /**
     * @notice Reserves capacity for a borrower
     */
    function reserveCapacity(address borrower, uint256 amount) external onlyAuthorized {
        if (!eligibilityRegistry.isEligibilityValid(borrower)) revert InvalidEligibility();
        
        uint256 available = availableCapacity(borrower);
        if (amount > available) revert ExceedsAvailableCapacity();

        _usedCapacity[borrower] += amount;
        emit CapacityReserved(borrower, amount);
    }

    /**
     * @notice Releases previously reserved capacity
     */
    function releaseCapacity(address borrower, uint256 amount) external onlyAuthorized {
        if (_usedCapacity[borrower] < amount) {
            _usedCapacity[borrower] = 0;
        } else {
            _usedCapacity[borrower] -= amount;
        }
        emit CapacityReleased(borrower, amount);
    }

    /**
     * @notice Calculates the available capacity for a borrower
     */
    function availableCapacity(address borrower) public view returns (uint256) {
        if (!eligibilityRegistry.isEligibilityValid(borrower)) return 0;
        
        Eligibility memory e = eligibilityRegistry.getEligibility(borrower);
        uint256 used = _usedCapacity[borrower];
        
        if (used >= e.maxActiveCredit) return 0;
        return e.maxActiveCredit - used;
    }

    /**
     * @notice Gets the total used capacity for a borrower
     */
    function getUsedCapacity(address borrower) external view returns (uint256) {
        return _usedCapacity[borrower];
    }

    /**
     * @notice Checks if a borrower can borrow a specific amount
     */
    function canBorrow(address borrower, uint256 amount) external view returns (bool) {
        return availableCapacity(borrower) >= amount;
    }
}
