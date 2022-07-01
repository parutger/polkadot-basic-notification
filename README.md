# Polkadot Notifications Service

A notification system for any substrate-based chain (Polkadot, its parachains, etc.)

The underlying workings of this program is as follows: We have a list of accounts which we want to
monitor, stored as ss58 string representation. The script then listens to incoming blocks of any
given chain, and does a full-text search of the account strings in the `stringified` representation
of both the transactions in the block, and entire events that are emitted at this block.

This is super simple, yet enough to detect any interaction to or from your accounts of interest.
Some covered examples are:

- Any transaction signed by your accounts is detected, successful or unsuccessful.
- Your staking rewards are detected both via the `Rewarded` and `Deposited` events.
- Any transfer to your account is detected, both since your account will be an argument of the
  `transfer` transaction, and the `Deposited` event.

Any of such events creates a `report`. Any block that contains a non-zero number of reports is
passed to an arbitrary number of `Reporter`s for delivery. The `Reporter`s are essentially the
transport mechanism, i.e. how you want to be notified. Current implementations are:

1. Matrix, using `matrix-js-sdk`.
2. Email, optionally supporting GPG encryption as well.
4. Console, for use in for log aggregators

## How to use

You need to provide one configuration file to the program, which specifies 3 things:

1. which accounts you want to monitor.
2. which chains you want to monitor.
3. which methods you want to monitor.
4. which reporters you want to use.

A documented examples is as follows:

```javascript
{
  // The list of addresses you want to monitor.
  // If the list is empty, then no account filter is applied. This means that all events and
  // transactions will match. This only makes sense when using extrinsicFilter and eventFilter.
  "accounts": [
    { "address": "<ss58_address>", "label": "<account_nickname>"},
    { "address": "<ss58_address>", "label": "<account_nickname>"}
  ],
  // a list of ws-endpoint to which we start to listen. For example, Polkadot's is "wss://rpc.
  // polkadot.io". The cool thing here is that ANY substrate-based chain will work, so you can add
  // accounts from parachains (Acala, Statemine), solo-chains (Aleph-zero), or even ethereum-based
  // chains like moonbeam.
  "endpoints": [
    "wss://rpc.polkadot.io",
    "wss://statemine-rpc.polkadot.io",
    "wss://acala-polkadot.api.onfinality.io/public-ws",
    "wss://wss.api.moonbeam.network",
    "wss://ws.azero.dev"
  ],
  // a case-sensitive list of Extrinsic methods that you want to subscribe to.
  "extrinsicFilter": [
    "sudo.sudo"
  ],
  // a case-sensitive list of Events that you want to subscribe to.
  "eventFilter": [
    "balances.Transfer",
    "democracy.Passed"
  ],
  // This is where you specify which reporters you want to use.
  "reporters": {
    // if provided, report all events to a matrix room.
    "matrix": {
      "userId": "<your userid>",
      "accessToken": "<your access token>",
      "server": "<https://matrix.your.home.server>",
      "roomId": "<!roomID:matrix.server>"
    },

    // if provided, report all events to a set of email addresses.
    "email": {
      // the address from which you send the emails. It must be owned by the `transporter.auth` credentials once authenticated with `transporter.host`.
      "from": "from@polkadot-basic-notification.xyz",
      // The list of addresses that get notified.
      "to": ["from1@dot-basic-notification.xyz", "from2@dot-basic-notification.xyz"],
      // optional: if provided, your messages will be encrypted, but the formatting might not be as good.
      "gpgpubkey": "./pub.key",
      // this must be exactly the same object as used in the nodemailer library. See here for // more information: https://nodemailer.com/smtp/
      "transporter": {
        "host": "smtp.youremail.org",
        "port": 587,
        "secure": false,
        "auth": {
          "user": "...",
          "pass": "..."
        }
      }
    },
    // enabling this will print all reports to console as well.
    "console": true,
  }
}

```

You can mix and match different reporters with different configs together.

## Deployment

```
$ npm run build
$ npm run start
# OR
$ npm run build-start
```

Alternatively, you can build a container image from from this application based on the provided
`Containerfile`. To build the image:

```
$ buildah bud --tag polkadot-notifications:latest --file ./Containerfile
# note how the config file must be passed as an environment variable and is placed in a mounted volume.
$ podman run -v ./config:/config -e APP_CONFIG_FILE=/config/config.json polkadot-notifications:latest
```

## Acknowledgement

This project was initially created by @kianenigma.
https://github.com/kianenigma/polkadot-basic-notification
