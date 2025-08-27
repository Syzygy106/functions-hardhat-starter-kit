// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract PointsRegistry {
  address[] private _addrs;

  function addMany(address[] memory addrs) external {
    for (uint256 i = 0; i < addrs.length; i++) {
      _addrs.push(addrs[i]);
    }
  }

  function length() external view returns (uint256) {
    return _addrs.length;
  }

  function getAt(uint256 idx) external view returns (address) {
    return _addrs[idx];
  }

  function getAll() external view returns (address[] memory) {
    return _addrs;
  }
}
