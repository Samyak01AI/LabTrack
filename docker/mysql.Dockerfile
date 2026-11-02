FROM mysql:8.0

# Copy initialization script to create default databases on first boot
COPY db/init.sql /docker-entrypoint-initdb.d/init.sql

EXPOSE 3306

