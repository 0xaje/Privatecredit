// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import "../usc/VerifierInterface.sol";

/**
 * @title MockAcceptingVerifier
 * @notice Test double for the Creditcoin 0x0FD2 BlockProver precompile that accepts every proof.
 * @dev Deployed in tests and installed at the precompile address via `setCode`, since the native
 *      precompile only exists on Creditcoin networks and not on the local Hardhat EVM.
 *      Stateless by design so it behaves identically once relocated to 0x0FD2.
 */
contract MockAcceptingVerifier is INativeQueryVerifier {
    function verify(
        uint64,
        uint64,
        bytes calldata,
        MerkleProof calldata,
        ContinuityProof calldata
    ) external pure returns (bool) {
        return true;
    }
}

/**
 * @title MockRejectingVerifier
 * @notice Test double for the 0x0FD2 precompile that rejects every proof.
 * @dev Used to assert that USCVerifier refuses to record evidence when SPV/Merkle
 *      verification fails, rather than trusting the caller-supplied transaction.
 */
contract MockRejectingVerifier is INativeQueryVerifier {
    function verify(
        uint64,
        uint64,
        bytes calldata,
        MerkleProof calldata,
        ContinuityProof calldata
    ) external pure returns (bool) {
        return false;
    }
}
