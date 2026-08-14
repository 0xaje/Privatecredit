// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "../libraries/CreditTypes.sol";
import "../interfaces/ICapacityManager.sol";
import "../interfaces/IEligibilityRegistry.sol";

contract CapacityManager is Ownable, ICapacityManager {
    mapping(address => uint256) private _usedCapacity;
    mapping(address => uint256) private _defaultedLockedCapacity;
    IEligibilityRegistry public immutable eligibilityRegistry;
    mapping(address => bool) public authorizedCallers;

    constructor(address _eligibilityRegistry) Ownable(msg.sender) {
        require(_eligibilityRegistry != address(0), "zero eligibility registry");
        eligibilityRegistry = IEligibilityRegistry(_eligibilityRegistry);
    }

    function setAuthorizedCaller(address caller, bool authorized) external onlyOwner {
        require(caller != address(0), "zero caller");
        authorizedCallers[caller] = authorized;
    }

    modifier onlyAuthorized() {
        if (!authorizedCallers[msg.sender]) revert UnauthorizedCaller();
        _;
    }

    function reserveCapacity(address borrower, uint256 amount) external onlyAuthorized {
        if (borrower == address(0) || amount == 0) revert InvalidEligibility();
        if (!eligibilityRegistry.isEligibilityValid(borrower)) revert InvalidEligibility();
        if (amount > availableCapacity(borrower)) revert ExceedsAvailableCapacity();
        _usedCapacity[borrower] += amount;
        emit CapacityReserved(borrower, amount);
    }

    function releaseCapacity(address borrower, uint256 amount) external onlyAuthorized {
        if (amount == 0 || amount > _usedCapacity[borrower]) revert InvalidCapacityRelease();
        _usedCapacity[borrower] -= amount;
        emit CapacityReleased(borrower, amount);
    }

    function lockDefaultedCapacity(address borrower, uint256 amount) external onlyAuthorized {
        if (amount == 0 || amount > _usedCapacity[borrower]) revert InvalidCapacityRelease();
        _usedCapacity[borrower] -= amount;
        _defaultedLockedCapacity[borrower] += amount;
        emit DefaultCapacityLocked(borrower, amount);
    }

    function availableCapacity(address borrower) public view returns (uint256) {
        if (!eligibilityRegistry.isEligibilityValid(borrower)) return 0;
        Eligibility memory e = eligibilityRegistry.getEligibility(borrower);
        uint256 consumed = _usedCapacity[borrower] + _defaultedLockedCapacity[borrower];
        if (consumed >= e.maxActiveCredit) return 0;
        return e.maxActiveCredit - consumed;
    }

    function getUsedCapacity(address borrower) external view returns (uint256) {
        return _usedCapacity[borrower];
    }

    function getDefaultedLockedCapacity(address borrower) external view returns (uint256) {
        return _defaultedLockedCapacity[borrower];
    }

    function getTotalConsumedCapacity(address borrower) external view returns (uint256) {
        return _usedCapacity[borrower] + _defaultedLockedCapacity[borrower];
    }

    function canBorrow(address borrower, uint256 amount) external view returns (bool) {
        return amount > 0 && availableCapacity(borrower) >= amount;
    }
}
