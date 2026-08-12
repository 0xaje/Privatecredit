// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {CapacityManager} from "./core/CapacityManager.sol";
import {ICapacityManager} from "./interfaces/ICapacityManager.sol";
import {EligibilityRegistry} from "./core/EligibilityRegistry.sol";
import {RiskTier, EligibilityParams, AttestcoinProof} from "./libraries/CreditTypes.sol";
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

        // 1. Mock the Attestcoin Precompile to always return true for our dummy inputs
        vm.mockCall(
            address(0x0FD2),
            abi.encode(uint64(0), uint64(0), bytes(""), bytes(""), bytes("")),
            abi.encode(true)
        );

        // 2. Generate Registrar Signature
        // We use a dummy private key for the registrar: 0x2
        uint256 registrarPk = 2;
        // The registrar address derived from pk 2 is: 0x2B5AD5c4795c026514f8317c7a215E218DcCD6cF
        // So we need to set the registrar to this address instead of address(2)
        vm.prank(owner);
        eligibilityRegistry.setRegistrar(vm.addr(registrarPk));

        bytes32 messageHash = keccak256(abi.encodePacked(
            borrower, RiskTier.LOW, uint256(5000e18), uint256(6500), block.timestamp + 30 days, uint256(1), bytes32(0), uint256(1), block.chainid, address(eligibilityRegistry)
        ));
        bytes32 ethSignedMessageHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", messageHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(registrarPk, ethSignedMessageHash);

        // 3. Register eligibility as the borrower
        vm.prank(borrower);
        eligibilityRegistry.registerEligibility(
            EligibilityParams({
                riskTier: RiskTier.LOW,
                maxActiveCredit: 5000e18,
                maxLtvBps: 6500,
                validUntil: block.timestamp + 30 days,
                policyVersion: 1,
                evidenceCommitment: bytes32(0)
            }),
            v, r, s,
            AttestcoinProof({
                chainKey: 0,
                headerNumber: 0,
                txBytes: bytes(""),
                merkleProof: bytes(""),
                continuityProof: bytes("")
            })
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
