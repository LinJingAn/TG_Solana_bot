 
function formatLargeNumber(num) {
    if (num >= 1e9) {
        return Math.floor(num / 1e9) + ' B';
    } else if (num >= 1e6) {
        return Math.floor(num / 1e6) + ' M';
    } else if (num >= 1e3) {
        return Math.floor(num / 1e3) + ' K';
    }
    return num.toString();
}

//init
function formatMins(num) {
    if(num >= 60){
        return Math.floor(num / 60) + 'hour ' + (num % 60) + 'mins ago'
    } else
        return num + 'mins ago'
}

(async () => {
    const mintAddress = '';
    console.log(mintAddress)
    const tokenInfo = await (await fetch(`https://api.rugcheck.xyz/v1/tokens/${mintAddress}/report`)).json();
    const name = tokenInfo.tokenMeta.name;
    const symbol = tokenInfo.tokenMeta.symbol;
    const price = tokenInfo.price.toFixed(5);
    const liquidity = tokenInfo.totalMarketLiquidity.toFixed(2);
    const decimals = tokenInfo.token.decimals;
    const totalSupplyNumber = tokenInfo.token.supply / 10 ** decimals;
    const totalSupply = formatLargeNumber(totalSupplyNumber);
    const ownerAddress = tokenInfo.creator;

    const devWalletTokens = await(await fetch(`https://mainnet.helius-rpc.com/?api-key=35f98539-6eae-4584-a11c-6feae60f0393`, {
        method: 'POST',
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          "id": "text",
          "jsonrpc": "2.0",
          "method": "getTokenAccounts",
          "params": {
            "mint": mintAddress,
            "owner": ownerAddress,
          }
        })
    })).json();
    const devWalletBalance = devWalletTokens.result.token_accounts.length ? devWalletTokens.result.token_accounts[0].amount : 0;
    const devHolderPercentage = ((devWalletBalance / tokenInfo.token.supply) * 100).toFixed(2);

    const topHolderPercentage = tokenInfo.topHolders[0].pct.toFixed(2);
    let lpLockedUSD = 0, totallpUSD = 0;
    tokenInfo.markets.map(pair => {
        lpLockedUSD += pair.lp.lpLockedUSD;
        totallpUSD += (pair.lp.quoteUSD + pair.lp.baseUSD);
    })
    const lpTokenPercentage = (lpLockedUSD / totallpUSD * 100).toFixed(2);

    const dexScreenerData = await (await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mintAddress}`)).json();
    const marketCap = Math.floor(dexScreenerData.pairs.reduce((sum, pair) => sum + pair.marketCap, 0));
    const pair = dexScreenerData.pairs[0];
    const createdAt = formatMins(Math.floor((Date.now() - pair.pairCreatedAt) / 60000));

    console.log(`📌 ${name} (${symbol})
💰 Price: ${price}
🆔 CA: ${mintAddress}
⏳ Created: ${createdAt}
📈 Market Cap: ${marketCap}
💧 Liquidity: $${liquidity}
💵 Total Supply: ${totalSupply}
👨‍💻 Dev Hold: ${devHolderPercentage}%
🏦 Top Holder: ${topHolderPercentage}%
🪣 LP Tokens: ${lpTokenPercentage}%`)
})();

/*
📌 Lovely (LVY)
💰 Price: $0.00014
🆔 CA: 7abc...3xyz
⏳ Created: 2 hours ago
📈 Market Cap: $60,000
💧 Liquidity: $12,000
💵 Total Supply: 1.24B
👨‍💻 Dev Hold: 2.8%
🏦 Top Holder: 9.7%
🪣 LP Tokens: 39%
*/