// SPDX-License-Identifier: MIT
pragma solidity 0.8.36;

// Requires @chainlink/ace (BUSL-1.1) and @openzeppelin/contracts-upgradeable v5.
// Deploy behind an ERC-1967 / UUPS proxy.
// See: https://github.com/smartcontractkit/chainlink-ace

import {ERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {PolicyProtectedUpgradeable} from "@chainlink/policy-management/core/PolicyProtectedUpgradeable.sol";

/**
 * @title TokenDV2 — Debenture 1 (Deb1) with Chainlink ACE compliance layer.
 *
 * Inherits ERC20 storage, logic, and events from ERC20Upgradeable (OZ v5).
 * No manual ERC-7201 slots needed — OZ handles its own storage internally.
 * PolicyProtectedUpgradeable already includes ERC165 + Ownable (upgradeable).
 *
 * Policy chains (configure on PolicyEngine after deploy):
 *
 *   transfer / transferFrom:
 *     [0] PausePolicy   — regulator emergency halt
 *     [1] RejectPolicy  — sanctions denylist (compliance officer manages)
 *
 *   freeze / unfreeze / forceTransfer:
 *     [0] OnlyAuthorizedSenderPolicy — compliance officer only
 *
 *   mint:
 *     [0] OnlyAuthorizedSenderPolicy — SupplyController only
 *
 * Freeze model:
 *   availableBalance = balanceOf(account) - frozenBalanceOf(account)
 *   transfer/burn require availableBalance >= amount (enforced in _update)
 *   forceTransfer also operates on available balance (frozen funds need unfreeze first)
 */
contract TokenDV2 is ERC20Upgradeable, PolicyProtectedUpgradeable, UUPSUpgradeable {
    // ── Events ───────────────────────────────────────────────────────────────

    event Frozen(address indexed account, uint256 amount);
    event Unfrozen(address indexed account, uint256 amount);
    event ForceTransfer(address indexed from, address indexed to, uint256 amount);

    // ── Storage ──────────────────────────────────────────────────────────────
    // This is a fresh V2 deploy (not an upgrade from V1), so regular storage
    // is safe here. Future V3 upgrades must ONLY append new variables after this.

    mapping(address => uint256) private _frozenBalances;

    // ── Constructor / Initializer ────────────────────────────────────────────

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() { _disableInitializers(); }

    /**
     * @param policyEngine  Address of the deployed PolicyEngine proxy for this token.
     * @param admin         Initial owner (multisig or deployer).
     */
    function initialize(address policyEngine, address admin) external initializer {
        __ERC20_init("Debenture 1", "Deb1");
        // __PolicyProtected_init calls __ERC165_init + __Ownable_init + __PolicyProtectedBase_init_unchained
        __PolicyProtected_init(admin, policyEngine);
    }

    // ── Upgrade guard ────────────────────────────────────────────────────────

    function _authorizeUpgrade(address) internal override onlyOwner {}

    // ── ERC-20 overrides ─────────────────────────────────────────────────────

    function decimals() public pure override returns (uint8) { return 2; }

    /// ACE chain: PausePolicy → RejectPolicy
    function transfer(address to, uint256 amount) public override runPolicy returns (bool) {
        return super.transfer(to, amount);
    }

    /// ACE chain: PausePolicy → RejectPolicy
    function transferFrom(address from, address to, uint256 amount) public override runPolicy returns (bool) {
        return super.transferFrom(from, to, amount);
    }

    // ── Minting / Burning ────────────────────────────────────────────────────

    /// ACE chain: OnlyAuthorizedSenderPolicy (SupplyController only)
    function mint(address to, uint256 amount) public runPolicy {
        require(to != address(0), "TokenDV2: mint to zero address");
        _mint(to, amount);
    }

    /// Burns caller's own available (non-frozen) tokens.
    function burn(uint256 amount) public {
        _burn(msg.sender, amount);
    }

    // ── Compliance operations ─────────────────────────────────────────────────

    /**
     * @notice Freeze `amount` tokens in `account`.
     * @dev ACE chain: OnlyAuthorizedSenderPolicy (CO only).
     *      Frozen tokens cannot be moved by the account holder.
     *      Only forceTransfer (CO-initiated) can move them after unfreezing.
     */
    function freeze(address account, uint256 amount, bytes calldata context)
        public runPolicyWithContext(context)
    {
        _frozenBalances[account] += amount;
        emit Frozen(account, amount);
    }

    /// @notice Unfreeze `amount` tokens in `account`.
    /// @dev ACE chain: OnlyAuthorizedSenderPolicy (CO only).
    function unfreeze(address account, uint256 amount, bytes calldata context)
        public runPolicyWithContext(context)
    {
        require(_frozenBalances[account] >= amount, "TokenDV2: exceeds frozen balance");
        _frozenBalances[account] -= amount;
        emit Unfrozen(account, amount);
    }

    /**
     * @notice Administratively move available tokens from `from` to `to`.
     * @dev ACE chain: OnlyAuthorizedSenderPolicy (CO only).
     *      Operates on available balance only. To move frozen tokens, unfreeze first.
     */
    function forceTransfer(address from, address to, uint256 amount, bytes calldata context)
        public runPolicyWithContext(context)
    {
        require(from != address(0) && to != address(0), "TokenDV2: zero address");
        _transfer(from, to, amount);
        emit ForceTransfer(from, to, amount);
    }

    // ── View ─────────────────────────────────────────────────────────────────

    function frozenBalanceOf(address account) public view returns (uint256) {
        return _frozenBalances[account];
    }

    function availableBalanceOf(address account) public view returns (uint256) {
        uint256 bal = balanceOf(account);
        uint256 frozen = _frozenBalances[account];
        return bal > frozen ? bal - frozen : 0;
    }

    // ── Internal hooks ───────────────────────────────────────────────────────

    /**
     * @dev Override OZ v5's _update to enforce available-balance checks on all
     *      transfers and burns. Mints (from == address(0)) bypass the check.
     */
    function _update(address from, address to, uint256 amount) internal override {
        if (from != address(0)) {
            require(
                balanceOf(from) - _frozenBalances[from] >= amount,
                "TokenDV2: insufficient available balance"
            );
        }
        super._update(from, to, amount);
    }

    // ── ERC-165 ───────────────────────────────────────────────────────────────
    // PolicyProtectedUpgradeable inherits ERC165Upgradeable and handles
    // supportsInterface for IPolicyProtected. ERC20Upgradeable (OZ v5) does NOT
    // implement ERC165, so there is no conflict — no override needed here.
}
