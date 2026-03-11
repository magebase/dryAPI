FROM calcom/cal.com:latest

USER root
SHELL ["/bin/sh", "-c"]

RUN set -eux; \
  if command -v apt-get >/dev/null 2>&1; then \
    apt-get update; \
    apt-get install -y --no-install-recommends bash curl ca-certificates supervisor awscli postgresql postgresql-contrib; \
    rm -rf /var/lib/apt/lists/*; \
  elif command -v apk >/dev/null 2>&1; then \
    apk add --no-cache bash curl ca-certificates supervisor aws-cli postgresql16 postgresql16-client postgresql16-contrib || \
    apk add --no-cache bash curl ca-certificates supervisor aws-cli postgresql postgresql-contrib; \
  else \
    echo "Unsupported base image package manager" >&2; \
    exit 1; \
  fi

RUN mkdir -p /opt/calcom /var/log/supervisor /var/backups/postgres /var/lib/postgresql/data /data/postgres /data/backups/postgres \
  && chown -R postgres:postgres /var/backups/postgres /var/lib/postgresql /data/postgres /data/backups/postgres

COPY docker/supervisord.conf /etc/supervisord.conf
COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh
COPY docker/init-postgres.sh /usr/local/bin/init-postgres.sh
COPY docker/start-postgres.sh /usr/local/bin/start-postgres.sh
COPY docker/start-calcom.sh /usr/local/bin/start-calcom.sh
COPY docker/backup-postgres.sh /usr/local/bin/backup-postgres.sh
COPY docker/internal-api.mjs /opt/calcom/internal-api.mjs
COPY docker/minimal-health-server.mjs /opt/calcom/minimal-health-server.mjs

RUN chmod +x /usr/local/bin/entrypoint.sh \
  /usr/local/bin/init-postgres.sh \
  /usr/local/bin/start-postgres.sh \
  /usr/local/bin/start-calcom.sh \
  /usr/local/bin/backup-postgres.sh

EXPOSE 3000
CMD ["/usr/local/bin/entrypoint.sh"]
