import mysql from 'mysql2/promise';

const LOOPBACK_MYSQL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

export function shouldUseMysqlTls(hostname, explicitlyConfigured) {
  return explicitlyConfigured || !LOOPBACK_MYSQL_HOSTS.has(String(hostname).toLowerCase());
}

export function createPool(config) {
  let databaseUrl;
  try {
    databaseUrl = new URL(config.databaseUrl);
  } catch {
    throw new Error('DATABASE_URL must be a valid MySQL connection URL.');
  }

  if (!['mysql:', 'mysqls:'].includes(databaseUrl.protocol)) {
    throw new Error('DATABASE_URL must use the mysql:// or mysqls:// scheme.');
  }

  const database = decodeURIComponent(databaseUrl.pathname.replace(/^\//, ''));
  if (!database || !databaseUrl.hostname || !databaseUrl.username) {
    throw new Error('DATABASE_URL must include a host, user, and database name.');
  }

  const options = {
    host: databaseUrl.hostname,
    port: databaseUrl.port ? Number(databaseUrl.port) : 3306,
    user: decodeURIComponent(databaseUrl.username),
    password: decodeURIComponent(databaseUrl.password),
    database,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    connectTimeout: 5_000,
    enableKeepAlive: true,
    timezone: 'Z',
    dateStrings: true,
  };

  if (shouldUseMysqlTls(databaseUrl.hostname, config.mysqlSsl)) options.ssl = { rejectUnauthorized: true };
  const pool = mysql.createPool(options);
  pool.on('connection', (connection) => {
    connection.query("SET SESSION time_zone = '+00:00'", (error) => {
      if (error) connection.destroy();
    });
  });
  return pool;
}
