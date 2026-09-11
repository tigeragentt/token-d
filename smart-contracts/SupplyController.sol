// SPDX-License-Identifier: MIT
pragma solidity 0.8.36;

// Requires @chainlink/ace (BUSL-1.1).
// Deploy behind an ERC-1967 / UUPS proxy if upgrade flexibility is needed,
// or deploy directly if immutability is preferred.
// See: https://github.com/smartcontractkit/chainlink-ace

import {PolicyProtected} from "@chainlink/policy-management/core/PolicyProtected.sol";

interface ITokenDV2 {
    function mint(address to, uint256 amount) external;
    function freeze(address account, uint256 amount, bytes calldata context) external;
    function unfreeze(address account, uint256 amount, bytes calldata context) external;
    function forceTransfer(address from, address to, uint256 amount, bytes calldata context) external;
    function totalSupply() external view returns (uint256);
}

interface IPausePolicy {
    function setPausedState(bool paused) external;
    function s_paused() external view returns (bool);
}

interface IRejectPolicy {
    function rejectAddress(address account) external;
    function unrejectAddress(address account) external;
    function addressRejected(address account) external view returns (bool);
}

/**
 * @title SupplyController — Chainlink ACE-protected minting controller for TokenDV2.
 *
 * ═══════════════════════════════════════════════════════════════════
 *  ROLE SEPARATION
 * ═══════════════════════════════════════════════════════════════════
 *
 *  ISSUER (authorized in OnlyAuthorizedSenderPolicy on this contract):
 *    • Calls controlledMint() — enforced by the ACE PolicyEngine.
 *    • Cannot pause, freeze, or denylist.
 *
 *  COMPLIANCE OFFICER (owner of RejectPolicy + FreezePolicy on TokenDV2):
 *    • Calls addToDenylist() / removeFromDenylist() — updates RejectPolicy.
 *    • Calls freeze() / unfreeze() / forceTransfer() — via TokenDV2.
 *    • Cannot mint or pause.
 *
 *  REGULATOR (owner of PausePolicy shared by this contract AND TokenDV2):
 *    • Calls emergencyPause() / emergencyUnpause() — halts all minting and transfers.
 *    • Cannot mint, denylist, or freeze.
 *
 *  ADMIN (owner of this contract via PolicyProtected → Ownable):
 *    • Sets mint cap.
 *    • Updates role addresses.
 *    • Cannot bypass ACE policies on controlledMint.
 *
 * ═══════════════════════════════════════════════════════════════════
 *  POLICY ENGINE CONFIGURATION (SupplyController's own engine)
 * ═══════════════════════════════════════════════════════════════════
 *
 *  Attach to selector bytes4(keccak256("controlledMint(address,uint256)")):
 *    [0] PausePolicy           — owned by REGULATOR; pauses everything when triggered
 *    [1] OnlyAuthorizedSenderPolicy — ISSUER address(es) authorized
 *
 *  The cumulative cap is enforced natively in controlledMint() before calling
 *  TokenDV2.mint(), which has its own ACE policy confirming only this contract
 *  can call it.
 *
 * ═══════════════════════════════════════════════════════════════════
 *  POLICY ENGINE CONFIGURATION (TokenDV2's engine)
 * ═══════════════════════════════════════════════════════════════════
 *
 *  transfer(address,uint256) and transferFrom(address,address,uint256):
 *    [0] PausePolicy  (same instance as above — shared across both engines)
 *    [1] RejectPolicy (denylist — owned by COMPLIANCE OFFICER)
 *
 *  freeze(address,uint256,bytes) / unfreeze / forceTransfer:
 *    [0] OnlyAuthorizedSenderPolicy — COMPLIANCE OFFICER authorized
 *
 *  mint(address,uint256):
 *    [0] OnlyAuthorizedSenderPolicy — address(this) authorized
 */
