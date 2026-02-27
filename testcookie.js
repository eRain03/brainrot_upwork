/*
 * 文件名: test_cookie_lifecycle.js
 * 作用简述: 
 * 1. 完美适配 Chrome 插件提取的“纯净版 Cookie”。
 * 2. 优先读取同目录下的 token.txt，如果不存在则读取代码中的 HARDCODED_COOKIE。
 * 3. 自动分离 XSRF Token 绕过防火墙。
 * 4. 执行完整的：图片上传 -> 嗅探 Env ID -> 上架 -> 延时下架 闭环。
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// ================= 配置区域 =================
const _eldorado_hostname = 'www.eldorado.gg';  

// 备用方案：如果你不想建 token.txt 文件，可以直接把插件提取的 Cookie 粘贴到这里
const HARDCODED_COOKIE = ""; 

// ================= 辅助函数 =================

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * 智能提取 XSRF Token
 */
function extractXsrfToken(cookieString) {
  const match = cookieString.match(/__Host-XSRF-TOKEN=([^;]+)/);
  return match ? match[1].trim() : null;
}

// ---------------------------------------------------------
// 核心请求封装
// ---------------------------------------------------------
function makeApiRequest(method, pathStr, cookieString, xsrfToken, payload = null) {
  return new Promise((resolve, reject) => {
    const headers = {
      'Accept': 'application/json',
      'Cookie': cookieString,
      'swagger': 'Swager request'
    };

    // 自动挂载 XSRF 防火墙令牌 (POST/PUT/DELETE 必须)
    if (xsrfToken && (method === 'POST' || method === 'DELETE' || method === 'PUT')) {
      headers['X-XSRF-Token'] = xsrfToken;
    }

    const options = {
      hostname: _eldorado_hostname,
      path: pathStr,
      method: method,
      headers: headers
    };

    let bodyString = '';
    if (payload) {
      bodyString = JSON.stringify(payload);
      options.headers['Content-Type'] = 'application/json';
      options.headers['Content-Length'] = Buffer.byteLength(bodyString);
    }

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
    if (payload) req.write(bodyString);
    req.end();
  });
}

/**
 * 图片上传函数
 */
async function uploadImageToEldorado(imagePath, cookieString, xsrfToken) {
  const uploadUrl = `https://${_eldorado_hostname}/api/files/me/Offer`;
  
  if (!fs.existsSync(imagePath)) {
    throw new Error(`找不到图片文件: ${imagePath}。请确保目录下有一张 test.png`);
  }

  const imageBuffer = fs.readFileSync(imagePath);
  const fileName = path.basename(imagePath);
  
  const formData = new FormData();
  const blob = new Blob([imageBuffer], { type: 'image/png' }); 
  formData.append('image', blob, fileName); 

  console.log(`[POST] 正在上传图片 ${fileName} 到 Eldorado CDN...`);

  const headers = {
    'Cookie': cookieString,
    'swagger': 'Swager request'
  };
  
  if (xsrfToken) {
    headers['X-XSRF-Token'] = xsrfToken;
  }

  try {
    const response = await fetch(uploadUrl, {
      method: 'POST',
      headers: headers,
      body: formData
    });

    const responseText = await response.text();

    if (response.ok) {
      const result = JSON.parse(responseText);
      console.log('✅ 图片上传成功！CDN 处理完毕。');
      
      if (result.localPaths && Array.isArray(result.localPaths)) {
        const extractFileName = (fullPath) => fullPath.split('/').pop();
        const smallImg = result.localPaths.find(p => p.includes('Small')) || result.localPaths[0];
        const largeImg = result.localPaths.find(p => p.includes('Large')) || result.localPaths[1];
        const originalImg = result.localPaths.find(p => p.includes('Original')) || result.localPaths[2];

        return {
          smallImage: extractFileName(smallImg),
          largeImage: extractFileName(largeImg),
          originalSizeImage: extractFileName(originalImg)
        };
      }
      return Array.isArray(result) ? result[0] : result; 
    } else {
      throw new Error(`HTTP ${response.status} - ${responseText}`);
    }
  } catch (error) {
    console.error('❌ 图片上传发生错误:', error.message);
    return null;
  }
}

// ================= 主逻辑 =================

