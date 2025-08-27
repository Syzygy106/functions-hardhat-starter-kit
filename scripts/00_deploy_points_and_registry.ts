import { ethers } from "hardhat"
import fs from "fs"
import path from "path"

async function main() {
  const [deployer] = await ethers.getSigners()
  console.log("Deployer:", deployer.address)

  const Points = await ethers.getContractFactory("Points")
  const pointsAddrs: string[] = []
  for (let p = 1; p <= 10; p++) {
    const c = await Points.deploy(p)
    await c.deployed()
    pointsAddrs.push(c.address)
  }
  console.log("Points:", pointsAddrs.join(", "))

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


