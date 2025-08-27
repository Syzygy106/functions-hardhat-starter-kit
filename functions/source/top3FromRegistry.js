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

// 1) Fetch addresses: try packedAll() first, then fallback to getAll()
const regIface = new ethers.Interface([
  "function packedAll() view returns (bytes)",
  "function getAll() view returns (address[])",
])

let addresses
try {
  const dataPacked = regIface.encodeFunctionData("packedAll")
  const packedHex = await provider.call({ to: REGISTRY, data: dataPacked })
  if (!packedHex || typeof packedHex !== "string" || !packedHex.startsWith("0x")) throw Error("bad packed")
  const bytes = ethers.getBytes(packedHex)
  if (bytes.length % 20 !== 0) throw Error("packed len not multiple of 20")
  const addrs = []
  for (let i = 0; i < bytes.length; i += 20) {
    const slice = bytes.slice(i, i + 20)
    addrs.push(ethers.getAddress("0x" + Buffer.from(slice).toString("hex")))
  }
  addresses = addrs
} catch (e) {
  const dataGetAll = regIface.encodeFunctionData("getAll")
  const allHex = await provider.call({ to: REGISTRY, data: dataGetAll })
  if (!allHex || typeof allHex !== "string" || !allHex.startsWith("0x")) throw Error("Bad getAll result")
  addresses = regIface.decodeFunctionResult("getAll", allHex)[0]
}
if (!Array.isArray(addresses) || addresses.length < 3) throw Error("need >=3 items")

// 2) Multicall getPoints() across all addresses
const mcIface = new ethers.Interface([
  "function aggregateGasLimited((address target, bytes callData)[] calls, uint64 perCallGas, bool allowFailure) view returns (uint256 blockNumber, (bool success, bytes returnData)[] results)",
])
const pointsIface = new ethers.Interface(["function getPoints() view returns (uint256)"])
// For ethers v6 with named tuple fields, pass objects { target, callData }
const calls = addresses.map((a) => ({ target: a, callData: pointsIface.encodeFunctionData("getPoints", []) }))
const dataMc = mcIface.encodeFunctionData("aggregateGasLimited", [calls, BigInt(PER_CALL_GAS), true])

const mcOut = await provider.call({ to: MULTICALL, data: dataMc })
if (!mcOut || typeof mcOut !== "string" || !mcOut.startsWith("0x")) throw Error("Bad multicall result")

const decoded = mcIface.decodeFunctionResult("aggregateGasLimited", mcOut)
const results = decoded[1]
if (!Array.isArray(results)) throw Error("Bad results array")

// 3) Collect (address, points) and sort desc by points, tie-break by lower address
const pairs = []
for (let i = 0; i < addresses.length; i++) {
  const r = results[i]
  if (r.success) {
    const p = pointsIface.decodeFunctionResult("getPoints", r.returnData)[0]
    pairs.push([addresses[i], BigInt(p.toString())])
  }
}
if (pairs.length < 3) throw Error("<3 success items")
pairs.sort((a, b) => {
  if (a[1] > b[1]) return -1
  if (a[1] < b[1]) return 1
  // tie-break by address numeric value (lower first)
  const aa = BigInt(a[0].toLowerCase())
  const bb = BigInt(b[0].toLowerCase())
  if (aa < bb) return -1
  if (aa > bb) return 1
  return 0
})

const top3 = pairs.slice(0, 3).map((x) => x[0])
const enc = new ethers.AbiCoder().encode(["address", "address", "address"], top3)
return (await import("npm:ethers@6.9.0")).ethers.getBytes(enc)
