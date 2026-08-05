// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {CapacityManager} from "./core/CapacityManager.sol";
import {ICapacityManager} from "./interfaces/ICapacityManager.sol";
import {EligibilityRegistry} from "./core/EligibilityRegistry.sol";
import {RiskTier} from "./libraries/CreditTypes.sol";

contract CapacityManagerTest is Test {
    CapacityManager capacityManager;
    EligibilityRegistry eligibilityRegistry;
    address owner = address(1);
    address registrar = address(2);
    address borrower = address(3);
    address vault = address(4);

    function setUp() public {
        vm.startPrank(owner);
        eligibilityRegistry = new EligibilityRegistry();
        capacityManager = new CapacityManager(address(eligibilityRegistry));
        
        eligibilityRegistry.setRegistrar(registrar);
        capacityManager.setAuthorizedCaller(vault, true);
        vm.stopPrank();

        // Register eligibility
        vm.prank(registrar);
        eligibilityRegistry.registerEligibility(
            borrower,
            RiskTier.LOW,
            5000e18,
            6500,
            block.timestamp + 30 days,
            1,
            bytes32(0),
            bytes32(0)
        );
    }

    function test_AvailableCapacityIsMaxCredit() public view {
        uint256 available = capacityManager.availableCapacity(borrower);
        assertEq(available, 5000e18);
    }

    function test_ReserveCapacityDecreasesAvailable() public {
        vm.prank(vault);
        capacityManager.reserveCapacity(borrower, 1000e18);
        
        uint256 available = capacityManager.availableCapacity(borrower);
        assertEq(available, 4000e18);
        
        uint256 used = capacityManager.getUsedCapacity(borrower);
        assertEq(used, 1000e18);
    }

    function test_CannotReserveMoreThanAvailable() public {
        vm.prank(vault);
        vm.expectRevert(ICapacityManager.ExceedsAvailableCapacity.selector);
        capacityManager.reserveCapacity(borrower, 6000e18);
    }

    function test_OnlyAuthorizedCallerCanReserve() public {
        vm.prank(borrower);
        vm.expectRevert(ICapacityManager.UnauthorizedCaller.selector);
        capacityManager.reserveCapacity(borrower, 1000e18);
    }
}
