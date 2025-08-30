// Runs inside Chainlink Functions (Deno runtime)
// Uses localFunctionsTestnet JSON-RPC at http://localhost:8545
// New Args: [registryAddress]

if (!args || args.length < 1) {
  throw Error("Expected args: [registryAddress]")
}

const REGISTRY = args[0]

const { ethers } = await import("npm:ethers@6.9.0")

// Use JsonRpcProvider with static network to avoid extra eth_chainId probe (saves 1 HTTP)
const provider = new ethers.JsonRpcProvider("http://localhost:8545", { chainId: 1337, name: "localFunctionsTestnet" })

// Registry interface for new meta + ranged aggregation
const regIface = new ethers.Interface([
  "function activationMeta() view returns (uint256, bytes)",
  "function aggregatePointsRange(uint256 start, uint256 count) view returns (uint128[])",
])

// 1) Fetch total and activation bitmap (1 HTTP)
const metaData = regIface.encodeFunctionData("activationMeta")
const metaHex = await provider.call({ to: REGISTRY, data: metaData })
if (!metaHex || typeof metaHex !== "string" || !metaHex.startsWith("0x")) throw Error("Bad activationMeta")
const [totalBn, bitmap] = regIface.decodeFunctionResult("activationMeta", metaHex)
const total = BigInt(totalBn.toString())
if (total === 0n) {
  // return empty packed uint256[8]
  const zeros = Array(8).fill(0n)
  const encEmpty = new ethers.AbiCoder().encode(["uint256[8]"], [zeros])
  return (await import("npm:ethers@6.9.0")).ethers.getBytes(encEmpty)
}

const bytesBitmap = ethers.getBytes(bitmap)

// Fast path: if no active bits, return zeros without range calls
let anyActive = false
for (let i = 0; i < bytesBitmap.length; i++) {
  if (bytesBitmap[i] !== 0) {
    anyActive = true
    break
  }
}
if (!anyActive) {
  const zeros = new Array(8).fill(0n)
  const encEmpty = new ethers.AbiCoder().encode(["uint256[8]"], [zeros])
  return (await import("npm:ethers@6.9.0")).ethers.getBytes(encEmpty)
}

// 2) Up to 4 range calls of 800
const BATCH = 800n
const maxBatches = 4n
const neededBatches = (total + BATCH - 1n) / BATCH
const batches = neededBatches > maxBatches ? maxBatches : neededBatches
const allPairs = [] // [id:number, points:bigint]
for (let b = 0n; b < batches; b++) {
  const start = b * BATCH
  const left = total > start ? total - start : 0n
  const take = left < BATCH ? left : BATCH
  if (take === 0n) break
  const dataAgg = regIface.encodeFunctionData("aggregatePointsRange", [start, take])
  const aggHex = await provider.call({ to: REGISTRY, data: dataAgg })
  if (!aggHex || typeof aggHex !== "string" || !aggHex.startsWith("0x")) throw Error("Bad aggregatePointsRange")
  const arr = regIface.decodeFunctionResult("aggregatePointsRange", aggHex)[0]
  for (let i = 0n; i < take; i++) {
    const id = Number(start + i) // uint16 range
    // apply bitmap: check bit id
    const byteIndex = Number((start + i) / 8n)
    const bitIndex = Number((start + i) % 8n)
    const bitSet = (bytesBitmap[byteIndex] & (1 << bitIndex)) !== 0
    if (bitSet) {
      const p = BigInt(arr[Number(i)].toString())
      if (p > 0n) allPairs.push([id, p])
    }
  }
}

// 3) Sort by points desc, tie by lower id
allPairs.sort((a, b) => {
  if (a[1] > b[1]) return -1
  if (a[1] < b[1]) return 1
  return a[0] - b[0]
})

// 4) Take up to 128 ids and pack into uint256[8] (16 ids per word, 16 bits each)
let takeIds = allPairs.slice(0, 128).map((x) => x[0])
// Pad with sentinel 0xFFFF for empty slots to avoid ambiguous id=0
while (takeIds.length < 128) takeIds.push(0xffff)
const words = new Array(8).fill(0n)
for (let i = 0; i < takeIds.length; i++) {
  const wordIndex = Math.floor(i / 16)
  const slot = i % 16
  const shift = BigInt(slot * 16)
  words[wordIndex] |= (BigInt(takeIds[i]) & 0xffffn) << shift
}

const enc = new ethers.AbiCoder().encode(["uint256[8]"], [words])
return (await import("npm:ethers@6.9.0")).ethers.getBytes(enc)
