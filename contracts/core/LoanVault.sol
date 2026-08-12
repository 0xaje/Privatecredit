// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "../libraries/CreditTypes.sol";
import "../libraries/PolicyConstants.sol";
import "../interfaces/ILoanVault.sol";
import "../interfaces/ICapacityManager.sol";
import "../interfaces/IRepaymentRegistry.sol";

contract LoanVault is Ownable, ReentrancyGuard, Pausable, ILoanVault {
    mapping(uint256 => Loan) public loans;
    uint256 public nextLoanId = 1;

    ICapacityManager public capacityManager;
    IRepaymentRegistry public repaymentRegistry;
    address public marketplace;

    error Unauthorized();
    error TransferFailed();

    constructor(address _capacityManager) Ownable(msg.sender) {
        capacityManager = ICapacityManager(_capacityManager);
    }

    function setMarketplace(address _marketplace) external onlyOwner {
        marketplace = _marketplace;
    }

    function setRepaymentRegistry(address _repaymentRegistry) external onlyOwner {
        repaymentRegistry = IRepaymentRegistry(_repaymentRegistry);
    }

    modifier onlyMarketplace() {
        if (msg.sender != marketplace) revert Unauthorized();
        _;
    }

    function originateLoan(
        address borrower,
        address lender,
        uint256 principal,
        uint256 aprBps,
        uint256 duration,
        uint256 collateralAmount
    ) external payable onlyMarketplace whenNotPaused returns (uint256) {
        if (msg.value != principal + collateralAmount) revert Unauthorized();
        
        capacityManager.reserveCapacity(borrower, principal);

        uint256 loanId = nextLoanId++;
        loans[loanId] = Loan({
            loanId: loanId,
            borrower: borrower,
            lender: lender,
            principal: principal,
            aprBps: aprBps,
            startTime: block.timestamp,
            duration: duration,
            collateralAmount: collateralAmount,
            repaidAmount: 0,
            status: LoanStatus.ACTIVE
        });

        emit LoanOriginated(loanId, borrower, lender, principal);

        (bool success, ) = borrower.call{value: principal}("");
        if (!success) revert TransferFailed();

        return loanId;
    }

    function repayLoan(uint256 loanId) external payable nonReentrant whenNotPaused {
        Loan storage loan = loans[loanId];
        if (loan.borrower != msg.sender) revert NotBorrower(msg.sender, loanId);
        if (loan.status != LoanStatus.ACTIVE) revert LoanNotActive(loanId);

        uint256 totalOwed = calculateTotalOwed(loanId);
        if (msg.value < totalOwed) revert InsufficientRepayment(loanId, msg.value, totalOwed);

        loan.repaidAmount += totalOwed;
        loan.status = LoanStatus.REPAID;

        capacityManager.releaseCapacity(loan.borrower, loan.principal);

        uint256 excess = msg.value - totalOwed;
        uint256 toBorrower = loan.collateralAmount + excess;

        RepaymentOutcome outcome = block.timestamp <= loan.startTime + loan.duration 
            ? RepaymentOutcome.ON_TIME 
            : RepaymentOutcome.LATE;

        if (address(repaymentRegistry) != address(0)) {
            repaymentRegistry.recordRepayment(loanId, loan.borrower, msg.value, outcome);
        }

        emit LoanRepaid(loanId, msg.value);

        if (toBorrower > 0) {
            (bool success, ) = loan.borrower.call{value: toBorrower}("");
            if (!success) revert TransferFailed();
        }

        (bool successLender, ) = loan.lender.call{value: totalOwed}("");
        if (!successLender) revert TransferFailed();
    }
    


    function declareDefault(uint256 loanId) external nonReentrant whenNotPaused {
        Loan storage loan = loans[loanId];
        if (loan.status != LoanStatus.ACTIVE) revert LoanNotActive(loanId);
        if (block.timestamp <= loan.startTime + loan.duration) revert LoanNotExpired(loanId);

        loan.status = LoanStatus.DEFAULTED;

        if (address(repaymentRegistry) != address(0)) {
            repaymentRegistry.recordRepayment(loanId, loan.borrower, 0, RepaymentOutcome.DEFAULT);
        }

        emit LoanDefaulted(loanId);
        emit CollateralSeized(loanId, loan.lender, loan.collateralAmount);

        (bool success, ) = loan.lender.call{value: loan.collateralAmount}("");
        if (!success) revert TransferFailed();
    }

    function getLoan(uint256 loanId) external view returns (Loan memory) {
        return loans[loanId];
    }

    function calculateInterest(uint256 loanId) public view returns (uint256) {
        Loan storage loan = loans[loanId];
        uint256 elapsed = block.timestamp - loan.startTime;
        return (loan.principal * loan.aprBps * elapsed) / (PolicyConstants.BPS_DENOMINATOR * 365 days);
    }

    function calculateTotalOwed(uint256 loanId) public view returns (uint256) {
        Loan storage loan = loans[loanId];
        return loan.principal + calculateInterest(loanId) - loan.repaidAmount;
    }
}