async function main() {
  console.log('🚀 正在启动自动化测试流程...');
  
  let cookieString = '';

  // 1. 优先尝试读取 token.txt
  const tokenPath = path.join(__dirname, 'token.txt');
  if (fs.existsSync(tokenPath)) {
    console.log('📁 检测到 token.txt，正在读取插件提取的 Cookie...');
    let rawContent = fs.readFileSync(tokenPath, 'utf8');
    // 去除换行符，防止多行错误
    cookieString = rawContent.replace(/\r?\n|\r/g, '').trim();
  } else if (HARDCODED_COOKIE) {
    console.log('📝 未检测到 token.txt，使用代码内置的 HARDCODED_COOKIE...');
    cookieString = HARDCODED_COOKIE;
  } else {
    console.error('❌ 致命错误：既没有 token.txt，也没有设置 HARDCODED_COOKIE。请使用插件获取 Cookie！');
    process.exit(1);
  }

  if (!cookieString.includes('__Host-EldoradoIdToken')) {
    console.error('❌ Cookie 格式错误：未检测到核心的 __Host-EldoradoIdToken，请重新用插件提取！');
    process.exit(1);
  }

  // 2. 提取 XSRF 令牌
  const xsrfToken = extractXsrfToken(cookieString);
  if (xsrfToken) {
    console.log('✅ 成功提取 XSRF 防火墙令牌');
  } else {
    console.log('⚠️ 警告：未能在 Cookie 中找到 __Host-XSRF-TOKEN，部分请求可能被拦截。');
  }

  // ---------------------------------------------------------
  // 步骤 1: 上传图片并转换数据格式
  // ---------------------------------------------------------
  const testImagePath = path.join(__dirname, 'test.png');
  const myUploadedImageObject = await uploadImageToEldorado(testImagePath, cookieString, xsrfToken);

  if (!myUploadedImageObject || !myUploadedImageObject.smallImage) {
    console.error("❌ 图片上传失败，程序终止。");
    process.exit(1);
  }

  // ---------------------------------------------------------
  // 步骤 2: 仅嗅探 Env ID
  // ---------------------------------------------------------
  console.log(`\n[GET] 正在嗅探 Roblox 的 CustomItem Env ID...`);
  const searchPath = '/api/flexibleOffers?gameId=70&category=CustomItem&pageSize=20';
  let tradeEnvId = null;

  try {
    const searchResponse = await makeApiRequest('GET', searchPath, cookieString, xsrfToken);
    if (searchResponse.results && searchResponse.results.length > 0) {
      for (const item of searchResponse.results) {
        const offerData = item.offer || item;
        if (offerData.tradeEnvironmentValues && offerData.tradeEnvironmentValues.length > 0) {
          tradeEnvId = offerData.tradeEnvironmentValues[0].id;
          break; 
        }
      }
    }
  } catch (err) {}

  if (!tradeEnvId) {
    console.error("❌ 无法获取 Environment ID，程序终止。");
    process.exit(1);
  }
  console.log(`✅ 成功拿到 Env ID: ${tradeEnvId}`);

  // ---------------------------------------------------------
  // 步骤 3: 构造 Payload 并上架
  // ---------------------------------------------------------
  const createPath = '/api/flexibleOffers/item';
  const offerPayload = {
    details: {
      offerTitle: "[TESTING ONLY] Perfect Cookie Flow Test", 
      description: "Testing API with ultra-clean Browser Cookie.",
      guaranteedDeliveryTime: "Day1", 
      mainOfferImage: myUploadedImageObject, 
      pricing: {
        quantity: 1,
        minQuantity: 1,
        pricePerUnit: { amount: 10000.00, currency: "USD" }
      }
    },
    augmentedGame: {
      gameId: "70", 
      category: "CustomItem",
      tradeEnvironmentId: tradeEnvId 
    }
  };

  let createdOfferId = null;

  try {
    console.log(`\n[POST] 正在执行上架操作...`);
    const createResponse = await makeApiRequest('POST', createPath, cookieString, xsrfToken, offerPayload);
    createdOfferId = createResponse.id;
    console.log(`✅ 上架成功！你自己的图片已发布，商品 ID: ${createdOfferId}`);
  } catch (error) {
    console.error(`❌ 上架失败: ${error.message}`);
    process.exit(1); 
  }

  // ---------------------------------------------------------
  // 步骤 4: 自动下架
  // ---------------------------------------------------------
  console.log(`\n⏳ 等待 3 秒钟后下架...`);
  await sleep(3000); 

  if (!createdOfferId) process.exit(1);

  try {
    console.log(`[DELETE] 正在彻底下架商品 ID: ${createdOfferId} ...`);
    await makeApiRequest('DELETE', `/api/flexibleOffersUser/me/${createdOfferId}`, cookieString, xsrfToken);
    console.log(`✅ 下架成功！API 终极挑战圆满完成 🚀🚀🚀`);
  } catch (error) {
    console.error(`❌ 下架失败: ${error.message}`);
  }
}

main();
