-- Full-text search support for Mention headline/body (coverage feed keyword search).
ALTER TABLE "Mention" ADD COLUMN "searchVector" tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', coalesce("headline", '')), 'A') ||
    setweight(to_tsvector('simple', coalesce("bodyText", '')), 'B')
  ) STORED;

CREATE INDEX "Mention_searchVector_idx" ON "Mention" USING GIN ("searchVector");
