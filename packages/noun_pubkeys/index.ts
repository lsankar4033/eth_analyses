import { ethers } from "ethers";

import fs from "fs";
import * as parse from "csv-parse";

import axios from "axios";

const etherscanApiKey = process.env.ETHERSCAN_API_KEY;
const infuraApiKey = process.env.INFURA_API_KEY;

const provider = new ethers.providers.JsonRpcProvider(
  `https://mainnet.infura.io/v3/${infuraApiKey}`
);

async function getNoPubkeyAddresses() {
  const fileData = await fs.promises.readFile("./data/no_pubkey_nouners.csv");

  const rows = await new Promise<any[]>((resolve, reject) => {
    parse.parse(fileData, { columns: true, trim: true }, (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });

  const addrs: any[] = [];
  for (const row of rows) {
    addrs.push(row["to"]);
  }
  return addrs;
}

async function checkGnosisSafes(addrENSPairs: Array<[string, string]>) {
  for (const [addr, ens] of addrENSPairs) {
    const contract = new ethers.Contract(
      addr,
      ["function getOwners() view returns (address[])"],
      provider
    );

    const owners = await contract.getOwners();

    let numPubkeyOwners = 0;
    for (const owner of owners) {
      const res = await axios.get(
        "https://api.etherscan.io/api" +
          "?module=account" +
          "&action=txlist" +
          `&address=${owner}` +
          "&startblock=0" +
          "&endblock=99999999" +
          `&apikey=${etherscanApiKey}`
      );

      const txes = res["data"]["result"];
      const fromTxes = txes.filter(
        (tx: any) => tx.from.toLowerCase() == owner.toLowerCase()
      );

      if (fromTxes.length > 0) {
        numPubkeyOwners += 1;
      }
    }

    console.log(
      `${numPubkeyOwners} : ${owners.length} pubkeys : owners for ${ens} (${addr})}`
    );
  }
}

async function run() {
  const addresses = await getNoPubkeyAddresses();

  const ensAddrs: Array<[string, string]> = [];
  for (const addr of addresses) {
    const result = await provider.lookupAddress(addr);

    if (result !== null) {
      console.log(addr, result);
      ensAddrs.push([addr, result]);
    }
  }

  await checkGnosisSafes(ensAddrs);
}

run();
