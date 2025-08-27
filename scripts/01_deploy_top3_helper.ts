import { ethers } from "hardhat"
import fs from "fs"
import path from "path"

async function main() {
  const Helper = await ethers.getContractFactory("PointsTop3Helper")
  const helper = await Helper.deploy()
  await helper.deployed()
  console.log("Helper:", helper.address)

  writeArtifact("PointsTop3Helper", { address: helper.address })
}

function writeArtifact(name: string, data: any) {
  const dir = path.join(__dirname, "../deploy-artifacts")
  if (!fs.existsSync(dir)) fs.mkdirSync(dir)
  fs.writeFileSync(path.join(dir, `${name}.json`), JSON.stringify(data, null, 2))
}

main().catch((e) => { console.error(e); process.exit(1) })


