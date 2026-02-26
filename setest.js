/*
 * 文件名: check_market_price.js
 * 作用简述: 
 * 1. 根据指定的 tradeEnvironmentId 粗略抓取目标物品的所有在售列表。
 * 2. 在本地内存中，根据动态 Attributes (M/s 和 Mutations) 进行精准过滤。
 * 3. 将符合条件的商品按价格从低到高排序，打印出当前市场最低价和竞争对手信息。
 */

const { Amplify } = require('aws-amplify');
const { signIn, fetchAuthSession } = require('aws-amplify/auth');
const https = require('https');
const readline = require('readline');

// ================= 配置区域 =================
const _pool_id = 'us-east-2_MlnzCFgHk';
const _client_id = '1956req5ro9drdtbf5i6kis4la';
const _cognito_hostname = 'https://login.eldorado.gg';
const _eldorado_hostname = 'www.eldorado.gg';  

const awsConfig = {
  Auth: {
    Cognito: {
      userPoolId: _pool_id,
      userPoolClientId: _client_id,
      loginWith: {
        oauth: {
          domain: _cognito_hostname.replace('https://', ''),
          redirectSignIn: `https://${_eldorado_hostname}/account/auth-callback`,
          responseType: "code",
        },
      },
    },
  },
};

Amplify.configure(awsConfig);

// ================= 查价目标设置 =================
const TARGET_GAME_ID = "259";
const TARGET_ENV_ID = "0-7-3"; // OG -> Skibidi Toilet

// ================= 辅助函数 =================

async function authenticate(username, password) {
  try {
    const signInOutput = await signIn({ username, password });
    if (signInOutput.nextStep.signInStep !== 'DONE') {
      throw new Error(`Sign-in not complete. Next step: ${signInOutput.nextStep.signInStep}`);
    }
    const session = await fetchAuthSession();
    if (!session.tokens || !session.tokens.idToken) {
      throw new Error('No ID token found in session.');
    }
    return session.tokens.idToken.toString();  
  } catch (error) {
    console.error('Error during authentication:', error);
    throw error;
  }
}

function getInput(prompt) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true,
    });
    rl.question(prompt, (answer) => {
      rl.close();
      resolve(answer);
    });
    if (prompt.includes('password')) {
      let hidden = '';
      rl._writeToOutput = (stringToWrite) => {
        if (stringToWrite === '\r\n') {
          rl.output.write('\r\n');
        } else if (stringToWrite.length === 1) {
          hidden += stringToWrite;
        } else {
          rl.output.write(prompt);
        }
      };
    }
  });
}

function makeApiRequest(method, pathStr, idToken) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: _eldorado_hostname,
      path: pathStr,
      method: method,
      headers: {
        'Accept': 'application/json',
        'Cookie': `__Host-EldoradoIdToken=${idToken}`,
        'swagger': 'Swager request'
      }
    };

    const req = https.request(options, (res) => {
      res.setEncoding('utf8'); 
      let responseBody = '';
      res.on('data', (chunk) => responseBody += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          if (!responseBody) return resolve({}); 
          try {
            resolve(JSON.parse(responseBody));
          } catch (e) {
            resolve(responseBody);
          }
        } else {
          reject(new Error(`[${method}] ${pathStr} 失败. 状态码: ${res.statusCode}, 响应: ${responseBody}`));
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

// ================= 主逻辑 =================

async function main() {
  if (process.argv.length < 3) {
    console.log('用法: node check_market_price.js <your_email>');
    process.exit(1);
  }

  const username = process.argv[2];
  const password = await getInput('Enter your password: ');

  let idToken;
  try {
    idToken = await authenticate(username, password);
    console.log('\n✅ 身份验证成功，开始查价...\n');
  } catch (error) {
    console.error('❌ 身份验证失败:', error);
    process.exit(1);
  }

  // ---------------------------------------------------------
  // 步骤 1: 获取该类别下所有在售商品 (假设最多拉取3页，保证数据完整)
  // ---------------------------------------------------------
  console.log(`[GET] 正在拉取市场上的 [Skibidi Toilet (OG)] 数据...`);
  
  let allOffers = [];
  try {
    for (let page = 1; page <= 3; page++) {
      const searchPath = `/api/flexibleOffers?gameId=${TARGET_GAME_ID}&category=CustomItem&tradeEnvironmentId=${TARGET_ENV_ID}&pageSize=50&pageIndex=${page}`;
      const res = await makeApiRequest('GET', searchPath, idToken);
      
      if (res.results && res.results.length > 0) {
        allOffers = allOffers.concat(res.results);
      } else {
        break; // 如果这一页没有数据了，提前结束循环
      }
    }
  } catch (err) {
    console.error(`❌ 获取市场数据失败: ${err.message}`);
    process.exit(1);
  }

  console.log(`✅ 成功获取 ${allOffers.length} 个 Skibidi Toilet，正在进行属性精准过滤...\n`);

  // ---------------------------------------------------------
  // 步骤 2: 精准过滤 M/s 和 Mutations
  // ---------------------------------------------------------
  const matchedOffers = allOffers.filter(item => {
    // 处理嵌套结构：有时结果直接是 offer，有时在 item.offer 里面
    const offer = item.offer || item;
    
    if (!offer.attributes) return false;

    let matchMs = false;
    let matchMutation = false;

    offer.attributes.forEach(attr => {
      if (attr.name === "M/s" && attr.value && attr.value.name === TARGET_MS) {
        matchMs = true;
      }
      if (attr.name === "Mutations" && attr.value && attr.value.name === TARGET_MUTATION) {
        matchMutation = true;
      }
    });

    return matchMs && matchMutation;
  });

  if (matchedOffers.length === 0) {
    console.log(`⚠️ 当前市场上没有完全符合 [ ${TARGET_MS} + ${TARGET_MUTATION} ] 属性的 Skibidi Toilet。你可以自由定价！`);
    return;
  }

  // ---------------------------------------------------------
  // 步骤 3: 排序并打印报告
  // ---------------------------------------------------------
  // 按价格从低到高排序
  matchedOffers.sort((a, b) => {
    const priceA = (a.offer || a).pricePerUnit.amount;
    const priceB = (b.offer || b).pricePerUnit.amount;
    return priceA - priceB;
  });

  console.log('======================================================');
  console.log(`📊 【市场行情报告】`);
  console.log(`目标商品: OG - Skibidi Toilet`);
  console.log(`附加属性: M/s = ${TARGET_MS} | Mutations = ${TARGET_MUTATION}`);
  console.log(`符合条件的在售数量: ${matchedOffers.length} 个`);
  console.log('======================================================');
  
  // 取出最便宜的前 5 个
  const topOffers = matchedOffers.slice(0, 5);
  
  topOffers.forEach((item, index) => {
    const offer = item.offer || item;
    const user = item.user || { username: '未知卖家' };
    
    const price = offer.pricePerUnit.amount;
    const currency = offer.pricePerUnit.currency;
    const quantity = offer.quantity;
    const delivery = offer.guaranteedDeliveryTime;
    
    console.log(`排名 #${index + 1} 🏆`);
    console.log(`💰 价格: ${price} ${currency}`);
    console.log(`📦 库存: ${quantity}`);
    console.log(`⏱️ 发货: ${delivery}`);
    console.log(`👤 卖家: ${user.username}`);
    console.log('------------------------------------------------------');
  });

  console.log(`\n💡 建议定价: 如果你想成为市场最低价，你可以定价为 ${(topOffers[0].offer || topOffers[0]).pricePerUnit.amount - 0.01} USD`);
}

main();
