-- 添加主庫允許複製連接的配置
ALTER SYSTEM SET listen_addresses TO '*';
ALTER SYSTEM SET wal_level TO 'replica';
ALTER SYSTEM SET max_wal_senders TO '10';
ALTER SYSTEM SET max_replication_slots TO '10';

-- 將配置複製到pg_hba.conf
\connect postgres

CREATE OR REPLACE FUNCTION append_to_pg_hba() RETURNS void AS $$
BEGIN
    PERFORM pg_reload_conf();
    PERFORM pg_write_file(
        (SELECT setting FROM pg_settings WHERE name = 'hba_file'),
        E'\n# Allow replication connections from all hosts\nhost replication replicator all md5\n',
        true
    );
    PERFORM pg_reload_conf();
END;
$$ LANGUAGE plpgsql;

SELECT append_to_pg_hba(); 