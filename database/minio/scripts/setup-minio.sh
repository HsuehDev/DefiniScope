#!/bin/bash
# MinIO 初始化腳本
# 用於設置 MinIO 服務，創建必要的用戶和政策

set -e

# 等待 MinIO 服務啟動
echo "等待 MinIO 服務啟動..."
until mc alias set local http://minio:9000 "${MINIO_ROOT_USER}" "${MINIO_ROOT_PASSWORD}" > /dev/null 2>&1; do
  echo "等待 MinIO 連接..."
  sleep 1
done

echo "MinIO 服務已啟動，開始設置..."

# 創建系統需要的 bucket
mc mb --ignore-existing local/system-bucket
mc mb --ignore-existing local/temp-uploads
mc mb --ignore-existing local/processing-temp

# 為 system-bucket 設定政策
cat > /tmp/system-bucket-policy.json << EOF
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Principal": {
                "AWS": ["arn:aws:iam::*:user/app-backend"]
            },
            "Action": ["s3:*"],
            "Resource": [
                "arn:aws:s3:::system-bucket",
                "arn:aws:s3:::system-bucket/*"
            ]
        }
    ]
}
EOF

mc anonymous set-json /tmp/system-bucket-policy.json local/system-bucket

# 為 temp-uploads bucket 設定生命週期規則 (7天後過期)
cat > /tmp/lifecycle-config.json << EOF
{
    "Rules": [
        {
            "ID": "expire-temp-uploads",
            "Status": "Enabled",
            "Expiration": {
                "Days": 7
            }
        }
    ]
}
EOF

mc ilm import local/temp-uploads < /tmp/lifecycle-config.json

# 創建 app-backend 用戶，用於後端服務訪問 MinIO
mc admin user add local app-backend app-backend-password

# 創建業務角色
cat > /tmp/app-backend-policy.json << EOF
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "s3:GetBucketLocation",
                "s3:ListBucket",
                "s3:ListAllMyBuckets"
            ],
            "Resource": ["arn:aws:s3:::*"]
        },
        {
            "Effect": "Allow",
            "Action": [
                "s3:*"
            ],
            "Resource": [
                "arn:aws:s3:::system-bucket/*",
                "arn:aws:s3:::system-bucket",
                "arn:aws:s3:::temp-uploads/*",
                "arn:aws:s3:::temp-uploads",
                "arn:aws:s3:::processing-temp/*",
                "arn:aws:s3:::processing-temp",
                "arn:aws:s3:::user-*/*",
                "arn:aws:s3:::user-*"
            ]
        },
        {
            "Effect": "Allow",
            "Action": [
                "admin:CreateUser",
                "admin:DeleteUser",
                "admin:ListUsers",
                "admin:CreatePolicy",
                "admin:AttachUserOrGroupPolicy",
                "admin:ListUserPolicies"
            ],
            "Resource": ["arn:aws:s3:::*"]
        }
    ]
}
EOF

# 創建政策
mc admin policy add local app-backend-policy /tmp/app-backend-policy.json

# 為用戶關聯政策
mc admin policy set local app-backend-policy user=app-backend

echo "MinIO 初始化完成！" 