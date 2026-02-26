/*
 * 文件名: generate_mapping_v14.js
 * 作用简述: 
 * 1. 自动处理分页，突破单页 50 个的限制，拉取前两页共 100 个同行商品。
 * 2. 解析并提取隐藏在 tradeEnvironmentValues 中的 "ID -> 物理含义" 映射关系。
 * 3. 提取并汇总所有出现过的动态 attributes (如 ms, mutations) 及其合法的值。
 * 4. 打印出逆向工程字典表。
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
    console.log('用法: node generate_mapping_v14.js <your_email>');
    process.exit(1);
  }

  const username = process.argv[2];
  const password = await getInput('Enter your password: ');

  let idToken;
  try {
    idToken = await authenticate(username, password);
    console.log('\n✅ 身份验证成功，开始执行逆向分析...\n');
  } catch (error) {
    console.error('❌ 身份验证失败:', error);
    process.exit(1);
  }

  // ---------------------------------------------------------
  // 核心：处理分页，最高效地拉取数据
  // ---------------------------------------------------------
  console.log(`[GET] 准备在市场上抓取 100 个商品，因为 API 单页最多限制 50，我们将分两次请求...`);
  
  let allResults = [];
  
  try {
    // 拉取第一页
    console.log(`⏳ 正在拉取第 1 页 (1-50)...`);
    const page1Path = '/api/flexibleOffers?gameId=259&category=CustomItem&pageSize=50&pageIndex=1';
    const res1 = await makeApiRequest('GET', page1Path, idToken);
    if (res1.results) allResults = allResults.concat(res1.results);

    // 拉取第二页
    console.log(`⏳ 正在拉取第 2 页 (51-100)...`);
    const page2Path = '/api/flexibleOffers?gameId=259&category=CustomItem&pageSize=50&pageIndex=2';
    const res2 = await makeApiRequest('GET', page2Path, idToken);
    if (res2.results) allResults = allResults.concat(res2.results);

    if (allResults.length > 0) {
      console.log(`🎉 成功抓取到 ${allResults.length} 个商品！正在提取映射字典...\n`);
      
      const environmentDictionary = {}; 
      const attributeDictionary = {};   

      allResults.forEach((item) => {
        const offerData = item.offer || item;

        // 1. 提取 tradeEnvironmentId
        if (offerData.tradeEnvironmentValues && offerData.tradeEnvironmentValues.length > 0) {
          const envId = offerData.tradeEnvironmentValues[0].id;
          const envNames = offerData.tradeEnvironmentValues.map(v => v.name).join(' > ');
          
          if (!environmentDictionary[envId]) {
            environmentDictionary[envId] = envNames;
          }
        }

        // 2. 提取动态 Attributes
        if (offerData.attributes && offerData.attributes.length > 0) {
          offerData.attributes.forEach(attr => {
            const attrKey = attr.id; 
            const attrValueId = attr.value ? attr.value.id : 'unknown'; 
            const attrValueName = attr.value ? attr.value.name : 'Unknown'; 

            if (!attributeDictionary[attrKey]) {
              attributeDictionary[attrKey] = {
                name: attr.name, 
                possibleValues: {}
              };
            }
            attributeDictionary[attrKey].possibleValues[attrValueId] = attrValueName;
          });
        }
      });

      // ---------------------------------------------------------
      // 打印华丽的逆向工程报告
      // ---------------------------------------------------------
      console.log('======================================================');
      console.log('📜 【Trade Environment ID 映射字典】 (类别与稀有度)');
      console.log('======================================================');
      for (const [id, meaning] of Object.entries(environmentDictionary)) {
        console.log(`ID: "${id}"  ===>  含义: [ ${meaning} ]`);
      }

      console.log('\n======================================================');
      console.log('🏷️ 【动态 Attributes 合法字段及可选值】 (突变、数值等)');
      console.log('======================================================');
      for (const [attrKey, data] of Object.entries(attributeDictionary)) {
        console.log(`字段 Key: "${attrKey}" (页面展示名: ${data.name})`);
        console.log(`合法的值 (ID => 含义):`);
        for (const [valId, valName] of Object.entries(data.possibleValues)) {
          console.log(`    "${valId}"  =>  ${valName}`);
        }
        console.log('------------------------------------------------------');
      }

      console.log('\n✅ 字典生成完毕！请保存这部分输出作为后续自动化上架的配置表！');

    } else {
      console.log('⚠️ 市场上没有找到任何商品数据。');
    }
  } catch (err) {
    console.error(`❌ 数据抓取及分析失败: ${err.message}`);
  }
}

main();
