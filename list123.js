/*
 * 文件名: test_offer_lifecycle_v12.js
 * 作用简述: 
 * 1. 修复图片上传成功后的数据解析逻辑，将 localPaths 数组转换为标准的主图对象。
 * 2. 自动嗅探 Roblox 的 Env ID (子游戏 ID)。
 * 3. 使用你自己的图片和 Env ID，执行天价防买上架。
 * 4. 等待 30 秒后自动彻底下架，完成生命周期闭环。
 */

const { Amplify } = require('aws-amplify');
const { signIn, fetchAuthSession } = require('aws-amplify/auth');
const https = require('https');
const readline = require('readline');
const fs = require('fs');
const path = require('path');

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

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function makeApiRequest(method, pathStr, idToken, payload = null) {
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
 * 上传图片的核心函数 (带返回值格式化)
 */
async function uploadImageToEldorado(imagePath, idToken) {
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

  try {
    const response = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'Cookie': `__Host-EldoradoIdToken=${idToken}`,
        'swagger': 'Swager request'
      },
      body: formData
    });

    const responseText = await response.text();

    if (response.ok) {
      const result = JSON.parse(responseText);
      console.log('✅ 图片上传成功！原始 CDN 返回数据:');
      console.log(JSON.stringify(result, null, 2));

      // ===== 核心格式化逻辑 =====
      // 如果返回的是包含 localPaths 数组的对象
      if (result.localPaths && Array.isArray(result.localPaths)) {
        // 辅助函数：从完整路径中提取纯文件名（去掉 "/offerimages/" 路径）
        const extractFileName = (fullPath) => fullPath.split('/').pop();

        // 智能匹配对应的尺寸图片
        const smallImg = result.localPaths.find(p => p.includes('Small')) || result.localPaths[0];
        const largeImg = result.localPaths.find(p => p.includes('Large')) || result.localPaths[1];
        const originalImg = result.localPaths.find(p => p.includes('Original')) || result.localPaths[2];

        const formattedImageObject = {
          smallImage: extractFileName(smallImg),
          largeImage: extractFileName(largeImg),
          originalSizeImage: extractFileName(originalImg)
        };

        console.log('\n🔄 数据转换完毕！即将用于上架的图片对象格式:');
        console.log(JSON.stringify(formattedImageObject, null, 2));

        return formattedImageObject;
      }
      
      // 兼容其他可能的返回格式
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
  if (process.argv.length < 3) {
    console.log('用法: node test_offer_lifecycle_v12.js <your_email>');
    process.exit(1);
  }

  const username = process.argv[2];
  const password = await getInput('Enter your password: ');

  let idToken;
  try {
    idToken = await authenticate(username, password);
    console.log('\n✅ 身份验证成功\n');
  } catch (error) {
    console.error('❌ 身份验证失败:', error);
    process.exit(1);
  }

  // ---------------------------------------------------------
  // 步骤 1: 上传图片并转换数据格式
  // ---------------------------------------------------------
  const testImagePath = path.join(__dirname, 'test.png');
  const myUploadedImageObject = await uploadImageToEldorado(testImagePath, idToken);

  if (!myUploadedImageObject || !myUploadedImageObject.smallImage) {
    console.error("❌ 图片上传失败或返回格式无法解析，程序终止。");
    process.exit(1);
  }

  // ---------------------------------------------------------
  // 步骤 2: 仅嗅探 Env ID
  // ---------------------------------------------------------
  console.log(`\n[GET] 正在嗅探 Roblox 的 CustomItem Env ID...`);
  const searchPath = '/api/flexibleOffers?gameId=70&category=CustomItem&pageSize=20';
  let tradeEnvId = null;

  try {
    const searchResponse = await makeApiRequest('GET', searchPath, idToken);
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
      offerTitle: "[TESTING ONLY] My Custom Image Upload Test", 
      description: "Testing API with my own uploaded image.",
      guaranteedDeliveryTime: "Day1", 
      mainOfferImage: myUploadedImageObject, // 注入格式化后的图片对象
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
    const createResponse = await makeApiRequest('POST', createPath, idToken, offerPayload);
    createdOfferId = createResponse.id;
    console.log(`✅ 上架成功！你自己的图片已发布，商品 ID: ${createdOfferId}`);
  } catch (error) {
    console.error(`❌ 上架失败: ${error.message}`);
    process.exit(1); 
  }

  // ---------------------------------------------------------
  // 步骤 4: 自动下架
  // ---------------------------------------------------------
  console.log(`\n⏳ 等待 30 秒钟，快去网页端看看你上传的 test.png 吧！`);
  await sleep(30000); 

  if (!createdOfferId) process.exit(1);

  try {
    console.log(`[DELETE] 正在彻底下架商品 ID: ${createdOfferId} ...`);
    await makeApiRequest('DELETE', `/api/flexibleOffersUser/me/${createdOfferId}`, idToken);
    console.log(`✅ 下架成功！API 终极挑战圆满完成 🚀🚀🚀`);
  } catch (error) {
    console.error(`❌ 下架失败: ${error.message}`);
  }
}

main();
