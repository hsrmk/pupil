-- A monotonically increasing local journal. Entries are acknowledged only after
-- their corresponding remote write succeeds. Payloads are read transactionally
-- by the sync engine; deletes remain visible after their rows are gone.
CREATE TABLE sync_outbox (
  sequence INTEGER PRIMARY KEY AUTOINCREMENT,
  entity TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  deleted INTEGER NOT NULL CHECK (deleted IN (0, 1))
);
CREATE INDEX sync_outbox_entity ON sync_outbox(entity, entity_id, sequence);

-- Applying remote changes must not echo them back to the server. The flag is
-- changed only within the same transaction as the remote changes.
CREATE TABLE sync_control (id INTEGER PRIMARY KEY CHECK (id = 1), applying_remote INTEGER NOT NULL CHECK (applying_remote IN (0, 1)), enabled INTEGER NOT NULL CHECK (enabled IN (0, 1)));
INSERT INTO sync_control VALUES (1, 0, 0);

CREATE TRIGGER sync_spaces_insert AFTER INSERT ON spaces
WHEN (SELECT enabled = 1 AND applying_remote = 0 FROM sync_control WHERE id = 1)
BEGIN
  INSERT INTO sync_outbox (entity, entity_id, deleted) VALUES ('spaces', NEW.id, 0);
END;
CREATE TRIGGER sync_spaces_update AFTER UPDATE ON spaces
WHEN (SELECT enabled = 1 AND applying_remote = 0 FROM sync_control WHERE id = 1)
BEGIN
  INSERT INTO sync_outbox (entity, entity_id, deleted) VALUES ('spaces', NEW.id, 0);
END;
CREATE TRIGGER sync_spaces_delete AFTER DELETE ON spaces
WHEN (SELECT enabled = 1 AND applying_remote = 0 FROM sync_control WHERE id = 1)
BEGIN
  INSERT INTO sync_outbox (entity, entity_id, deleted) VALUES ('spaces', OLD.id, 1);
END;
CREATE TRIGGER sync_cards_insert AFTER INSERT ON cards
WHEN (SELECT enabled = 1 AND applying_remote = 0 FROM sync_control WHERE id = 1)
BEGIN
  INSERT INTO sync_outbox (entity, entity_id, deleted) VALUES ('cards', NEW.id, 0);
END;
CREATE TRIGGER sync_cards_update AFTER UPDATE ON cards
WHEN (SELECT enabled = 1 AND applying_remote = 0 FROM sync_control WHERE id = 1)
BEGIN
  INSERT INTO sync_outbox (entity, entity_id, deleted) VALUES ('cards', NEW.id, 0);
END;
CREATE TRIGGER sync_cards_delete AFTER DELETE ON cards
WHEN (SELECT enabled = 1 AND applying_remote = 0 FROM sync_control WHERE id = 1)
BEGIN
  INSERT INTO sync_outbox (entity, entity_id, deleted) VALUES ('cards', OLD.id, 1);
END;
CREATE TRIGGER sync_review_logs_insert AFTER INSERT ON review_logs
WHEN (SELECT enabled = 1 AND applying_remote = 0 FROM sync_control WHERE id = 1)
BEGIN
  INSERT INTO sync_outbox (entity, entity_id, deleted) VALUES ('review_logs', NEW.id, 0);
END;
CREATE TRIGGER sync_review_logs_update AFTER UPDATE ON review_logs
WHEN (SELECT enabled = 1 AND applying_remote = 0 FROM sync_control WHERE id = 1)
BEGIN
  INSERT INTO sync_outbox (entity, entity_id, deleted) VALUES ('review_logs', NEW.id, 0);
END;
CREATE TRIGGER sync_review_logs_delete AFTER DELETE ON review_logs
WHEN (SELECT enabled = 1 AND applying_remote = 0 FROM sync_control WHERE id = 1)
BEGIN
  INSERT INTO sync_outbox (entity, entity_id, deleted) VALUES ('review_logs', OLD.id, 1);
END;
CREATE TRIGGER sync_card_images_insert AFTER INSERT ON card_images
WHEN (SELECT enabled = 1 AND applying_remote = 0 FROM sync_control WHERE id = 1)
BEGIN
  INSERT INTO sync_outbox (entity, entity_id, deleted) VALUES ('card_images', NEW.id, 0);
END;
CREATE TRIGGER sync_card_images_update AFTER UPDATE ON card_images
WHEN (SELECT enabled = 1 AND applying_remote = 0 FROM sync_control WHERE id = 1)
BEGIN
  INSERT INTO sync_outbox (entity, entity_id, deleted) VALUES ('card_images', NEW.id, 0);
END;
CREATE TRIGGER sync_card_images_delete AFTER DELETE ON card_images
WHEN (SELECT enabled = 1 AND applying_remote = 0 FROM sync_control WHERE id = 1)
BEGIN
  INSERT INTO sync_outbox (entity, entity_id, deleted) VALUES ('card_images', OLD.id, 1);
END;
CREATE TRIGGER sync_study_days_insert AFTER INSERT ON study_days
WHEN (SELECT enabled = 1 AND applying_remote = 0 FROM sync_control WHERE id = 1)
BEGIN
  INSERT INTO sync_outbox (entity, entity_id, deleted) VALUES ('study_days', json_array(NEW.space_id, NEW.day), 0);
END;
CREATE TRIGGER sync_study_days_update AFTER UPDATE ON study_days
WHEN (SELECT enabled = 1 AND applying_remote = 0 FROM sync_control WHERE id = 1)
BEGIN
  INSERT INTO sync_outbox (entity, entity_id, deleted) VALUES ('study_days', json_array(NEW.space_id, NEW.day), 0);
END;
CREATE TRIGGER sync_study_days_delete AFTER DELETE ON study_days
WHEN (SELECT enabled = 1 AND applying_remote = 0 FROM sync_control WHERE id = 1)
BEGIN
  INSERT INTO sync_outbox (entity, entity_id, deleted) VALUES ('study_days', json_array(OLD.space_id, OLD.day), 1);
END;
CREATE TRIGGER sync_settings_insert AFTER INSERT ON settings
WHEN (SELECT enabled = 1 AND applying_remote = 0 FROM sync_control WHERE id = 1) AND NEW.key = 'study.new_cards_limit'
BEGIN
  INSERT INTO sync_outbox (entity, entity_id, deleted) VALUES ('settings', NEW.key, 0);
END;
CREATE TRIGGER sync_settings_update AFTER UPDATE ON settings
WHEN (SELECT enabled = 1 AND applying_remote = 0 FROM sync_control WHERE id = 1) AND NEW.key = 'study.new_cards_limit'
BEGIN
  INSERT INTO sync_outbox (entity, entity_id, deleted) VALUES ('settings', NEW.key, 0);
END;
CREATE TRIGGER sync_settings_delete AFTER DELETE ON settings
WHEN (SELECT enabled = 1 AND applying_remote = 0 FROM sync_control WHERE id = 1) AND OLD.key = 'study.new_cards_limit'
BEGIN
  INSERT INTO sync_outbox (entity, entity_id, deleted) VALUES ('settings', OLD.key, 1);
END;
