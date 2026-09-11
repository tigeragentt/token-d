// SPDX-License-Identifier: MIT
pragma solidity 0.8.36;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import {ERC20Burnable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";

contract TokenD is ERC20, ERC20Burnable, AccessControl {
	bytes32 public constant SUPPLY_ROLE = keccak256("SUPPLY_ROLE");

	constructor() ERC20("Debenture 1", "Deb1") {
    	_grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    	_grantRole(SUPPLY_ROLE, msg.sender);
	}

	function mint(address to, uint256 amount) public onlyRole(SUPPLY_ROLE) {
    	_mint(to, amount);
	}

    function burn(uint256 value) public override onlyRole(SUPPLY_ROLE) {
        _burn(_msgSender(), value);
    }

    function burnFrom(address account, uint256 value) public override onlyRole(SUPPLY_ROLE) {
        _spendAllowance(account, _msgSender(), value);
        _burn(account, value);
    }

	function decimals() public pure override returns (uint8) {
    	return 2;
	}    
}
