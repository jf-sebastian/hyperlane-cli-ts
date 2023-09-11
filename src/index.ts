#! /usr/bin/env node

const mailboxABI = require('../abi/Mailbox.json').abi;

const { Command } = require("commander");
const figlet = require("figlet");
const ethers = require("ethers");
const chalk = require("chalk");
require('dotenv').config();

const program = new Command();

console.log(figlet.textSync("Hyperlane CLI Tool"));
console.log();

// Set up the command line interface
program
    .name("hl")
    .description("A CLI for interacting with the Hyperlane API")
    .version("0.0.1")

// Details of the send command for the CLI
program
    .command('send <originChain> <mailboxAddress> <rpcUrl> <destinationChain> <destinationAddress> <testMessage>')
    .description('Send an interchain message using Hyperlane between ethereum sepolia and polygon mumbai')
    .action(async (originChain: number, mailboxAddress: string, rpcUrl: string, destinationChain: number, destinationAddress: string, testMessage: string) => {
        try {
            const oProvider = new ethers.JsonRpcProvider(rpcUrl);
            const signer = new ethers.Wallet(process.env.WALLET_PK, oProvider);
            console.log(chalk.red(`Linked to wallet: ${signer.address}\n`));

            // Obtain a reference to the origin mailbox
            const oMailboxAddr = mailboxAddress;
            const oMailbox = new ethers.Contract(oMailboxAddr, mailboxABI, signer);
            console.log(chalk.yellow(`Connected to Mailbox: ${mailboxAddress}\n`));

            const data = ethers.toUtf8Bytes(testMessage);
            console.log(chalk.blue(`Sending message: "${testMessage}"\n`));

            const dispatchResult = await oMailbox.dispatch(destinationChain, addressToBytes32(destinationAddress), data);
            console.log(chalk.green(`Message successully sent!\n`));
            console.log(chalk.green(`Check transaction on Hyperlane: https://explorer.hyperlane.xyz/?search=${dispatchResult.hash} (details may take 60 seconds to appear)`));
        } catch (error) {
            console.error("Error occurred!", error);
        }    
    });

// Details of the search command for the CLI
program
    .command('search <originChain> <senderAddress> <destinationChain> <recipientAddress>')
    .description('Search the origin chain for messages sent by a specified sender to a specified address on the destination chain')
    .action(async (originChain: string, senderAddress: string, destinationChain: number, recipientAddress: string) => {
        try {
            console.log(chalk.yellow(`Searching for dispatch events from ${senderAddress}\n`));
            const rpcUrl: string = lookupRPC(originChain);
            console.log(chalk.yellow(`Using RPC URL: ${rpcUrl}\n`));

            const oProvider = new ethers.JsonRpcProvider(rpcUrl);
            const currentBlock = await oProvider.getBlockNumber();

            // Define the parameters for the getLogs call
            const filter = {
                fromBlock: currentBlock - 10000, // Last 100 blocks
                toBlock: 'latest',
                address: process.env.MAILBOX_ADDRESS, // Address of the contract that emits the Dispatch event
                topics: [ethers.id('Dispatch(address,uint32,bytes32,bytes)'), // Keccak256 hash of the Dispatch event signature
                    ethers.zeroPadValue(senderAddress, 32),
                    null,
                    ethers.zeroPadValue(recipientAddress,32)]
            };            

            // Query the logs
            try {
                const intrfc = new ethers.Interface(mailboxABI);
                const logs = await oProvider.getLogs(filter);

                logs.forEach((log: any) => {
                    let parsedLog = intrfc.parseLog(log).args[1];
                    if (parsedLog == destinationChain) {
                        let hexMessage = log.data.substring(284).split("").reverse().join("").replace(/^0+/, '').split("").reverse().join("");
                        let strMessage = hexToString(hexMessage);
                        console.log(chalk.green(`Transaction Hash: ${log.transactionHash}, message: ${strMessage}`));    
                    }
                });

            } catch (error) {
                console.error('Error fetching logs:', error);
            }
        } catch (error) {
            console.error("Error occurred!", error);
        }    
    });


program.parse();

if (!process.argv.slice(2).length) {
    program.outputHelp();
}

function addressToBytes32(address: string) {
    return ethers.zeroPadValue(ethers.stripZerosLeft(address), 32).toLowerCase();
}

function lookupRPC(chain: string) : string {
    let rpcURL : string;

    switch(chain) {
        case "11155111": 
            rpcURL = "https://sepolia.infura.io/v3/78f4cab345de410d828f2ab1ab536fdf"
            break;
        case "80001":
            rpcURL = "https://polygon-mumbai.infura.io/v3/78f4cab345de410d828f2ab1ab536fdf"
            break;
        default:
            rpcURL = "https://sepolia.infura.io/v3/78f4cab345de410d828f2ab1ab536fdf"
    }

    return rpcURL;
}

function hexToString(hexString: string): string {
    let hex  = hexString.toString();
	var str = '';
	for (var n = 0; n < hex.length; n += 2) {
		str += String.fromCharCode(parseInt(hex.substr(n, 2), 16));
	}
	return str;
}