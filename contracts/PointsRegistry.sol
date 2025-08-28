// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract PointsRegistry {
  event Added(address indexed target, uint8 id);
  event ActivationChanged(address indexed target, uint8 id, bool active);

  address[] private _addrs;
  mapping(address => bool) public exists;
  mapping(address => uint8) public addressToId;
  mapping(uint8 => address) public idToAddress;
  mapping(address => bool) public active;

  function addMany(address[] memory addrs) external {
    for (uint256 i = 0; i < addrs.length; i++) {
      address t = addrs[i];
      require(t != address(0), "zero");
      require(!exists[t], "dup");
      uint8 id = uint8(_addrs.length);
      exists[t] = true;
      addressToId[t] = id;
      idToAddress[id] = t;
      _addrs.push(t);
      emit Added(t, id);
      // active[t] is false by default
    }
  }

  function add(address t) external {
    require(t != address(0), "zero");
    require(!exists[t], "dup");
    uint8 id = uint8(_addrs.length);
    exists[t] = true;
    addressToId[t] = id;
    idToAddress[id] = t;
    _addrs.push(t);
    emit Added(t, id);
    // active[t] is false by default
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

  function getById(uint8 id) external view returns (address) {
    address a = idToAddress[id];
    require(a != address(0), "id !exist");
    return a;
  }

  /// Packed addresses: 20*N bytes
  function packedAll() external view returns (bytes memory) {
    return abi.encodePacked(_addrs);
  }

  function packedHash() external view returns (bytes32) {
    return keccak256(abi.encodePacked(_addrs));
  }

  function setActive(address t, bool a) external {
    require(exists[t], "!exist");
    uint8 id = addressToId[t];
    active[t] = a;
    emit ActivationChanged(t, id, a);
  }

  function setActiveById(uint8 id, bool a) external {
    address t = idToAddress[id];
    require(t != address(0), "!exist");
    active[t] = a;
    emit ActivationChanged(t, id, a);
  }

  function activateMany(address[] calldata addrs) external {
    for (uint256 i = 0; i < addrs.length; i++) {
      address t = addrs[i];
      if (exists[t] && !active[t]) {
        active[t] = true;
        emit ActivationChanged(t, addressToId[t], true);
      }
    }
  }

  function deactivateMany(address[] calldata addrs) external {
    for (uint256 i = 0; i < addrs.length; i++) {
      address t = addrs[i];
      if (exists[t] && active[t]) {
        active[t] = false;
        emit ActivationChanged(t, addressToId[t], false);
      }
    }
  }

  /// Packed pairs: [id(1) | address(20)] * N
  function packedPairs() external view returns (bytes memory out) {
    uint256 n = _addrs.length;
    out = new bytes(n * 21);
    for (uint256 i = 0; i < n; i++) {
      uint8 id = addressToId[_addrs[i]];
      uint256 base = 32 + i * 21;
      assembly {
        let p := add(out, base)
        mstore8(p, id)
      }
      bytes20 ab = bytes20(_addrs[i]);
      for (uint256 j = 0; j < 20; j++) {
        bytes1 b = ab[j];
        assembly {
          mstore8(add(add(out, base), add(1, j)), byte(0, b))
        }
      }
    }
  }

  function packedPairsHash() external view returns (bytes32) {
    return keccak256(this.packedPairs());
  }
}
