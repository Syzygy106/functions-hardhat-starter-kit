// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract PointsRegistry {
  event Added(address indexed target, uint256 index);

  address[] private _addrs;
  mapping(address => bool) public exists;

  function addMany(address[] memory addrs) external {
    for (uint256 i = 0; i < addrs.length; i++) {
      address t = addrs[i];
      if (t != address(0) && !exists[t]) {
        exists[t] = true;
        _addrs.push(t);
        emit Added(t, _addrs.length - 1);
      }
    }
  }

  function add(address t) external {
    if (t != address(0) && !exists[t]) {
      exists[t] = true;
      _addrs.push(t);
      emit Added(t, _addrs.length - 1);
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

  /// Packed addresses: 20*N bytes
  function packedAll() external view returns (bytes memory) {
    return abi.encodePacked(_addrs);
  }

  function packedHash() external view returns (bytes32) {
    return keccak256(abi.encodePacked(_addrs));
  }
}
