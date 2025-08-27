import { ethers } from "hardhat"
import fs from "fs"
import path from "path"

async function main() {
  const dir = path.join(__dirname, "../deploy-artifacts")
  const consumer = JSON.parse(fs.readFileSync(path.join(dir, "Top3Consumer.json"), "utf8"))

  const abi = ["function top3(uint256) view returns (address)"]
  const c = await ethers.getContractAt(abi, consumer.address)
  const a0 = await c.top3(0)
  const a1 = await c.top3(1)
  const a2 = await c.top3(2)

  console.log("Top3 in Consumer:\n", a0, "\n", a1, "\n", a2)
}

main().catch((e) => { console.error(e); process.exit(1) })


