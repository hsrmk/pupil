-- Logical time combines the device's wall clock (milliseconds, scaled by
-- 1000) with a monotonic counter. The device ID breaks ties across devices.
ALTER TABLE sync_control ADD COLUMN device_id TEXT;
ALTER TABLE sync_control ADD COLUMN logical_clock INTEGER NOT NULL DEFAULT 0;
ALTER TABLE sync_outbox ADD COLUMN logical_clock INTEGER NOT NULL DEFAULT 0;

CREATE TABLE sync_versions (
  entity TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  logical_clock INTEGER NOT NULL,
  device_id TEXT NOT NULL,
  PRIMARY KEY (entity, entity_id)
);

-- Every local journal insertion and its version are committed with the data
-- mutation. Explicit nonzero clocks are reserved for seeding existing data.
CREATE TRIGGER sync_outbox_version AFTER INSERT ON sync_outbox
BEGIN
  UPDATE sync_control
  SET logical_clock = max(logical_clock,
      CASE WHEN NEW.logical_clock > 0 THEN NEW.logical_clock
           ELSE max(CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER) * 1000,
                    logical_clock + 1) END)
  WHERE id = 1;
  UPDATE sync_outbox
  SET logical_clock = CASE WHEN NEW.logical_clock > 0 THEN NEW.logical_clock
                           ELSE (SELECT logical_clock FROM sync_control WHERE id = 1) END
  WHERE sequence = NEW.sequence;
  INSERT INTO sync_versions (entity, entity_id, logical_clock, device_id)
  VALUES (NEW.entity, NEW.entity_id,
          (SELECT logical_clock FROM sync_outbox WHERE sequence = NEW.sequence),
          COALESCE((SELECT device_id FROM sync_control WHERE id = 1), ''))
  ON CONFLICT(entity, entity_id) DO UPDATE SET
    logical_clock = excluded.logical_clock, device_id = excluded.device_id;
END;
