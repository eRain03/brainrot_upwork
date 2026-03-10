import os
from openai import OpenAI

api_key = input("请输入 OpenAI API Key: ").strip()

client = OpenAI(api_key=api_key)

try:
    response = client.chat.completions.create(
        model="gpt-5.2",
        messages=[
            {"role": "user", "content": "Ping"}
        ]
    )

    print("\nAPI 调用成功 ✅")
    print("模型回复:")
    print(response.choices[0].message.content)

except Exception as e:
    print("\nAPI 调用失败 ❌")
    print("错误信息:")
    print(e)
