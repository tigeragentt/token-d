// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.36;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/introspection/IERC165.sol";

/**
 * TokenD — ERC-3643 (T-REX) compliant security token.
 *
 * Self-contained: includes an internal identity whitelist instead of requiring
 * separate Identity Registry and Compliance contracts on deployment.
 *
 * Key ERC-3643 features:
 *  - Only verified (whitelisted) addresses can receive tokens
 *  - Transfers can be paused globally
 *  - Individual addresses and partial balances can be frozen
 *  - Agents can perform forced transfers, batch operations, and wallet recovery
 */
contract TokenD is ERC20, Ownable, AccessControl {

    bytes32 public constant AGENT_ROLE = keccak256("AGENT_ROLE");

    bool private _paused;

    mapping(address => bool) private _verified;
    mapping(address => bool) private _frozen;
    mapping(address => uint256) private _frozenTokens;

    // ERC-3643 events
    event IdentityVerified(address indexed userAddress);
    event IdentityRevoked(address indexed userAddress);
    event Paused(address userAddress);
    event Unpaused(address userAddress);
    event AddressFrozen(address indexed userAddress, bool indexed isFrozen, address indexed owner);
    event TokensFrozen(address indexed userAddress, uint256 amount);
    event TokensUnfrozen(address indexed userAddress, uint256 amount);
    event RecoverySuccess(address indexed lostWallet, address indexed newWallet, address indexed agentAddress);

    modifier whenNotPaused() {
        require(!_paused, "Pausable: paused");
        _;
    }

    modifier whenPaused() {
        require(_paused, "Pausable: not paused");
        _;
    }

    modifier onlyAgent() {
        require(hasRole(AGENT_ROLE, msg.sender), "AgentRole: caller is not an agent");
        _;
    }

    constructor() ERC20("Debenture 1", "Deb1") Ownable(msg.sender) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(AGENT_ROLE, msg.sender);
        _paused = true;
    }

    // ─── Identity Registry ────────────────────────────────────────────────────

    function registerIdentity(address userAddress) external onlyAgent {
        _verified[userAddress] = true;
        emit IdentityVerified(userAddress);
    }

    function revokeIdentity(address userAddress) external onlyAgent {
        _verified[userAddress] = false;
        emit IdentityRevoked(userAddress);
    }

    function isVerified(address userAddress) public view returns (bool) {
        return _verified[userAddress];
    }

    // ─── Pause ────────────────────────────────────────────────────────────────

    function pause() external onlyAgent whenNotPaused {
        _paused = true;
        emit Paused(msg.sender);
    }

    function unpause() external onlyAgent whenPaused {
        _paused = false;
        emit Unpaused(msg.sender);
    }

    function paused() external view returns (bool) {
        return _paused;
    }

    // ─── Freeze ───────────────────────────────────────────────────────────────

    function setAddressFrozen(address userAddress, bool freeze) public onlyAgent {
        _frozen[userAddress] = freeze;
        emit AddressFrozen(userAddress, freeze, msg.sender);
    }

    function freezePartialTokens(address userAddress, uint256 amount) public onlyAgent {
        require(balanceOf(userAddress) >= _frozenTokens[userAddress] + amount, "Amount exceeds available balance");
        _frozenTokens[userAddress] += amount;
        emit TokensFrozen(userAddress, amount);
    }

    function unfreezePartialTokens(address userAddress, uint256 amount) public onlyAgent {
        require(_frozenTokens[userAddress] >= amount, "Amount exceeds frozen tokens");
        _frozenTokens[userAddress] -= amount;
        emit TokensUnfrozen(userAddress, amount);
    }

    function isFrozen(address userAddress) external view returns (bool) {
        return _frozen[userAddress];
    }

    function getFrozenTokens(address userAddress) external view returns (uint256) {
        return _frozenTokens[userAddress];
    }

    // ─── Mint & Burn ─────────────────────────────────────────────────────────

    function mint(address to, uint256 amount) public onlyAgent {
        require(isVerified(to), "Identity is not verified");
        _mint(to, amount);
    }

    function burn(address userAddress, uint256 amount) public onlyAgent {
        require(balanceOf(userAddress) >= amount, "Cannot burn more than balance");
        uint256 freeBalance = balanceOf(userAddress) - _frozenTokens[userAddress];
        if (amount > freeBalance) {
            uint256 tokensToUnfreeze = amount - freeBalance;
            _frozenTokens[userAddress] -= tokensToUnfreeze;
            emit TokensUnfrozen(userAddress, tokensToUnfreeze);
        }
        _burn(userAddress, amount);
    }

    // ─── Forced Transfer ──────────────────────────────────────────────────────

    function forcedTransfer(address from, address to, uint256 amount) public onlyAgent returns (bool) {
        require(balanceOf(from) >= amount, "Sender balance too low");
        require(isVerified(to), "Recipient identity not verified");
        uint256 freeBalance = balanceOf(from) - _frozenTokens[from];
        if (amount > freeBalance) {
            uint256 tokensToUnfreeze = amount - freeBalance;
            _frozenTokens[from] -= tokensToUnfreeze;
            emit TokensUnfrozen(from, tokensToUnfreeze);
        }
        _transfer(from, to, amount);
        return true;
    }

    // ─── Recovery ─────────────────────────────────────────────────────────────

    function recoveryAddress(address lostWallet, address newWallet) external onlyAgent returns (bool) {
        require(balanceOf(lostWallet) != 0, "No tokens to recover");
        require(isVerified(newWallet), "New wallet identity not verified");
        uint256 investorTokens = balanceOf(lostWallet);
        uint256 frozenAmt = _frozenTokens[lostWallet];
        forcedTransfer(lostWallet, newWallet, investorTokens);
        if (frozenAmt > 0) {
            freezePartialTokens(newWallet, frozenAmt);
        }
        if (_frozen[lostWallet]) {
            setAddressFrozen(newWallet, true);
        }
        _verified[lostWallet] = false;
        emit RecoverySuccess(lostWallet, newWallet, msg.sender);
        return true;
    }

    // ─── Batch Operations ─────────────────────────────────────────────────────

    function batchMint(address[] calldata toList, uint256[] calldata amounts) external onlyAgent {
        for (uint256 i = 0; i < toList.length; i++) {
            mint(toList[i], amounts[i]);
        }
    }

    function batchBurn(address[] calldata userAddresses, uint256[] calldata amounts) external onlyAgent {
        for (uint256 i = 0; i < userAddresses.length; i++) {
            burn(userAddresses[i], amounts[i]);
        }
    }

    function batchTransfer(address[] calldata toList, uint256[] calldata amounts) external {
        for (uint256 i = 0; i < toList.length; i++) {
            transfer(toList[i], amounts[i]);
        }
    }

    function batchForcedTransfer(
        address[] calldata fromList,
        address[] calldata toList,
        uint256[] calldata amounts
    ) external onlyAgent {
        for (uint256 i = 0; i < fromList.length; i++) {
            forcedTransfer(fromList[i], toList[i], amounts[i]);
        }
    }

    function batchSetAddressFrozen(address[] calldata userAddresses, bool[] calldata freeze) external onlyAgent {
        for (uint256 i = 0; i < userAddresses.length; i++) {
            setAddressFrozen(userAddresses[i], freeze[i]);
        }
    }

    function batchFreezePartialTokens(address[] calldata userAddresses, uint256[] calldata amounts) external onlyAgent {
        for (uint256 i = 0; i < userAddresses.length; i++) {
            freezePartialTokens(userAddresses[i], amounts[i]);
        }
    }

    function batchUnfreezePartialTokens(address[] calldata userAddresses, uint256[] calldata amounts) external onlyAgent {
        for (uint256 i = 0; i < userAddresses.length; i++) {
            unfreezePartialTokens(userAddresses[i], amounts[i]);
        }
    }

    // ─── ERC-20 Overrides with ERC-3643 Compliance ───────────────────────────

    function transfer(address to, uint256 amount) public override whenNotPaused returns (bool) {
        require(!_frozen[msg.sender] && !_frozen[to], "Wallet is frozen");
        require(amount <= balanceOf(msg.sender) - _frozenTokens[msg.sender], "Insufficient free balance");
        require(isVerified(to), "Recipient identity not verified");
        return super.transfer(to, amount);
    }

    function transferFrom(address from, address to, uint256 amount) public override whenNotPaused returns (bool) {
        require(!_frozen[from] && !_frozen[to], "Wallet is frozen");
        require(amount <= balanceOf(from) - _frozenTokens[from], "Insufficient free balance");
        require(isVerified(to), "Recipient identity not verified");
        return super.transferFrom(from, to, amount);
    }

    function decimals() public pure override returns (uint8) {
        return 2;
    }

    // ─── ERC-165 ──────────────────────────────────────────────────────────────

    function supportsInterface(bytes4 interfaceId) public view override(AccessControl) returns (bool) {
        return
            interfaceId == type(IERC20).interfaceId ||
            interfaceId == type(IERC165).interfaceId ||
            super.supportsInterface(interfaceId);
    }
}
