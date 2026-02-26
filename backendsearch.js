/*
*   文件名: price_api_server.js
*   作用简述:
*   提供一个 RESTful API 端点用于查询 Eldorado 市场行情。
*   接收前端传入的账号、密码、交易环境ID (如 "0-7-3") 以及动态属性 (如 M/s, Mutations)，
*   自动抓取并过滤市场数据，返回最便宜的前 5 个竞品信息及建议定价。
    */
const express = require('express');
const cors = require('cors');
const { Amplify } = require('aws-amplify');
const { signIn, fetchAuthSession, signOut } = require('aws-amplify/auth');
const https = require('https');
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
const app = express();
app.use(cors());
app.use(express.json());
// ================= 核心工具函数 =================
async function getEldoradoToken(username, password) {
try {
await signOut().catch(() => {}); // 清理上一次的会话缓存
const signInOutput = await signIn({ username, password });
if (signInOutput.nextStep.signInStep !== 'DONE') {
throw new Error(`登录未完成: ${signInOutput.nextStep.signInStep}`);
}
const session = await fetchAuthSession();
if (!session.tokens || !session.tokens.idToken) {
throw new Error('未找到 ID token');
}
return session.tokens.idToken.toString();
} catch (error) {
throw new Error(`身份验证失败: ${error.message}`);
}
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
      reject(new Error(`Eldorado API 错误: [${res.statusCode}] ${responseBody}`));
    }
  });
});
req.on('error', reject);
req.end();
});
}
// ================= API 路由 =================
/**
*   @route POST /api/v1/market-price
*   @desc 查询指定条件商品的市场行情
*   @body { username, password, gameId, envId, targetMs, targetMutation }
    */
    app.post('/api/v1/market-price', async (req, res) => {
    const {
    username,
    password,
    gameId = "259",
    envId,
    targetMs,
    targetMutation
    } = req.body;
if (!username || !password || !envId) {
return res.status(400).json({
success: false,
message: '缺少必要参数: username, password, envId'
});
}
try {
console.log(`\n[API] 收到查价请求 | EnvID: ${envId} | M/s: ${targetMs || '无'} | Mutations: ${targetMutation || '无'}`);
// 1. 鉴权获取 Token
const idToken = await getEldoradoToken(username, password);
// 2. 粗查：拉取目标类目下的所有在售商品 (抓取前3页，共150个竞品)
let allOffers = [];
for (let page = 1; page <= 3; page++) {
  const searchPath = `/api/flexibleOffers?gameId=${gameId}&category=CustomItem&tradeEnvironmentId=${envId}&pageSize=50&pageIndex=${page}`;
  const apiRes = await makeApiRequest('GET', searchPath, idToken);
  if (apiRes.results && apiRes.results.length > 0) {
    allOffers = allOffers.concat(apiRes.results);
  } else {
    break; // 没有更多数据则提前跳出
  }
}
// 3. 精筛：在内存中过滤 Attributes
const matchedOffers = allOffers.filter(item => {
  const offer = item.offer || item;
  // 如果前端传了具体的过滤条件，但商品没写 attributes，直接淘汰
  if ((targetMs || targetMutation) && (!offer.attributes || offer.attributes.length === 0)) {
    return false;
  }
  let matchMs = targetMs ? false : true; // 如果未传 targetMs，视为匹配
  let matchMutation = targetMutation ? false : true;
  if (offer.attributes) {
    offer.attributes.forEach(attr => {
      if (targetMs && attr.name === "M/s" && attr.value && attr.value.name === targetMs) {
        matchMs = true;
      }
      if (targetMutation && attr.name === "Mutations" && attr.value && attr.value.name === targetMutation) {
        matchMutation = true;
      }
    });
  }
  return matchMs && matchMutation;
});
// 4. 排序：按价格从低到高
matchedOffers.sort((a, b) => {
  const priceA = (a.offer || a).pricePerUnit.amount;
  const priceB = (b.offer || b).pricePerUnit.amount;
  return priceA - priceB;
});
// 如果没有符合条件的商品
if (matchedOffers.length === 0) {
  return res.status(200).json({
    success: true,
    message: '当前市场无完全匹配竞品，可自由定价',
    data: {
      totalMatched: 0,
      suggestedPrice: null,
      topCompetitors: []
    }
  });
}
// 5. 格式化返回数据
const topOffers = matchedOffers.slice(0, 5).map(item => {
  const offer = item.offer || item;
  const user = item.user || { username: '未知卖家' };
  return {
    offerId: offer.id, // 👈 新增：提取商品ID
    seller: user.username,
    price: offer.pricePerUnit.amount,
    currency: offer.pricePerUnit.currency,
    quantity: offer.quantity,
    deliveryTime: offer.guaranteedDeliveryTime
  };
});
// 计算抢占榜首的建议价格 (比最低价便宜 0.01)
const lowestPrice = topOffers[0].price;
const suggestedPrice = Math.max(0.01, lowestPrice - 0.01); // 确保不为负数
console.log(`[API] 查价完成，找到 ${matchedOffers.length} 个竞品，最低价: $${lowestPrice}`);
return res.status(200).json({
  success: true,
  message: '查询成功',
  data: {
    totalMatched: matchedOffers.length,
    suggestedPrice: Number(suggestedPrice.toFixed(2)), // 保留两位小数
    lowestPrice: lowestPrice,
    topCompetitors: topOffers
  }
});
} catch (error) {
console.error('[API Error]', error.message);
return res.status(500).json({ success: false, message: error.message });
}
});
// ================= 启动服务 =================
const PORT = process.env.PORT || 6675;
app.listen(PORT, () => {
console.log(`🚀 行情查询 API 已启动: http://localhost:${PORT}`);
console.log(`接口路径: POST /api/v1/market-price`);
});
