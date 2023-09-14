#! /usr/bin/env node

const mailboxABI = require('../abi/Mailbox.json').abi;
const infuraCfg = require('../cfg/infura.json');

const { Command } = require("commander");
const figlet = require("figlet");
const ethers = require("ethers");
const chalk = require("chalk");
const fs = require('fs');

require('dotenv').config({ path: './cfg/.env' })

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
    .command('search <matchingFile>')
    .description('Search for interchain messages using arguments from the matchingFile')
    .action(async (matchingFile: string) => {
        try {
            if (!fs.existsSync(matchingFile)) {
                console.log(chalk.red(`The matching file was not found: ${matchingFile}`));
                process.exit();
            }

            // Read the matching file into an object
            const fileContent = fs.readFileSync(matchingFile, 'utf-8');
            const jsonMatchingFile = JSON.parse(fileContent);

            let senderAddressFilter: any[] = [];
            let recipientAddressFilter: any[] = [];
            let destDomainFilter: any[] = [];
            
            if (jsonMatchingFile.hasOwnProperty("senderAddress")) {
                if (typeof jsonMatchingFile.senderAddress == "string" && jsonMatchingFile.senderAddress != "*") {
                    senderAddressFilter.push(ethers.zeroPadValue(jsonMatchingFile.senderAddress, 32));
                } else if (Array.isArray(jsonMatchingFile.senderAddress)) {
                    senderAddressFilter = jsonMatchingFile.senderAddress.map((addr: string) => ethers.zeroPadValue(addr, 32));
                } 
            }

            if (jsonMatchingFile.hasOwnProperty("recipientAddress")) {
                if (typeof jsonMatchingFile.recipientAddress == "string" && jsonMatchingFile.recipientAddress != "*") {
                    recipientAddressFilter.push(ethers.zeroPadValue(jsonMatchingFile.recipientAddress, 32));
                } else if (Array.isArray(jsonMatchingFile.recipientAddress)) {
                    recipientAddressFilter = jsonMatchingFile.recipientAddress.map((addr: string) => ethers.zeroPadValue(addr, 32));
                } 
            }

            if (jsonMatchingFile.hasOwnProperty("destinationDomain")) {
                if (typeof jsonMatchingFile.destinationDomain == "number" && jsonMatchingFile.destinationDomain != "*") {
                    destDomainFilter.push(ethers.toBeHex(jsonMatchingFile.destinationDomain, 32));
                } else if (Array.isArray(jsonMatchingFile.destinationDomain)) {
                    destDomainFilter = jsonMatchingFile.destinationDomain.map((domain: number) => ethers.toBeHex(domain, 32));
                } 
            }

            if (senderAddressFilter == null) {
                console.log(chalk.yellow(`Searching for dispatch events from all senders\n`));                
            } else {
                console.log(chalk.yellow(`Searching for dispatch events from ${senderAddressFilter}\n`));
            }

            if (jsonMatchingFile.hasOwnProperty("originDomain")) {                
                if (typeof jsonMatchingFile.originDomain == "number" && jsonMatchingFile.originDomain != "*") {
                    queryLogs(jsonMatchingFile.originDomain, senderAddressFilter, destDomainFilter, recipientAddressFilter);
                } else if (Array.isArray(jsonMatchingFile.originDomain)) {
                    jsonMatchingFile.originDomain.map((domain: number) => queryLogs(domain, senderAddressFilter, destDomainFilter, recipientAddressFilter));
                } 
            } else if (!jsonMatchingFile.hasOwnProperty("originDomain") || (jsonMatchingFile.hasOwnProperty("originDomain") && jsonMatchingFile.originDomain == "*")) {                
                for (const originDomain in infuraCfg) {
                    queryLogs(parseInt(originDomain), senderAddressFilter, destDomainFilter, recipientAddressFilter);
                }
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

function hexToString(hexString: string): string {
    let hex  = hexString.toString();
	var str = '';
	for (var n = 0; n < hex.length; n += 2) {
		str += String.fromCharCode(parseInt(hex.substr(n, 2), 16));
	}
	return str;
}

async function queryLogs(originDomain: number, senderAddressFilter: any, destDomainFilter: any, recipientAddressFilter: any) {
    const infuraString = infuraCfg[originDomain];
    const rpcURL = `https://${infuraString}.infura.io/v3/${process.env.INFURA_API_KEY}`;
    console.log(chalk.yellow(`Using RPC URL: ${rpcURL}\n`));

    const oProvider = new ethers.JsonRpcProvider(rpcURL);
    const currentBlock = await oProvider.getBlockNumber();

    // Define the parameters for the getLogs call
    const filter = {
        fromBlock: currentBlock - 100000, // Last 100,000 blocks
        toBlock: 'latest',
        address: process.env.MAILBOX_ADDRESS, // Address of the contract that emits the Dispatch event
        topics: [ethers.id('Dispatch(address,uint32,bytes32,bytes)'), // Keccak256 hash of the Dispatch event signature
            senderAddressFilter,
            destDomainFilter,
            recipientAddressFilter]
    };            

    // Query the logs
    try {
        const logs = await oProvider.getLogs(filter);
        let count = 0;

        logs.forEach((log: any) => {
            let hexMessage = log.data.substring(284).split("").reverse().join("").replace(/^0+/, '').split("").reverse().join("");
            let strMessage = hexToString(hexMessage);
            console.log(chalk.green(`Transaction Hash: ${log.transactionHash} (https://explorer.hyperlane.xyz/?search=${log.transactionHash}), message: ${strMessage}`));    
            count++;
        });

        if (count > 0) console.log(chalk.blue(`\nTotal transactions found: ${count}\n`));

    } catch (error) {
        console.error('Error fetching logs:', error);
    }

}