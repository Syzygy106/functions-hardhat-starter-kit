// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {FunctionsClient} from "@chainlink/contracts/src/v0.8/functions/v1_0_0/FunctionsClient.sol";
import {ConfirmedOwner} from "@chainlink/contracts/src/v0.8/shared/access/ConfirmedOwner.sol";
import {FunctionsRequest} from "@chainlink/contracts/src/v0.8/functions/v1_0_0/libraries/FunctionsRequest.sol";
import {PointsRegistry} from "./PointsRegistry.sol";

contract Top3Consumer is FunctionsClient, ConfirmedOwner {
  using FunctionsRequest for FunctionsRequest.Request;

  bytes32 public donId;
  PointsRegistry public registry;
  uint8[5] public top5Ids;
  bytes32 public lastRequestId;

  event Top5IdsUpdated(uint8[5] top5Ids);

  constructor(address router, bytes32 _donId, address registryAddr) FunctionsClient(router) ConfirmedOwner(msg.sender) {
    donId = _donId;
    registry = PointsRegistry(registryAddr);
  }

  function sendRequest(
    string calldata source,
    FunctionsRequest.Location secretsLocation,
    bytes calldata encryptedSecretsReference,
    string[] calldata args,
    bytes[] calldata bytesArgs,
    uint64 subscriptionId,
    uint32 callbackGasLimit
  ) external onlyOwner {
    FunctionsRequest.Request memory req;
    req.initializeRequest(FunctionsRequest.Location.Inline, FunctionsRequest.CodeLanguage.JavaScript, source);
    req.secretsLocation = secretsLocation;
    req.encryptedSecretsReference = encryptedSecretsReference;
    if (args.length > 0) {
      req.setArgs(args);
    }
    if (bytesArgs.length > 0) {
      req.setBytesArgs(bytesArgs);
    }
    lastRequestId = _sendRequest(req.encodeCBOR(), subscriptionId, callbackGasLimit, donId);
  }

  function fulfillRequest(bytes32 requestId, bytes memory response, bytes memory err) internal override {
    require(requestId == lastRequestId, "unknown request");
    require(err.length == 0, "functions error");
    uint256 packed = abi.decode(response, (uint256));
    uint8 id0 = uint8(packed & 0xff);
    uint8 id1 = uint8((packed >> 8) & 0xff);
    uint8 id2 = uint8((packed >> 16) & 0xff);
    uint8 id3 = uint8((packed >> 24) & 0xff);
    uint8 id4 = uint8((packed >> 32) & 0xff);
    top5Ids = [id0, id1, id2, id3, id4];
    emit Top5IdsUpdated(top5Ids);
  }
}
