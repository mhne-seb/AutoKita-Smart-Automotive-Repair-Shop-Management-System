const { Pool } = require('pg')
const p = new Pool({
    host: process.env.DB_HOST, user: process.env.DB_USER, password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME, port: Number(process.env.DB_PORT || 5432),
})
p.query('SELECT current_database() AS database, current_user AS db_user, (SELECT count(*) FROM job_orders) AS job_orders')
    .then((r) => console.log('CONNECTED:', r.rows[0]))
    .catch((e) => console.error('NOT CONNECTED:', e.message))
    .finally(() => p.end())