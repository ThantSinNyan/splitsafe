// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @notice SplitSafe Demo USDC is a fake testnet-only ERC20 token.
/// @dev dUSDC has no real value and must never be represented as real USDC.
contract DemoUSDC is ERC20, Ownable {
    uint256 public constant FAUCET_AMOUNT = 1_000 * 10 ** 6;

    constructor() ERC20("SplitSafe Demo USDC", "dUSDC") Ownable(msg.sender) {}

    /// @notice dUSDC follows USDC-style 6 decimal accounting.
    function decimals() public pure override returns (uint8) {
        return 6;
    }

    /// @notice Owner minting is for testnet liquidity setup only.
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }

    /// @notice Public faucet for demo users. Mints 1000 fake dUSDC to caller.
    function faucetMint() external {
        _mint(msg.sender, FAUCET_AMOUNT);
    }
}
