#!/bin/bash

# 設置Python路徑
export PYTHONPATH=$PYTHONPATH:$(pwd)

# 安裝必要的依賴
pip install pytest pytest-mock pytest-asyncio pytest-cov minio redis pyjwt python-jose

# 運行測試
cd docs/audits
echo "運行JWT安全模組測試..."
python -m pytest test_jwt_security.py -v

echo "運行MinIO客戶端測試..."
python -m pytest test_minio_client.py -v

# 顯示測試覆蓋率報告
echo "生成測試覆蓋率報告..."
python -m pytest --cov=jwt_security_improvements --cov=minio_client_improvements test_jwt_security.py test_minio_client.py --cov-report term 