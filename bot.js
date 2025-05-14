const { Bot, InlineKeyboard, session } = require("grammy");
const express = require("express");
require("dotenv").config();

const bot = new Bot(process.env.TELEGRAM_BOT_TOKEN);

function formatLargeNumber(num) {
  if (num >= 1e9) {
    return (num / 1e9).toFixed(2) + "B";
  } else if (num >= 1e6) {
    return (num / 1e6).toFixed(2) + "M";
  } else if (num >= 1e3) {
    return (num / 1e3).toFixed(2) + "K";
  }
  return num.toString();
}

function formatMins(num) {
  if (num >= 60) {
    return Math.floor(num / 60) + "hour " + (num % 60) + "mins ago";
  } else return num + "mins ago";
}

const escapeMarkdownV2 = (text) => {
  return text.replace(/[_*[\]()~`>#+-=|{}.!]/g, "\\$&");

bot.use(
  session({
    initial: () => ({
      liquidityLockedMin: 1000,
      liquidityLockedMax: 100000,
      lpTokenMin: 0,
      devHoldingMin: 0,
      devHoldingMax: 5,
      topHoldingMin: 0,
      topHoldingMax: 50,
      awaitingInput: false,
      textName: null,
      socials: {
        twitter: true,
        website: true,
        telegram: true,
      },
    }),
  })
);

bot.command("start", async (ctx) => {
  await ctx.reply("Welcome! To filter meme coins.", {
    reply_markup: getMenu(ctx),
  });
});

bot.callbackQuery("confirm", async (ctx) => {
  await ctx.answerCallbackQuery({ text: "Processing..." });
  const heliusApiKey = process.env.HELIUS_API_KEY;
  let cnt = 0;
  ctx.reply("I'm fetching, please wait...");

  const recentTokens = await (
    await fetch("https://api.rugcheck.xyz/v1/stats/recent")
  ).json();

  for (let i = 0; i < recentTokens.length; i++) {
    const mintAddress = recentTokens[i].mint;
    const mintAddressCopyable =
      "[" +
      mintAddress.slice(0, 4) +
      "\\.\\.\\." +
      mintAddress.slice(-3) +
      "](https://solscan.io/token/" +
      mintAddress +
      ")";
    const tokenInfo = await (
      await fetch(`https://api.rugcheck.xyz/v1/tokens/${mintAddress}/report`)
    ).json();
    const mintAuthority = tokenInfo.token
      ? tokenInfo.token.mintAuthority
        ? "🟢 Yes"
        : "🔴 No"
      : "🔴 No";
    const freezeAuthority = tokenInfo.token
      ? tokenInfo.token.freezeAuthority
        ? "🟢 Yes"
        : "🔴 No"
      : "🔴 No";
    const name = tokenInfo.tokenMeta?.name;
    const symbol = tokenInfo.tokenMeta?.symbol;
    const price = tokenInfo.price.toFixed(5);
    const liquidity = formatLargeNumber(
      tokenInfo.totalMarketLiquidity.toFixed(2)
    );
    const decimals = tokenInfo.token?.decimals;
    const totalSupplyNumber = tokenInfo.token?.supply / 10 ** decimals;
    const totalSupply = formatLargeNumber(totalSupplyNumber);
    const ownerAddress = tokenInfo.creator;

    const devWalletTokens = await (
      await fetch(`https://mainnet.helius-rpc.com/?api-key=${heliusApiKey}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: "text",
          jsonrpc: "2.0",
          method: "getTokenAccounts",
          params: {
            mint: mintAddress,
            owner: ownerAddress,
          },
        }),
      })
    ).json();
    const devWalletBalance = devWalletTokens.result.token_accounts.length
      ? devWalletTokens.result.token_accounts[0].amount
      : 0;
    const devHolderPercentage = (
      (devWalletBalance / tokenInfo.token.supply) *
      100
    ).toFixed(2);

    let topHolderPercentage =
      tokenInfo.topHolders[0]?.owner !=
      "5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1"
        ? tokenInfo.topHolders[0]?.pct.toFixed(2)
        : tokenInfo.topHolders[1]?.pct.toFixed(2);
    let lpTokenPercentage = tokenInfo.topHolders[0]?.pct.toFixed(2);

    const dexScreenerData = await (
      await fetch(
        `https://api.dexscreener.com/latest/dex/tokens/${mintAddress}`
      )
    ).json();
    const marketCap = formatLargeNumber(
      Math.floor(
        dexScreenerData.pairs.reduce((sum, pair) => sum + pair.marketCap, 0)
      )
    );
    const pair = dexScreenerData.pairs[0];
    let createdAt = Math.floor((Date.now() - pair.pairCreatedAt) / 60000);
    dexScreenerData.pairs.map((dexpair) => {
      const pairCreatedAt = Math.floor(
        (Date.now() - dexpair.pairCreatedAt) / 60000
      );
      if (createdAt <= pairCreatedAt) createdAt = pairCreatedAt;
    });
    const website = pair.info
      ? pair.info.websites.length
        ? "✅ Website: " + escapeMarkdownV2(pair.info.websites[0].url)
        : "❌ Website: Not Found"
      : "❌ Website: Not Found";
    const socialsCount = pair.info ? pair.info.socials.length : 0;
    let tg = "❌ Telegram: Not Found";
    let twitter = "❌ Twitter: Not Found";
    const raydiumSwapUrl = `https://raydium.io/swap/?inputMint=sol&outputMint=${mintAddress}`;
    for (let j = 0; j < socialsCount; j++) {
      if (pair.info.socials[j].type == "twitter")
        twitter =
          "✅ X: [Twitter](" + escapeMarkdownV2(pair.info.socials[j].url) + ")";
      else if (pair.info.socials[j].type == "telegram")
        tg =
          "✅ Telegram: [Join](" +
          escapeMarkdownV2(pair.info.socials[j].url) +
          ")";
    }

    if (
      !(twitter == "❌ Twitter: Not Found" && ctx.session.socials.twitter) &&
      !(tg == "❌ Telegram: Not Found" && ctx.session.socials.twitter) &&
      !(website == "❌ Website: Not Found" && ctx.session.socials.twitter) &&
      tokenInfo.totalMarketLiquidity >= ctx.session.liquidityLockedMin &&
      tokenInfo.totalMarketLiquidity <= ctx.session.liquidityLockedMax &&
      lpTokenPercentage >= ctx.session.lpTokenMin &&
      devHolderPercentage >= ctx.session.devHoldingMin &&
      devHolderPercentage <= ctx.session.devHoldingMax &&
      topHolderPercentage >= ctx.session.topHoldingMin &&
      topHolderPercentage <= ctx.session.topHoldingMax
    ) {
      const result = `🚀 New Token Found on Raydium\\! 🚀

🕒 Created: ${formatMins(createdAt)}📌
🔹 Token Name: ${escapeMarkdownV2(name)} \\(${escapeMarkdownV2(symbol)}\\)
🔹 Contract Address: ${mintAddressCopyable}
🔹 Price: $${escapeMarkdownV2(price)}
🔹 Market Cap: $${escapeMarkdownV2(marketCap)}
🔹 Total Supply: ${escapeMarkdownV2(totalSupply)} ${escapeMarkdownV2(symbol)}
🔹 Liquidity Locked: $${escapeMarkdownV2(liquidity)}
🔹 Dev Holdings: ${escapeMarkdownV2(devHolderPercentage)}%
🔹 Top Holdings: ${escapeMarkdownV2(topHolderPercentage)}%
🔹 LP Tokens: ${escapeMarkdownV2(lpTokenPercentage)}%

🛠 Minable: ${mintAuthority}
❄️ Freezable: ${freezeAuthority}

🔹 Socials:  
    \\- ${tg}
    \\- ${twitter}
    \\- ${website}

💰 Buy Now: [Trade on Raydium](${escapeMarkdownV2(raydiumSwapUrl)})
🎯 Instant Snipe:

⏳ *Detected instantly as liquidity was added\\!*
`;

      ctx.reply(result, { parse_mode: "MarkdownV2" });
      cnt++;
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  if (cnt === 0) {
    await ctx.reply("No Token based on your filter found!");
  } else {
    await ctx.reply("Done" + cnt);
  }
  await ctx.reply("✅ Updated filter!", {
    reply_markup: getMenu(ctx),
  });
});

const getMenu = (ctx) => {
  return new InlineKeyboard()
    .text(
      `${ctx.session.socials.twitter ? "✅" : "☑️"} Twitter`,
      "toggle_twitter"
    )
    .text(
      `${ctx.session.socials.website ? "✅" : "☑️"} Website`,
      "toggle_website"
    )
    .text(
      `${ctx.session.socials.telegram ? "✅" : "☑️"} Telegram`,
      "toggle_telegram"
    )
    .row()
    .text(
      `Liquidity Locked Min ${formatLargeNumber(
        ctx.session.liquidityLockedMin
      )} ?`,
      "liquidityLockedMin"
    )
    .row()
    .text(
      `Liquidity Locked Max ${formatLargeNumber(
        ctx.session.liquidityLockedMax
      )}?`,
      "liquidityLockedMax"
    )
    .row()
    .text(`LP Token Min ${ctx.session.lpTokenMin}%?`, "lpTokenMin")
    .row()
    .text(`Dev Holding Min ${ctx.session.devHoldingMin}%?`, "devHoldingMin")
    .row()
    .text(`Dev Holding Max ${ctx.session.devHoldingMax}%?`, "devHoldingMax")
    .row()
    .text(`Top Holding Min ${ctx.session.topHoldingMin}%?`, "topHoldingMin")
    .row()
    .text(`Top Holding Max ${ctx.session.topHoldingMax}%?`, "topHoldingMax")
    .row()
    .text("Confirm", "confirm");
};

const filterFields = [
  "liquidityLockedMin",
  "liquidityLockedMax",
  "lpTokenMin",
  "devHoldingMin",
  "devHoldingMax",
  "topHoldingMin",
  "topHoldingMax",
];

filterFields.forEach((field) => {
  bot.callbackQuery(field, async (ctx) => {
    ctx.session.textName = field;
    ctx.session.awaitingInput = true;
    await ctx.reply(`Please enter a value for ${field}:`);
    await ctx.answerCallbackQuery();
  });
});

bot.on("message:text", async (ctx) => {
  if (ctx.session.awaitingInput && ctx.session.textName) {
    const value = Number(ctx.message.text);
    if (isNaN(value)) {
      await ctx.reply("❌ Please enter a valid number.");
      return;
    }

    ctx.session[ctx.session.textName] = value;
    ctx.session.awaitingInput = false;
    ctx.session.textName = null;

    await ctx.reply("✅ Updated filter!", {
      reply_markup: getMenu(ctx),
    });
  }
});

bot.callbackQuery(/toggle_(twitter|website|telegram)/, async (ctx) => {
  await ctx.answerCallbackQuery({ text: "Processing..." });
  const social = ctx.match[1];
  ctx.session.socials[social] = !ctx.session.socials[social];
  await ctx.editMessageReplyMarkup({
    reply_markup: getMenu(ctx),
  });
  await ctx.answerCallbackQuery().catch((err) => {
    if (err.error_code !== 400) throw err;
  });
});

bot.start();

const app = express();
app.use(express.json());

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log("Server Listening on PORT:", port);
});

/*
🚀 New Token Found on Raydium! 🚀  

🕒 Created: 2 mins ago  
🔹 Token Name: PEPE 2.0 ($PEPE2)  
🔹 Contract Address: ABC123456789...  
🔹 Price: 0.000023 SOL  
🔹 Market Cap: $50K  
🔹 Total Supply: 1B $PEPE2  
🔹 Liquidity Locked: ✅ $12.5K USD  
🔹 Dev Holdings: 2.5%  
🔹 LP Tokens in Pool: 10% of Supply  

🛠 Minable: 🔴 No  
❄️ Freezable: 🟢 Yes  

🔹 Socials:  
   - ✅ Telegram: [Join](https://t.me/PEPE2)  
   - ✅ X: [Twitter](https://twitter.com/PEPE2)  
   - ❌ Website: Not Found  

💰 Buy Now: [Trade on Raydium](https://raydium.io/swap/PEPE2)  
🎯 Instant Snipe: [Trojan Buy](https://trojan.com/buy/PEPE2)  

⏳ *Detected instantly as liquidity was added!*
*/
