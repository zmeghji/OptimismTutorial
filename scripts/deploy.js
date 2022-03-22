const { providers, Wallet } = require('ethers')
const { ethers } = require('hardhat')
const { Watcher } = require('@eth-optimism/core-utils')
const { predeploys, getContractInterface } = require('@eth-optimism/contracts')
require('dotenv').config()

const walletPrivateKey = process.env.PRIVATE_KEY

const l1Provider = new providers.JsonRpcProvider(process.env.KOVAN_RPC_URL)
const l1Wallet = new Wallet(walletPrivateKey, l1Provider)

const l2Provider = new providers.JsonRpcProvider(process.env.OPTIMISM_RPC_URL)
const l2Wallet = new Wallet(walletPrivateKey, l2Provider)

const l2BridgeAddress = '0x4200000000000000000000000000000000000010';
async function main() {

    // //Deploy Layer 1 Token
    let rootToken = await deploy("RootToken", l1Wallet, []);

    // //Deploy token on layer 2 
    let childToken = await deploy("ChildToken", l2Wallet, [l2BridgeAddress, rootToken.address])


    //Get the address of the bridge on layer 1
    const l2StandardBridge = getContract(
        `../node_modules/@eth-optimism/contracts/artifacts/contracts/L2/messaging/L2StandardBridge.sol/L2StandardBridge.json`,
        l2BridgeAddress
    )
    const l1StandardBridgeAddress = await l2StandardBridge.l1TokenBridge();
    console.log(`The l1 standard bridge address is ${l1StandardBridgeAddress}`);
    const l1StandardBridge = getContract(
        `../node_modules/@eth-optimism/contracts/artifacts/contracts/L1/messaging/L1StandardBridge.sol/L1StandardBridge.json`,
        l1StandardBridgeAddress
    )

    //Approve tokens to be transferred by bridge
    console.log("Approving tokens for transfer by bridge")
    let amount = hre.ethers.utils.parseEther('1000.0');
    let tx1 = await rootToken.approve(l1StandardBridgeAddress, amount);
    await tx1.wait();

    //Deposit tokens to L2
    console.log("Depositing tokens to l2");
    const tx2 = await l1StandardBridge.depositERC20(
        rootToken.address,
        childToken.address,
        amount,
        2000000, //gas
        '0x')
    await tx2.wait();

    const l2Messenger = getL2Messenger()
    const l1Messenger = await getL1Messenger(l2Messenger);
    const watcher = getWatcher(l1Messenger.address, l2Messenger.address);
    
    logWithTime('Waiting for deposit to be relayed to L2...');
    const [ msgHash1 ] = await watcher.getMessageHashesFromL1Tx(tx2.hash)
    const receipt = await watcher.getL2TransactionReceipt(msgHash1, true);

    logWithTime(`Balance on L1: ${await rootToken.balanceOf(l1Wallet.address)}`) 
    logWithTime(`Balance on L2: ${await childToken.balanceOf(l1Wallet.address)}`) 
    

    // Burn the tokens on L2 and ask the L1 contract to unlock on our behalf.
    logWithTime(`Withdrawing tokens back to L1 ...`)
    const tx3 = await l2StandardBridge.withdraw(
        childToken.address,
        amount,
        2000000, // gas cost
        '0x'
    );
    await tx3.wait()

    // Wait for the message to be relayed to L1.
    logWithTime(`Waiting for withdrawal to be relayed to L1...`)
    const [ msgHash2 ] = await watcher.getMessageHashesFromL2Tx(tx3.hash)
    await watcher.getL1TransactionReceipt(msgHash2)

    // Log balances again!
    console.log(`Balance on L1: ${await L1_ERC20.balanceOf(l1Wallet.address)}`) // 1234
    console.log(`Balance on L2: ${await L2_ERC20.balanceOf(l1Wallet.address)}`) // 0
}


async function deploy(contractName, wallet, constructorArgs) {
    const Contract = await (await ethers.getContractFactory(contractName)).connect(wallet);
    const contract = await Contract.deploy(...constructorArgs);
    console.log(`Deploying ${contractName} `);
    await contract.deployed();
    console.log(`${contractName} deployed to:`, contract.address);
    return contract;
}

function getContract(artifactPath, address) {
    const artifact = require(artifactPath)
    const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode)
    const contract = factory
        .connect(l2Wallet)
        .attach(address)
    return contract;
}
function getL2Messenger(){
    return new ethers.Contract(
        predeploys.L2CrossDomainMessenger,
        getContractInterface('L2CrossDomainMessenger'),
        l2Provider
    )
}

async function getL1Messenger(l2Messenger){
    return new ethers.Contract(
        await l2Messenger.l1CrossDomainMessenger(),
        getContractInterface('L1CrossDomainMessenger'),
        l1Provider
    )
}

function getWatcher(l1MessengerAddress, l2MessengerAddress){
    // Tool that watches and waits for messages to be relayed between L1 and L2.
  return new Watcher({
    l1: {
      provider: l1Provider,
      messengerAddress: l1MessengerAddress
    },
    l2: {
      provider: l2Provider,
      messengerAddress: l2MessengerAddress
    }
  })
}

function logWithTime(message){
    console.log(`${new Date().toTimeString()} - ${message}`);
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    })