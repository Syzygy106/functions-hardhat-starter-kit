// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/// @notice Abstract contract for hook-level ownership management
abstract contract HookOwnable {
  address public hookOwner;

  event HookOwnerTransferred(address indexed previousOwner, address indexed newOwner);
  event HookOwnerRenounced(address indexed previousOwner);

  /// @dev Internal setter for initial owner (used in constructor)
  function _setHookOwner(address owner) internal {
    hookOwner = owner;
    emit HookOwnerTransferred(address(0), owner);
  }

  /// @notice Reverts if caller is not the hook owner
  modifier onlyHookOwner() {
    require(msg.sender == hookOwner, "HookOwnable: caller is not the hook owner");
    _;
  }

  /// @notice Transfer hook ownership to a new address
  function transferHookOwnership(address newOwner) external onlyHookOwner {
    require(newOwner != address(0), "HookOwnable: new owner is zero address");
    address prev = hookOwner;
    hookOwner = newOwner;
    emit HookOwnerTransferred(prev, newOwner);
  }

  /// @notice Renounce ownership of the hook
  function renounceHookOwnership() external onlyHookOwner {
    address prev = hookOwner;
    hookOwner = address(0);
    emit HookOwnerRenounced(prev);
  }
}
