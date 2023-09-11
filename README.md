# Hyperlane CLI Tool

## Setup

1. Clone this repo to your local machine
2. Install all packages required by running:

```
npm i
```

3. Create a .env file in the root folder of the project with the following entries:

```
WALLET_PK=<YOUR WALLET PRIVATE KEY ON THE ORIGIN CHAIN>
MAILBOX_ADDRESS="0xcc737a94fecaec165abcf12ded095bb13f037685"
```

4. Build the project:

```
npm run build
```

## Usage

### 1. Sending interchain messages
<br/>

Use the command:

```
hl send <originChain> <mailboxAddress> <rpcUrl> <destinationChain> <destinationAddress> <testMessage>
```

Example of sending a message from Polygon (Mumbai) to Ethereum (Sepolia) chains:

```
hl send 80001 0xCC737a94FecaeC165AbCf12dED095BB13F037685 https://polygon-mumbai.infura.io/v3/78f4cab345de410d828f2ab1ab536123 11155111 0x36FdA966CfffF8a9Cdc814f546db0e6378bFef35 "Test msg from Mumbai to Sepolia"
```

### 2. Search for messages

Use the command:

```
hl search <originChain> <senderAddress> <destinationChain> <recipientAddress>
```

Example of searching Ethereum (Sepolia) for messages from 0x78eeee6a6870526cdfF97BF205C1DeB4A8b2cA61 being sent to Polygon (Mumbai) address 0x36FdA966CfffF8a9Cdc814f546db0e6378bFef35

```
hl search 11155111 0x78eeee6a6870526cdfF97BF205C1DeB4A8b2cA61 80001 0x36FdA966CfffF8a9Cdc814f546db0e6378bFef35
```

