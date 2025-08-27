// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {IPoints} from "./IPoints.sol";
import {PointsRegistry} from "./PointsRegistry.sol";

contract PointsTop3Helper {
  /// @notice Возвращает топ-3 адреса из реестра по убыванию getPoints().
  ///         Тай-брейкер: меньший адрес (по uint160) идёт раньше.
  function getTop3FromRegistry(address registryAddr) external view returns (address[3] memory top3) {
    PointsRegistry r = PointsRegistry(registryAddr);
    uint256 n = r.length();
    require(n >= 3, "need >=3 items");

    // Топ-3 очков и адресов (инвариант: 0 — максимальный)
    uint256[3] memory bestPts = [uint256(0), uint256(0), uint256(0)];
    address[3] memory bestAddr = [address(0), address(0), address(0)];

    for (uint256 i = 0; i < n; i++) {
      address a = r.getAt(i);
      uint256 p = IPoints(a).getPoints();

      // Вставка в топ-3
      if (_better(p, a, bestPts[0], bestAddr[0])) {
        // сдвиг вниз
        bestPts[2] = bestPts[1];
        bestAddr[2] = bestAddr[1];
        bestPts[1] = bestPts[0];
        bestAddr[1] = bestAddr[0];
        bestPts[0] = p;
        bestAddr[0] = a;
      } else if (_better(p, a, bestPts[1], bestAddr[1])) {
        bestPts[2] = bestPts[1];
        bestAddr[2] = bestAddr[1];
        bestPts[1] = p;
        bestAddr[1] = a;
      } else if (_better(p, a, bestPts[2], bestAddr[2])) {
        bestPts[2] = p;
        bestAddr[2] = a;
      }
    }

    return [bestAddr[0], bestAddr[1], bestAddr[2]];
  }

  function _better(uint256 p, address a, uint256 q, address b) private pure returns (bool) {
    if (p > q) return true;
    if (p < q) return false;
    // tie-break: меньший адрес — раньше
    return uint160(a) < uint160(b);
  }
}
