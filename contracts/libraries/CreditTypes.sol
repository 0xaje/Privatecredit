// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

enum RiskTier { LOW, MEDIUM, HIGH }
enum RequestStatus { OPEN, FUNDED, CANCELLED }
enum OfferStatus { PENDING, ACCEPTED, WITHDRAWN }
enum LoanStatus { ACTIVE, REPAID, DEFAULTED }
enum RepaymentOutcome { ON_TIME, LATE, DEFAULT }
enum VerificationStatus { PENDING, CONFIRMED, REJECTED, EXPIRED }

struct EligibilityParams {
    RiskTier riskTier;
    uint256 maxActiveCredit;
    uint256 maxLtvBps;
    uint256 validUntil;
    uint256 policyVersion;
    bytes32 evidenceCommitment;
}

struct AttestcoinProof {
    uint64 chainKey;
    uint64 headerNumber;
    bytes txBytes;
    bytes merkleProof;
    bytes continuityProof;
}

struct Eligibility {
    address borrower;
    RiskTier riskTier;
    uint256 maxActiveCredit;
    uint256 maxLtvBps;
    uint256 validUntil;
    uint256 policyVersion;
    bytes32 evidenceCommitment;
    bytes32 attestcoinContext;
    uint256 nonce;
    bool active;
}

struct BorrowRequest {
    uint256 requestId;
    address borrower;
    uint256 amount;
    uint256 maxAprBps;
    uint256 maxDuration;
    uint256 collateralAmount;
    RequestStatus status;
    uint256 createdAt;
}

struct LenderOffer {
    uint256 offerId;
    uint256 requestId;
    address lender;
    uint256 aprBps;
    uint256 duration;
    uint256 requiredCollateral;
    OfferStatus status;
    uint256 createdAt;
}

struct Loan {
    uint256 loanId;
    address borrower;
    address lender;
    uint256 principal;
    uint256 aprBps;
    uint256 startTime;
    uint256 duration;
    uint256 collateralAmount;
    uint256 repaidAmount;
    LoanStatus status;
}

struct RepaymentRecord {
    uint256 loanId;
    address borrower;
    uint256 amount;
    uint256 timestamp;
    RepaymentOutcome outcome;
}

struct Artefact {
    bytes32 artefactId;
    address creator;
    bytes32 snapshotCommitment;
    uint256 eligibilityNonce;
    bytes32 policyReference;
    uint256 timestamp;
    string contentReference;
}
