// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;
import {IDaemon} from "../interfaces/IDaemon.sol";

contract DaemonRegistry {
  event Added(address indexed target, uint16 id);
  event ActivationChanged(address indexed target, uint16 id, bool active);

  // List of daemon contract addresses, index also serves as id (uint16)
  address[] private _daemonAddresses;
  mapping(address => bool) public exists;
  mapping(address => uint16) public addressToId;
  mapping(uint16 => address) public idToAddress;
  mapping(address => bool) public active;

  // Compact activation bitmap: bit i corresponds to id i
  // Stored as 256-bit words for efficient updates
  mapping(uint256 => uint256) private _activationBitmaskWords;
  uint256 public bitWordCount; // number of 256-bit words used to cover current ids

  function _ensureBitCapacity(uint256 numberOfIds) internal {
    uint256 needed = (numberOfIds + 255) / 256;
    if (needed > bitWordCount) {
      bitWordCount = needed;
    }
  }

  function _setActiveBit(uint16 daemonId, bool isActive) internal {
    uint256 wordIndex = uint256(daemonId) / 256;
    uint256 bitIndex = uint256(daemonId) % 256;
    uint256 bitMask = (uint256(1) << bitIndex);
    uint256 currentWord = _activationBitmaskWords[wordIndex];
    if (isActive) {
      currentWord |= bitMask;
    } else {
      currentWord &= ~bitMask;
    }
    _activationBitmaskWords[wordIndex] = currentWord;
  }

  // TODO: ADD OnlyHookOwner
  function _addMany(address[] memory daemonAddresses) internal {
    for (uint256 index = 0; index < daemonAddresses.length; index++) {
      address daemon = daemonAddresses[index];
      require(daemon != address(0), "zero");
      require(!exists[daemon], "dup");
      require(_daemonAddresses.length < 3200, "cap 3200");
      uint16 daemonId = uint16(_daemonAddresses.length);
      exists[daemon] = true;
      addressToId[daemon] = daemonId;
      idToAddress[daemonId] = daemon;
      _daemonAddresses.push(daemon);
      emit Added(daemon, daemonId);
      // active[daemon] is false by default
      _ensureBitCapacity(_daemonAddresses.length);
    }
  }

  // TODO: ADD OnlyHookOwner
  function _add(address daemon) internal {
    require(daemon != address(0), "zero");
    require(!exists[daemon], "dup");
    require(_daemonAddresses.length < 3200, "cap 3200");
    uint16 daemonId = uint16(_daemonAddresses.length);
    exists[daemon] = true;
    addressToId[daemon] = daemonId;
    idToAddress[daemonId] = daemon;
    _daemonAddresses.push(daemon);
    emit Added(daemon, daemonId);
    // active[daemon] is false by default
    _ensureBitCapacity(_daemonAddresses.length);
  }

  function length() external view returns (uint256) {
    return _daemonAddresses.length;
  }

  function getAt(uint256 index) external view returns (address) {
    return _daemonAddresses[index];
  }

  function getAll() external view returns (address[] memory) {
    return _daemonAddresses;
  }

  function getById(uint16 daemonId) external view returns (address) {
    address daemon = idToAddress[daemonId];
    require(daemon != address(0), "id !exist");
    return daemon;
  }

  /// Packed addresses: 20*N bytes
  function packedAll() external view returns (bytes memory) {
    return abi.encodePacked(_daemonAddresses);
  }

  function packedHash() external view returns (bytes32) {
    return keccak256(abi.encodePacked(_daemonAddresses));
  }

  function _setActive(address daemon, bool isActive) internal {
    require(exists[daemon], "!exist");
    uint16 daemonId = addressToId[daemon];
    active[daemon] = isActive;
    _setActiveBit(daemonId, isActive);
    emit ActivationChanged(daemon, daemonId, isActive);
  }

  function _setActiveById(uint16 daemonId, bool isActive) internal {
    address daemon = idToAddress[daemonId];
    require(daemon != address(0), "!exist");
    active[daemon] = isActive;
    _setActiveBit(daemonId, isActive);
    emit ActivationChanged(daemon, daemonId, isActive);
  }

  // TODO: ADD OnlyHookOwner
  function _activateMany(address[] calldata daemonAddresses) internal {
    for (uint256 index = 0; index < daemonAddresses.length; index++) {
      address daemon = daemonAddresses[index];
      if (exists[daemon] && !active[daemon]) {
        active[daemon] = true;
        _setActiveBit(addressToId[daemon], true);
        emit ActivationChanged(daemon, addressToId[daemon], true);
      }
    }
  }

  // TODO: ADD OnlyHookOwner
  function _deactivateMany(address[] calldata daemonAddresses) internal {
    for (uint256 index = 0; index < daemonAddresses.length; index++) {
      address daemon = daemonAddresses[index];
      if (exists[daemon] && active[daemon]) {
        active[daemon] = false;
        _setActiveBit(addressToId[daemon], false);
        emit ActivationChanged(daemon, addressToId[daemon], false);
      }
    }
  }

  /// Packed pairs: [id(1) | address(20)] * N
  function packedPairs() external view returns (bytes memory out) {
    uint256 total = _daemonAddresses.length;
    out = new bytes(total * 21);
    for (uint256 index = 0; index < total; index++) {
      uint8 daemonId = uint8(addressToId[_daemonAddresses[index]]);
      uint256 base = 32 + index * 21;
      assembly {
        let p := add(out, base)
        mstore8(p, daemonId)
      }
      bytes20 daemonBytes = bytes20(_daemonAddresses[index]);
      for (uint256 j = 0; j < 20; j++) {
        bytes1 b = daemonBytes[j];
        assembly {
          mstore8(add(add(out, base), add(1, j)), byte(0, b))
        }
      }
    }
  }

  function packedPairsHash() external view returns (bytes32) {
    return keccak256(this.packedPairs());
  }

  /// Returns compact activation bitmap. Bit i corresponds to id i.
  /// Length of the returned bytes is ceil(length()/8).
  function activationBitmap() external view returns (bytes memory out) {
    uint256 total = _daemonAddresses.length;
    uint256 byteLen = (total + 7) / 8;
    out = new bytes(byteLen);
    for (uint256 index = 0; index < total; index++) {
      if (active[_daemonAddresses[index]]) {
        uint256 byteIndex = index / 8;
        uint256 bitIndex = index % 8;
        uint8 cur = uint8(out[byteIndex]);
        uint8 mask = uint8(1) << uint8(bitIndex);
        out[byteIndex] = bytes1(cur | mask);
      }
    }
  }

  function activationMeta() external view returns (uint256 total, bytes memory bitmap) {
    total = _daemonAddresses.length;
    bitmap = this.activationBitmap();
  }

  function aggregatePointsRange(
    uint256 start,
    uint256 count,
    uint256 blockNumber
  ) external view returns (int128[] memory points) {
    require(count > 0 && count <= 800, "count");
    uint256 total = _daemonAddresses.length;
    require(start <= total, "start");
    uint256 available = total > start ? total - start : 0;
    uint256 toTake = count < available ? count : available;
    points = new int128[](toTake);
    if (toTake == 0) {
      return points;
    }
    for (uint256 index = 0; index < toTake; index++) {
      address daemon = _daemonAddresses[start + index];
      if (!active[daemon]) {
        points[index] = 0;
        continue;
      }
      try IDaemon(daemon).getRebateAmount(blockNumber) returns (int128 value) {
        points[index] = value;
      } catch {
        points[index] = 0;
      }
    }
  }

  /// Aggregate getRebateAmount() for all addresses in id order
  function aggregatePointsAll(uint256 blockNumber) external view returns (int128[] memory points) {
    uint256 total = _daemonAddresses.length;
    points = new int128[](total);
    for (uint256 index = 0; index < total; index++) {
      address daemon = _daemonAddresses[index];
      try IDaemon(daemon).getRebateAmount(blockNumber) returns (int128 value) {
        points[index] = value;
      } catch {
        points[index] = 0;
      }
    }
  }

  /// Aggregate getRebateAmount() for all addresses in id order, returning 0 for inactive
  function aggregatePointsMasked(uint256 blockNumber) external view returns (int128[] memory points) {
    uint256 total = _daemonAddresses.length;
    points = new int128[](total);
    for (uint256 index = 0; index < total; index++) {
      address daemon = _daemonAddresses[index];
      if (active[daemon]) {
        try IDaemon(daemon).getRebateAmount(blockNumber) returns (int128 value) {
          points[index] = value;
        } catch {
          points[index] = 0;
        }
      } else {
        points[index] = 0;
      }
    }
  }
}
