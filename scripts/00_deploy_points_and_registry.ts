import { ethers } from "hardhat"
import crypto from "crypto"
import fs from "fs"
import path from "path"

async function main() {
  const [deployer] = await ethers.getSigners()
  console.log("Deployer:", deployer.address)

  const Points = await ethers.getContractFactory("Points")
  const pointsAddrs: string[] = []
  const total = 100
  for (let i = 0; i < total; i++) {
    // ids 0..99; fixed tops: 10→999, 6→888, 69→777; others random 1..100 per run
    let score: number
    if (i === 10) score = 999
    else if (i === 6) score = 888
    else if (i === 69) score = 777
    else score = crypto.randomInt(1, 101)
    const c = await Points.deploy(score)
    await c.deployed()
    pointsAddrs.push(c.address)
  }
  console.log("Points count:", pointsAddrs.length)

  const Registry = await ethers.getContractFactory("PointsRegistry")
  const reg = await Registry.deploy()
  await reg.deployed()
  const tx = await reg.addMany(pointsAddrs)
  await tx.wait()
  console.log("Registry:", reg.address)

  writeArtifact("PointsRegistry", { address: reg.address })
  writeArtifact("PointsSet", { addresses: pointsAddrs })
}

function writeArtifact(name: string, data: any) {
  const dir = path.join(__dirname, "../deploy-artifacts")
  if (!fs.existsSync(dir)) fs.mkdirSync(dir)
  fs.writeFileSync(path.join(dir, `${name}.json`), JSON.stringify(data, null, 2))
}

main().catch((e) => { console.error(e); process.exit(1) })


