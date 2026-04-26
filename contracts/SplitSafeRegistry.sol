// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract SplitSafeRegistry {
    struct GroupRecord {
        uint256 id;
        string name;
        address createdBy;
        uint256 createdAt;
    }

    struct ExpenseRecord {
        uint256 id;
        uint256 groupId;
        string title;
        uint256 amount;
        address paidBy;
        uint256 createdAt;
    }

    uint256 public nextGroupId = 1;
    uint256 public nextExpenseId = 1;
    uint256 public nextSettlementId = 1;

    mapping(uint256 => GroupRecord) public groups;
    mapping(uint256 => ExpenseRecord) public expenses;

    event GroupCreated(
        uint256 indexed groupId,
        string name,
        address indexed createdBy
    );

    event ExpenseRecorded(
        uint256 indexed groupId,
        uint256 indexed expenseId,
        string title,
        uint256 amount,
        address indexed paidBy
    );

    event SettlementRecorded(
        uint256 indexed groupId,
        uint256 indexed settlementId,
        address indexed sender,
        address receiver,
        uint256 amount,
        string txHash
    );

    function recordGroup(string calldata name) external returns (uint256 groupId) {
        groupId = nextGroupId++;

        groups[groupId] = GroupRecord({
            id: groupId,
            name: name,
            createdBy: msg.sender,
            createdAt: block.timestamp
        });

        emit GroupCreated(groupId, name, msg.sender);
    }

    function recordExpense(
        uint256 groupId,
        string calldata title,
        uint256 amount,
        address paidBy
    ) external returns (uint256 expenseId) {
        require(groups[groupId].id != 0, "GROUP_NOT_FOUND");

        expenseId = nextExpenseId++;

        expenses[expenseId] = ExpenseRecord({
            id: expenseId,
            groupId: groupId,
            title: title,
            amount: amount,
            paidBy: paidBy,
            createdAt: block.timestamp
        });

        emit ExpenseRecorded(groupId, expenseId, title, amount, paidBy);
    }

    function recordSettlement(
        uint256 groupId,
        address receiver,
        uint256 amount,
        string calldata txHash
    ) external returns (uint256 settlementId) {
        require(groups[groupId].id != 0, "GROUP_NOT_FOUND");

        settlementId = nextSettlementId++;

        emit SettlementRecorded(
            groupId,
            settlementId,
            msg.sender,
            receiver,
            amount,
            txHash
        );
    }
}