contract SupplyController is PolicyProtected {
    // ── Errors ───────────────────────────────────────────────────────────────

    error MintCapExceeded(uint256 requested, uint256 remaining);
    error Unauthorized(address caller);

    // ── Events ───────────────────────────────────────────────────────────────

    event Minted(address indexed to, uint256 amount, address indexed issuer);
    event MintCapUpdated(uint256 oldCap, uint256 newCap);
    event RegulatoryPauseChanged(bool paused);
    event DenylistUpdated(address indexed account, bool denied);
    event RoleUpdated(string role, address indexed account);

    // ── State ────────────────────────────────────────────────────────────────

    ITokenDV2 public immutable token;

    address public regulator;
    address public complianceOfficer;

    /// Maximum cumulative amount that may be minted (in token's smallest unit).
    uint256 public mintCap;
    /// Running total of tokens minted through this controller.
    uint256 public totalMinted;

    // External policy references (set once after policy deployment)
    IPausePolicy  public pausePolicy;
    IRejectPolicy public rejectPolicy;

    // ── Constructor ──────────────────────────────────────────────────────────

    /**
     * @param _token         Address of the TokenDV2 proxy.
     * @param _policyEngine  Address of the PolicyEngine proxy for THIS contract.
     * @param _admin         Initial owner (controls cap + role assignments).
     * @param _mintCap       Initial cumulative mint cap.
     */
    constructor(
        address _token,
        address _policyEngine,
        address _admin,
        uint256 _mintCap
    )
        PolicyProtected(_admin, _policyEngine)
    {
        token   = ITokenDV2(_token);
        mintCap = _mintCap;
    }

    // ── Admin ────────────────────────────────────────────────────────────────

    /// @notice Update the cumulative mint cap. Admin only.
    function setMintCap(uint256 newCap) external onlyOwner {
        uint256 old = mintCap;
        mintCap = newCap;
        emit MintCapUpdated(old, newCap);
    }

    /// @notice Set the regulator address. Admin only.
    function setRegulator(address _regulator) external onlyOwner {
        regulator = _regulator;
        emit RoleUpdated("REGULATOR", _regulator);
    }

    /// @notice Set the compliance officer address. Admin only.
    function setComplianceOfficer(address _co) external onlyOwner {
        complianceOfficer = _co;
        emit RoleUpdated("COMPLIANCE_OFFICER", _co);
    }

    /// @notice Wire up policy references after deployment. Admin only.
    function setPolicyContracts(address _pausePolicy, address _rejectPolicy) external onlyOwner {
        pausePolicy  = IPausePolicy(_pausePolicy);
        rejectPolicy = IRejectPolicy(_rejectPolicy);
    }

    // ── Minting (ACE-protected) ───────────────────────────────────────────────

    /**
     * @notice Mint `amount` tokens to `to`.
     *
     * The ACE PolicyEngine enforces:
     *   1. PausePolicy     — reverts if regulator has paused
     *   2. OnlyAuthorizedSenderPolicy — reverts if caller is not an authorized issuer
     *
     * The cumulative cap is checked natively here before calling TokenDV2.mint().
     * TokenDV2.mint() has its own ACE policy confirming only this contract may call it.
     */
    function controlledMint(address to, uint256 amount) external runPolicy {
        uint256 remaining = mintCap - totalMinted;
        if (amount > remaining) revert MintCapExceeded(amount, remaining);

        totalMinted += amount;
        token.mint(to, amount);

        emit Minted(to, amount, msg.sender);
    }

    // ── Emergency Pause (Regulator only) ─────────────────────────────────────

    /**
     * @notice Halt all minting (via this controller) AND all token transfers.
     * @dev    Calls setPausedState(true) on the shared PausePolicy instance.
     *         The same PausePolicy must be attached to both this engine and
     *         TokenDV2's engine for the halt to cover both paths.
     */
    function emergencyPause() external {
        if (msg.sender != regulator) revert Unauthorized(msg.sender);
        pausePolicy.setPausedState(true);
        emit RegulatoryPauseChanged(true);
    }

    /// @notice Resume operations after an emergency pause. Regulator only.
    function emergencyUnpause() external {
        if (msg.sender != regulator) revert Unauthorized(msg.sender);
        pausePolicy.setPausedState(false);
        emit RegulatoryPauseChanged(false);
    }

    // ── Sanctions Denylist (Compliance Officer only) ──────────────────────────

    /**
     * @notice Add `account` to the sanctions denylist.
     * @dev    Calls rejectAddress() on the RejectPolicy attached to TokenDV2's
     *         transfer selectors. The compliance officer must own that RejectPolicy.
     */
    function addToDenylist(address account) external {
        if (msg.sender != complianceOfficer) revert Unauthorized(msg.sender);
        rejectPolicy.rejectAddress(account);
        emit DenylistUpdated(account, true);
    }

    /// @notice Remove `account` from the sanctions denylist.
    function removeFromDenylist(address account) external {
        if (msg.sender != complianceOfficer) revert Unauthorized(msg.sender);
        rejectPolicy.unrejectAddress(account);
        emit DenylistUpdated(account, false);
    }

    // ── Freeze / Unfreeze / ForceTransfer (Compliance Officer only) ───────────

    /**
     * @notice Freeze `amount` tokens held by `account` on TokenDV2.
     * @dev    TokenDV2.freeze() is itself ACE-protected; the OnlyAuthorizedSenderPolicy
     *         on that selector must have `complianceOfficer` (or address(this)) authorized.
     */
    function freeze(address account, uint256 amount) external {
        if (msg.sender != complianceOfficer) revert Unauthorized(msg.sender);
        token.freeze(account, amount, "");
    }

    /// @notice Unfreeze `amount` tokens held by `account`.
    function unfreeze(address account, uint256 amount) external {
        if (msg.sender != complianceOfficer) revert Unauthorized(msg.sender);
        token.unfreeze(account, amount, "");
    }

    /**
     * @notice Administratively transfer `amount` from `from` to `to`.
     * @dev    Only operates on available (non-frozen) balance.
     *         To move frozen funds, unfreeze first.
     */
    function forceTransfer(address from, address to, uint256 amount) external {
        if (msg.sender != complianceOfficer) revert Unauthorized(msg.sender);
        token.forceTransfer(from, to, amount, "");
    }

    // ── View ─────────────────────────────────────────────────────────────────

    function mintCapRemaining() external view returns (uint256) {
        return mintCap > totalMinted ? mintCap - totalMinted : 0;
    }

    function isPaused() external view returns (bool) {
        return pausePolicy.s_paused();
    }

    function isDenied(address account) external view returns (bool) {
        return rejectPolicy.addressRejected(account);
    }
}
