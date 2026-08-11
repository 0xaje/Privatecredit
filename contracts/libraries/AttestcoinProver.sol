// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

library AttestcoinProver {
    address constant PRECOMPILE = address(0x0FD2);

    /**
     * @notice Verifies an Attestcoin proof using the 0x0FD2 Creditcoin precompile.
     * @param chainKey The source chain ID (e.g. 1 for Ethereum)
     * @param headerNumber The block number where the tx was included
     * @param txBytes The raw RLP encoded transaction
     * @param merkleProof The merkle proof connecting the tx to the block root
     * @param continuityProof The proof connecting the block root to the finalized state
     * @return True if the proof is valid, false otherwise
     */
    function verify(
        uint64 chainKey,
        uint64 headerNumber,
        bytes memory txBytes,
        bytes memory merkleProof,
        bytes memory continuityProof
    ) internal view returns (bool) {
        (bool success, bytes memory result) = PRECOMPILE.staticcall(
            abi.encode(chainKey, headerNumber, txBytes, merkleProof, continuityProof)
        );
        if (!success) return false;
        return abi.decode(result, (bool));
    }
}
