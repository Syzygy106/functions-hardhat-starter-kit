// Runs inside Chainlink Functions (Deno runtime)
// Args: [registryAddress, helperAddress]
// Uses localFunctionsTestnet JSON-RPC at http://localhost:8545

if (!args || args.length < 2) {
  throw Error("Expected args: [registryAddress, helperAddress]")
}

const [REGISTRY, HELPER] = args

// Use ethers via Deno-compatible npm: import to encode the call data
const { ethers } = await import("npm:ethers@6.9.0")
const iface = new ethers.Interface(["function getTop3FromRegistry(address) view returns (address,address,address)"])

// ABI-encode the function call with the registry address
const data = iface.encodeFunctionData("getTop3FromRegistry", [REGISTRY])

// Do a raw eth_call to the Helper contract on the local JSON-RPC
const payload = {
  jsonrpc: "2.0",
  id: 1,
  method: "eth_call",
  params: [{ to: HELPER, data }, "latest"],
}

const rpc = await Functions.makeHttpRequest({
  url: "http://localhost:8545",
  method: "POST",
  headers: { "Content-Type": "application/json" },
  data: payload,
})

if (!rpc || rpc.error) {
  throw Error(`RPC error: ${rpc && rpc.error ? JSON.stringify(rpc.error) : "unknown"}`)
}
const result = rpc.data && rpc.data.result
if (!result || typeof result !== "string" || !result.startsWith("0x")) {
  throw Error("Bad eth_call result")
}

// Return the ABI-encoded bytes as Uint8Array (Functions expects bytes)
return (await import("npm:ethers@6.9.0")).ethers.getBytes(result)
