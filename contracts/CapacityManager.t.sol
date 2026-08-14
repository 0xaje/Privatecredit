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

        vm.prank(registrar);
        eligibilityRegistry.registerEligibility(
            borrower,
            RiskTier.LOW,
            5000e18,
            6500,
            block.timestamp + 30 days,
            1,
            keccak256("evidence"),
            keccak256("context")
        );
    }

    function test_AvailableCapacityIsMaxCredit() public view {
        assertEq(capacityManager.availableCapacity(borrower), 5000e18);
    }

    function test_ReserveCapacityDecreasesAvailable() public {
        vm.prank(vault);
        capacityManager.reserveCapacity(borrower, 1000e18);
        assertEq(capacityManager.availableCapacity(borrower), 4000e18);
        assertEq(capacityManager.getUsedCapacity(borrower), 1000e18);
    }

    function test_DefaultedCapacityRemainsLocked() public {
        vm.startPrank(vault);
        capacityManager.reserveCapacity(borrower, 1000e18);
        capacityManager.lockDefaultedCapacity(borrower, 1000e18);
        vm.stopPrank();
        assertEq(capacityManager.getUsedCapacity(borrower), 0);
        assertEq(capacityManager.getDefaultedLockedCapacity(borrower), 1000e18);
        assertEq(capacityManager.availableCapacity(borrower), 4000e18);
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
