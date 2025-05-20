FROM nginx:1.23-alpine

# 移除默認配置
RUN rm /etc/nginx/conf.d/default.conf

# 複製自定義配置
COPY conf/default.conf /etc/nginx/conf.d/

# 設置日誌輸出到標準輸出，便於Docker查看
RUN ln -sf /dev/stdout /var/log/nginx/access.log && \
    ln -sf /dev/stderr /var/log/nginx/error.log

EXPOSE 80 443

CMD ["nginx", "-g", "daemon off;"] 