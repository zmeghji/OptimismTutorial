// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@eth-optimism/contracts/standards/IL2StandardERC20.sol";

contract ChildToken is IL2StandardERC20, ERC20 {
    address public l1Token;
    address public l2Bridge;

    /**
     * @param _l2Bridge Address of the L2 standard bridge.
     * @param _l1Token Address of the corresponding L1 token.
     */
    constructor(
        address _l2Bridge,
        address _l1Token
    ) ERC20("LayerTwo Token", "LTWO") {
        l1Token = _l1Token;
        l2Bridge = _l2Bridge;
    }

    function supportsInterface(bytes4 _interfaceId) public pure returns (bool) {
        bytes4 firstSupportedInterface = bytes4(keccak256("supportsInterface(bytes4)")); // ERC165
        bytes4 secondSupportedInterface = IL2StandardERC20.l1Token.selector ^
            IL2StandardERC20.mint.selector ^
            IL2StandardERC20.burn.selector;
        return _interfaceId == firstSupportedInterface || _interfaceId == secondSupportedInterface;
    }

    modifier onlyL2Bridge() {
        require(msg.sender == l2Bridge, "Only L2 Bridge can mint and burn");
        _;
    }

    function mint(address _to, uint256 _amount) public virtual onlyL2Bridge {
        _mint(_to, _amount);
        emit Mint(_to, _amount);
    }

    function burn(address _from, uint256 _amount) public virtual onlyL2Bridge {
        _burn(_from, _amount);
        emit Burn(_from, _amount);
    }
}