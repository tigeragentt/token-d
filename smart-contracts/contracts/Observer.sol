// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title Observer
 * @notice On-chain registry and audit log for cross-chain token activity.
 *         Deployed on Ethereum Sepolia. Authorized CRE reporters log token
 *         actions (Transfer, Mint, Burn, …) detected on XDC, Stellar, XRPL,
 *         and any other chain the token lives on.
 */
contract Observer is AccessControl {

    bytes32 public constant REPORTER_ROLE = keccak256("REPORTER_ROLE");

    // ─── Token Registry ────────────────────────────────────────────────────

    struct TokenInfo {
        string chainName;    // human label: "XDC", "Stellar", "XRPL", …
        string tokenAddress; // native format (xdc0x…, G…, r…, 0x…)
        string tokenUrl;     // block explorer or project URL
    }

    string[]                      private _chains;
    mapping(string => TokenInfo)  private _tokenRegistry;  // chainName → info
    mapping(string => bool)       private _chainRegistered;

    // ─── Action Definitions ────────────────────────────────────────────────

    enum ActionType {
        Transfer,   // 0
        Mint,       // 1
        Burn,       // 2
        Approve,    // 3
        Freeze,     // 4
        Unfreeze,   // 5
        Other       // 6 — catch-all for chain-specific actions
    }

    // ─── Report Structure ──────────────────────────────────────────────────

    struct ReportAction {
        string     network;      // origin chain name
        ActionType action;       // action type
        string     from;         // sender address (string for cross-chain compat)
        string     to;           // receiver address
        uint256    amount;       // raw token amount on origin chain
        string     txHash;       // transaction hash on the origin network
        uint256    timestamp;    // block.timestamp when this report was submitted
        uint256    blockNumber;  // Sepolia block number when reported
    }

    ReportAction[] private _reports;

    // ─── Events ────────────────────────────────────────────────────────────

    event TokenRegistered(
        string indexed chainName,
        string         tokenAddress,
        string         tokenUrl
    );

    event ActionReported(
        uint256 indexed reportId,
        string  indexed network,
        ActionType      action,
        string          from,
        string          to,
        uint256         amount,
        string          txHash,
        uint256         timestamp
    );

    // ─── Constructor ───────────────────────────────────────────────────────

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(REPORTER_ROLE, msg.sender);
    }

    // ─── Admin: token registry ─────────────────────────────────────────────

    /**
     * @notice Register or update a token entry for a chain.
     * @param chainName     Human-readable chain identifier, e.g. "XDC".
     * @param tokenAddress  Token address in the chain's native format.
     * @param tokenUrl      Block explorer or info URL for the token.
     */
    function registerToken(
        string calldata chainName,
        string calldata tokenAddress,
        string calldata tokenUrl
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (!_chainRegistered[chainName]) {
            _chains.push(chainName);
            _chainRegistered[chainName] = true;
        }
        _tokenRegistry[chainName] = TokenInfo(chainName, tokenAddress, tokenUrl);
        emit TokenRegistered(chainName, tokenAddress, tokenUrl);
    }

    // ─── Reporter: log an action ────────────────────────────────────────────

    /**
     * @notice Report a token action detected on an external chain.
     * @param network  Origin chain name (must match a registered token, but not enforced).
     * @param action   Action type enum value.
     * @param from     Sender address (empty string for Mint with no origin).
     * @param to       Receiver address (empty string for Burn with no destination).
     * @param amount   Raw token amount as reported on the origin chain.
     * @param txHash   Transaction hash on the origin network.
     * @return reportId The index of the newly created report.
     */
    function reportAction(
        string     calldata network,
        ActionType          action,
        string     calldata from,
        string     calldata to,
        uint256             amount,
        string     calldata txHash
    ) external onlyRole(REPORTER_ROLE) returns (uint256 reportId) {
        reportId = _reports.length;
        _reports.push(ReportAction({
            network:     network,
            action:      action,
            from:        from,
            to:          to,
            amount:      amount,
            txHash:      txHash,
            timestamp:   block.timestamp,
            blockNumber: block.number
        }));
        emit ActionReported(reportId, network, action, from, to, amount, txHash, block.timestamp);
    }

    // ─── Views ─────────────────────────────────────────────────────────────

    function getReportCount() external view returns (uint256) {
        return _reports.length;
    }

    function getReport(uint256 reportId) external view returns (ReportAction memory) {
        require(reportId < _reports.length, "Observer: report not found");
        return _reports[reportId];
    }

    /**
     * @notice Returns the last `count` reports in chronological order.
     */
    function getLatestReports(uint256 count) external view returns (ReportAction[] memory result) {
        uint256 total = _reports.length;
        uint256 n = count > total ? total : count;
        result = new ReportAction[](n);
        for (uint256 i = 0; i < n; i++) {
            result[i] = _reports[total - n + i];
        }
    }

    function getToken(string calldata chainName) external view returns (TokenInfo memory) {
        return _tokenRegistry[chainName];
    }

    function getRegisteredChains() external view returns (string[] memory) {
        return _chains;
    }
}
