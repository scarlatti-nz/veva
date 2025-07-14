FROM nginx:alpine

# Remove the default Nginx configuration file
RUN rm /etc/nginx/conf.d/default.conf

# Copy the custom Nginx configuration file
COPY nginx.prod.conf /etc/nginx/nginx.conf


EXPOSE 80 443

CMD ["nginx", "-g", "daemon off;"]