FROM nginx

COPY ./build/ /usr/share/nginx/html/
COPY ./vhost.nginx.conf /etc/nginx/conf.d/pea3nut-info.conf

EXPOSE 80