import { ethers } from "hardhat"
import fs from "fs"
import path from "path"

async function main() {
  const dir = path.join(__dirname, "../deploy-artifacts")
  const consumer = JSON.parse(fs.readFileSync(path.join(dir, "Top3Consumer.json"), "utf8"))
  const registry = JSON.parse(fs.readFileSync(path.join(dir, "PointsRegistry.json"), "utf8"))

  const consumerAbi = ["function top5Ids(uint256) view returns (uint8)"]
  const registryAbi = ["function getById(uint8) view returns (address)"]
  const pointsAbi = ["function getPoints() view returns (uint256)"]

  const c = await ethers.getContractAt(consumerAbi, consumer.address)
  const r = await ethers.getContractAt(registryAbi, registry.address)

  const id0: number = await c.top5Ids(0)
  const id1: number = await c.top5Ids(1)
  const id2: number = await c.top5Ids(2)
  const id3: number = await c.top5Ids(3)
  const id4: number = await c.top5Ids(4)

  const a0 = await r.getById(id0)
  const a1 = await r.getById(id1)
  const a2 = await r.getById(id2)
  const a3 = await r.getById(id3)
  const a4 = await r.getById(id4)

  // Fetch points for each address
  const p0 = await (await ethers.getContractAt(pointsAbi, a0)).getPoints()
  const p1 = await (await ethers.getContractAt(pointsAbi, a1)).getPoints()
  const p2 = await (await ethers.getContractAt(pointsAbi, a2)).getPoints()
  const p3 = await (await ethers.getContractAt(pointsAbi, a3)).getPoints()
  const p4 = await (await ethers.getContractAt(pointsAbi, a4)).getPoints()

  console.log("Top5 IDs:", id0, id1, id2, id3, id4)
  console.log("Top5 addresses via registry:\n", a0, "\n", a1, "\n", a2, "\n", a3, "\n", a4)
  console.log("Top5 scores:")
  console.log(`${id0} ${a0} ${p0.toString()}`)
  console.log(`${id1} ${a1} ${p1.toString()}`)
  console.log(`${id2} ${a2} ${p2.toString()}`)
  console.log(`${id3} ${a3} ${p3.toString()}`)
  console.log(`${id4} ${a4} ${p4.toString()}`)
}

main().catch((e) => { console.error(e); process.exit(1) })


