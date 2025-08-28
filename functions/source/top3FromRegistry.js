// Runs inside Chainlink Functions (Deno runtime)
// Uses localFunctionsTestnet JSON-RPC at http://localhost:8545
// New Args: [registryAddress, multicallAddress, perCallGas(optional default 200000)]

if (!args || args.length < 2) {
  throw Error("Expected args: [registryAddress, multicallAddress, perCallGas?]")
}

const REGISTRY = args[0]
const MULTICALL = args[1]
const PER_CALL_GAS = args[2] ? Number(args[2]) : 200000

const { ethers } = await import("npm:ethers@6.9.0")

// Use ethers JsonRpcProvider to perform calls (counts as HTTP under the hood)
const provider = new ethers.JsonRpcProvider("http://localhost:8545")

// 1) Fetch pairs [id|address] in one call; fallback to getAll if unavailable
const regIface = new ethers.Interface([
  "function packedPairs() view returns (bytes)",
  "function getAll() view returns (address[])",
])

let addresses
let ids
try {
  const dataPacked = regIface.encodeFunctionData("packedPairs")
  const packedHex = await provider.call({ to: REGISTRY, data: dataPacked })
  if (!packedHex || typeof packedHex !== "string" || !packedHex.startsWith("0x")) throw Error("bad packed")
  const bytes = ethers.getBytes(packedHex)
  if (bytes.length % 21 !== 0) throw Error("packed len not multiple of 21")
  const addrs = []
  const idbuf = []
  for (let i = 0; i < bytes.length; i += 21) {
    const id = bytes[i]
    const slice = bytes.slice(i + 1, i + 21)
    idbuf.push(id)
    addrs.push(ethers.getAddress("0x" + Buffer.from(slice).toString("hex")))
  }
  addresses = addrs
  ids = idbuf
} catch (e) {
  const dataGetAll = regIface.encodeFunctionData("getAll")
  const allHex = await provider.call({ to: REGISTRY, data: dataGetAll })
  if (!allHex || typeof allHex !== "string" || !allHex.startsWith("0x")) throw Error("Bad getAll result")
  addresses = regIface.decodeFunctionResult("getAll", allHex)[0]
  // derive ids as indices
  ids = addresses.map((_, i) => i)
}
if (!Array.isArray(addresses) || addresses.length < 3) throw Error("need >=3 items")

// 2) Multicall: first check active(address), then getPoints() on active only
const mcIface = new ethers.Interface([
  "function aggregateGasLimited((address target, bytes callData)[] calls, uint64 perCallGas, bool allowFailure) view returns (uint256 blockNumber, (bool success, bytes returnData)[] results)",
])
const pointsIface = new ethers.Interface(["function getPoints() view returns (uint256)"])
const regActiveIface = new ethers.Interface(["function active(address) view returns (bool)"])
let calls = addresses.map((a) => ({ target: REGISTRY, callData: regActiveIface.encodeFunctionData("active", [a]) }))
let dataMc = mcIface.encodeFunctionData("aggregateGasLimited", [calls, BigInt(PER_CALL_GAS), true])

let mcOut = await provider.call({ to: MULTICALL, data: dataMc })
if (!mcOut || typeof mcOut !== "string" || !mcOut.startsWith("0x")) throw Error("Bad multicall result (active)")

let decoded = mcIface.decodeFunctionResult("aggregateGasLimited", mcOut)
let results = decoded[1]
if (!Array.isArray(results)) throw Error("Bad results array (active)")
const isActive = results.map((r) =>
  r.success ? regActiveIface.decodeFunctionResult("active", r.returnData)[0] : false
)

const filteredAddrs = []
const filteredIds = []
for (let i = 0; i < addresses.length; i++) {
  if (isActive[i]) {
    filteredAddrs.push(addresses[i])
    filteredIds.push(ids[i])
  }
}
if (filteredAddrs.length < 3) throw Error("need >=3 active items")

// getPoints on active only
calls = filteredAddrs.map((a) => ({ target: a, callData: pointsIface.encodeFunctionData("getPoints", []) }))
dataMc = mcIface.encodeFunctionData("aggregateGasLimited", [calls, BigInt(PER_CALL_GAS), true])

mcOut = await provider.call({ to: MULTICALL, data: dataMc })
if (!mcOut || typeof mcOut !== "string" || !mcOut.startsWith("0x")) throw Error("Bad multicall result (points)")

decoded = mcIface.decodeFunctionResult("aggregateGasLimited", mcOut)
results = decoded[1]
if (!Array.isArray(results)) throw Error("Bad results array (points)")

// 3) Collect (index/id, address, points) and sort desc by points, tie-break by lower address
const pairs = []
for (let i = 0; i < filteredAddrs.length; i++) {
  const r = results[i]
  if (r.success) {
    const p = pointsIface.decodeFunctionResult("getPoints", r.returnData)[0]
    pairs.push([filteredIds[i], filteredAddrs[i], BigInt(p.toString())])
  }
}
if (pairs.length < 3) throw Error("<3 success items")
pairs.sort((a, b) => {
  if (a[2] > b[2]) return -1
  if (a[2] < b[2]) return 1
  // tie-break by address numeric value (lower first)
  const aa = BigInt(a[1].toLowerCase())
  const bb = BigInt(b[1].toLowerCase())
  if (aa < bb) return -1
  if (aa > bb) return 1
  return 0
})

// Pack five uint8 ids into one uint256
const top5ids = pairs.slice(0, 5).map((x) => x[0])
const packed =
  (BigInt(top5ids[0]) & 0xffn) |
  ((BigInt(top5ids[1]) & 0xffn) << 8n) |
  ((BigInt(top5ids[2]) & 0xffn) << 16n) |
  ((BigInt(top5ids[3]) & 0xffn) << 24n) |
  ((BigInt(top5ids[4]) & 0xffn) << 32n)
const enc = new ethers.AbiCoder().encode(["uint256"], [packed])
return (await import("npm:ethers@6.9.0")).ethers.getBytes(enc)
