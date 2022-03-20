// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract RootToken is ERC20 {
    constructor() ERC20("LayerTwo Token", "LTWO") {
        _mint(msg.sender, 1000000 * 10 ** decimals());
    }
}