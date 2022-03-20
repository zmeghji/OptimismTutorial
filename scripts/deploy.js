const { providers, Wallet } = require('ethers')
const { ethers } = require('hardhat')
require('dotenv').config()

const walletPrivateKey = process.env.PRIVATE_KEY

const l1Provider = new providers.JsonRpcProvider(process.env.KOVAN_RPC_URL)
const l1Wallet = new Wallet(walletPrivateKey, l1Provider)

const l2Provider = new providers.JsonRpcProvider(process.env.OPTIMISM_RPC_URL)
const l2Wallet = new Wallet(walletPrivateKey, l2Provider)


async function main(){
    //Deploy Layer 1 Token
    await deploy("RootToken", l1Wallet, []);
}


async function deploy(contractName, wallet, constructorArgs) {
    const Contract = await (await ethers.getContractFactory(contractName)).connect(wallet);
    const contract = await Contract.deploy(...constructorArgs);
    console.log(`Deploying ${contractName} `);
    await contract.deployed();
    console.log(`${contractName} deployed to:`, contract.address);
    return contract;
}

main()
    .then( () => process.exit(0))
    .catch( error => {
        console.error(error);
        process.exit(1);
    })